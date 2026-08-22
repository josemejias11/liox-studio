import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GeneratedCourseGraphSchema } from '@moto-ai/contracts/course-generation';
import { courseAssetUrlSchema } from '@moto-ai/contracts';
import {
  AssistantQaGenerationPayloadSchema,
  CourseDuplicateArtifactSchema,
  CourseDuplicatePayloadSchema,
  CourseGenerationPayloadSchema,
  DocumentIndexPayloadSchema,
  ScormExportArtifactSchema,
  ScormExportPayloadSchema,
  type ScormExportResult,
} from '@moto-ai/contracts/jobs';
import {
  getCourseGeneration,
  getCourseSource,
  findCourseCreatedByJob,
  markCourseGenerationFailed,
  markCourseGenerationRunning,
  markSourceFailed,
  markSourceIndexed,
  persistGeneratedCourse,
  persistDuplicatedCourse,
  prisma,
  replaceCourseAssistantQaDrafts,
} from '@moto-ai/database';
import {
  generateCourseDraft,
  generateAssistantQaDrafts,
  RagServiceError,
  uploadCourseDocument,
} from '@moto-ai/parser-client';
import { NonRetryableJobError, refreshLease, type ClaimedJob } from '@moto-ai/jobs';
import { AssetNotFoundError, buildScormPackage } from '@moto-ai/scorm-export';
import {
  collectAssetRefs,
  copyCourseAssetRefs,
  CourseAssetCopyError,
  deleteObject,
  plannedCourseAssetDestinationKeys,
  putObject,
} from '@moto-ai/storage';

async function indexDocument(job: ClaimedJob): Promise<{ filename: string; chunksStored: number }> {
  const payload = DocumentIndexPayloadSchema.safeParse(job.payload);
  if (!payload.success) {
    throw new NonRetryableJobError('The queued document is incomplete. Upload it again to retry.');
  }

  const { courseId, sourceId, sha256, filename, contentType } = payload.data;
  if (!job.artifact) {
    const message = 'The queued source bytes are missing. Upload it again to retry.';
    await markSourceFailed(courseId, sourceId, message);
    throw new NonRetryableJobError(message);
  }

  let source: Awaited<ReturnType<typeof getCourseSource>>;
  try {
    source = await getCourseSource(courseId, sourceId);
  } catch {
    throw new NonRetryableJobError('The source record no longer exists. Upload it again to retry.');
  }

  const artifactSha256 = createHash('sha256').update(job.artifact.bytes).digest('hex');
  if (
    source.sha256 !== sha256 ||
    artifactSha256 !== sha256 ||
    source.filename !== filename ||
    source.contentType !== contentType
  ) {
    const message = 'The queued source does not match its stored record. Upload it again to retry.';
    await markSourceFailed(courseId, sourceId, message);
    throw new NonRetryableJobError(message);
  }

  const file = new File([new Uint8Array(job.artifact.bytes)], job.artifact.filename, {
    type: job.artifact.contentType ?? 'application/octet-stream',
  });
  try {
    const result = await uploadCourseDocument(courseId, sourceId, sha256, file);
    if (result.sourceId !== sourceId || result.filename !== filename) {
      throw new NonRetryableJobError(
        'The indexing service returned a mismatched source. Upload it again to retry.',
      );
    }
    await markSourceIndexed(courseId, sourceId, result.chunksStored);
    return { filename: result.filename, chunksStored: result.chunksStored };
  } catch (error: unknown) {
    const retryable = isRetryableJobError(error);
    if (!retryable || job.attempts >= job.maxAttempts) {
      await markSourceFailed(
        courseId,
        sourceId,
        retryable
          ? 'This source could not be indexed after multiple attempts. Upload it again to retry.'
          : 'This source could not be indexed. Check the file contents and format, then upload it again.',
      );
    }
    throw error;
  }
}

async function generateAssistantQa(job: ClaimedJob): Promise<{ draftsCreated: number }> {
  const payload = AssistantQaGenerationPayloadSchema.safeParse(job.payload);
  if (!payload.success) {
    throw new NonRetryableJobError(
      'The queued assistant Q&A request is invalid. Select indexed sources and retry.',
    );
  }
  const selected = await prisma.courseSourceFile.findMany({
    where: {
      courseId: payload.data.courseId,
      id: { in: payload.data.sourceIds },
      indexStatus: 'INDEXED',
    },
    select: { id: true, sha256: true },
  });
  if (
    selected.length !== payload.data.sourceIds.length ||
    selected.some((item) => !payload.data.sourceHashes.includes(item.sha256))
  ) {
    throw new NonRetryableJobError(
      'Every selected assistant source must still be indexed and unchanged. Select sources again.',
    );
  }
  const drafts = await generateAssistantQaDrafts(payload.data.courseId, payload.data.sourceIds);
  if (
    drafts.some((draft) =>
      draft.citations.some((citation) => !payload.data.sourceIds.includes(citation.sourceId)),
    )
  ) {
    throw new NonRetryableJobError(
      'The generated assistant Q&A cited a source outside the selected indexed set. Generate a new draft.',
    );
  }
  await replaceCourseAssistantQaDrafts({ ...payload.data, drafts });
  return { draftsCreated: drafts.length };
}

async function generateCourse(job: ClaimedJob): Promise<unknown> {
  const payload = CourseGenerationPayloadSchema.safeParse(job.payload);
  if (!payload.success) {
    throw new NonRetryableJobError(
      'The queued course request is invalid. Create a fresh generation request to retry.',
    );
  }
  const generation = await getCourseGeneration(payload.data.generationId);
  if (!generation) {
    throw new NonRetryableJobError(
      'The course generation request no longer exists. Create a fresh request to retry.',
    );
  }
  if (generation.status === 'succeeded' && generation.result) return generation.result;

  const sourceRevision = await prisma.courseRevision.findUnique({
    where: { id: generation.sourceRevisionId },
    select: { courseId: true },
  });
  if (!sourceRevision) {
    throw new NonRetryableJobError(
      'The frozen source revision no longer exists. Create a fresh request to retry.',
    );
  }
  await markCourseGenerationRunning(generation.id);
  try {
    const response = await generateCourseDraft(
      sourceRevision.courseId,
      generation.requestedSources.map((source) => source.sourceId),
      generation.brief,
      generation.promptTemplateVersion,
    );
    const graph = GeneratedCourseGraphSchema.safeParse(response.graph);
    if (!graph.success || response.promptTemplateVersion !== generation.promptTemplateVersion) {
      throw new NonRetryableJobError(
        'The generated course was incomplete. Create a fresh request to retry.',
      );
    }
    return persistGeneratedCourse(generation.id, {
      graph: graph.data,
      modelIdentifier: response.modelIdentifier,
      promptTemplateVersion: response.promptTemplateVersion,
    });
  } catch (error: unknown) {
    if (!isRetryableJobError(error) || job.attempts >= job.maxAttempts) {
      await markCourseGenerationFailed(
        generation.id,
        'Course generation failed. Create a fresh request when you are ready to retry.',
      );
    }
    throw error;
  }
}

async function scormExport(job: ClaimedJob): Promise<ScormExportResult> {
  const payload = ScormExportPayloadSchema.safeParse(job.payload);
  if (!payload.success) {
    throw new NonRetryableJobError('The queued export request is invalid. Trigger a new export.');
  }
  if (!job.artifact) {
    throw new NonRetryableJobError('The queued course content is missing. Trigger a new export.');
  }

  const revision = await prisma.courseRevision.findUnique({
    where: { id: payload.data.revisionId },
    select: { id: true, sourceTitle: true, version: true },
  });
  if (!revision) {
    throw new NonRetryableJobError('The frozen revision no longer exists. Trigger a new export.');
  }

  let parsedArtifact: unknown;
  try {
    parsedArtifact = JSON.parse(job.artifact.bytes.toString('utf8'));
  } catch {
    throw new NonRetryableJobError('The queued course content is corrupted. Trigger a new export.');
  }
  const artifact = ScormExportArtifactSchema.safeParse(parsedArtifact);
  if (!artifact.success) {
    throw new NonRetryableJobError('The queued course content is corrupted. Trigger a new export.');
  }
  const bundlePayload = artifact.data;

  const playerBundleDir = path.join(playerBundleRoot(), 'dist');
  let playerBundle: Record<string, Buffer>;
  try {
    playerBundle = {
      'player.js': await readFile(path.join(playerBundleDir, 'player.js')),
      'player.css': await readFile(path.join(playerBundleDir, 'player.css')),
      'fonts/MotoSans-Regular.otf': await readFile(
        path.join(playerBundleDir, 'fonts', 'MotoSans-Regular.otf'),
      ),
      'fonts/MotoSans-Italic.otf': await readFile(
        path.join(playerBundleDir, 'fonts', 'MotoSans-Italic.otf'),
      ),
    };
  } catch {
    throw new NonRetryableJobError(
      "The course export tool's player bundle is missing or incomplete in this environment. Contact an administrator before triggering exports.",
    );
  }

  const scoIdentifier = `export_${revision.id}`;
  let built: Awaited<ReturnType<typeof buildScormPackage>>;
  try {
    built = await buildScormPackage({
      title: revision.sourceTitle,
      scoIdentifier,
      masteryScore: bundlePayload.masteryScore,
      content: bundlePayload.content,
      assistant: bundlePayload.assistant,
      playerBundle,
    });
  } catch (error: unknown) {
    if (error instanceof AssetNotFoundError) {
      throw new NonRetryableJobError(
        "One of this course's images or videos is missing from storage. Re-upload it, freeze a new revision, and export again.",
      );
    }
    throw error;
  }

  const r2Key = `exports/${revision.id}/${job.id}.zip`;
  await putObject({ key: r2Key, bytes: built.buffer, contentType: 'application/zip' });

  const record = await prisma.courseScormExport.create({
    data: {
      revisionId: revision.id,
      jobId: job.id,
      r2Key,
      byteSize: built.byteSize,
      sha256: built.sha256,
    },
  });

  return { exportId: record.id, byteSize: built.byteSize, sha256: built.sha256 };
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function duplicateArtifactHash(artifact: {
  graph: unknown;
  assistantQa: unknown;
  sourceIds: string[];
  assetUrls: string[];
  requestedTitle: string;
}): string {
  return createHash('sha256')
    .update(
      stableJson({
        graph: artifact.graph,
        assistantQa: artifact.assistantQa,
        sourceIds: artifact.sourceIds,
        assetUrls: artifact.assetUrls,
        requestedTitle: artifact.requestedTitle,
      }),
    )
    .digest('hex');
}

function assertCanonicalCourseAssetUrls(value: unknown): void {
  if (typeof value === 'string') {
    if (value.startsWith('/api/course-assets/') && !courseAssetUrlSchema.safeParse(value).success) {
      throw new NonRetryableJobError(
        'The queued course copy is corrupted. Start the duplication again.',
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertCanonicalCourseAssetUrls(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      assertCanonicalCourseAssetUrls(item);
    }
  }
}

async function duplicateCourse(job: ClaimedJob): Promise<{ courseId: string }> {
  const payload = CourseDuplicatePayloadSchema.safeParse(job.payload);
  if (!payload.success || !job.artifact) {
    throw new NonRetryableJobError(
      'The queued duplication request is invalid. Start the duplication again.',
    );
  }
  let parsedArtifact: unknown;
  try {
    parsedArtifact = JSON.parse(job.artifact.bytes.toString('utf8'));
  } catch {
    throw new NonRetryableJobError(
      'The queued course copy is corrupted. Start the duplication again.',
    );
  }
  const artifact = CourseDuplicateArtifactSchema.safeParse(parsedArtifact);
  const expectedAssetUrls = artifact.success
    ? [
        ...new Set(
          collectAssetRefs({ graph: artifact.data.graph, assistantQa: artifact.data.assistantQa }),
        ),
      ].sort(compareCodeUnits)
    : [];
  if (artifact.success)
    assertCanonicalCourseAssetUrls({
      graph: artifact.data.graph,
      assistantQa: artifact.data.assistantQa,
    });
  if (
    !artifact.success ||
    artifact.data.requestedTitle !== payload.data.requestedTitle ||
    artifact.data.graph.id !== payload.data.sourceCourseId ||
    stableJson(artifact.data.assetUrls) !== stableJson(expectedAssetUrls) ||
    duplicateArtifactHash(artifact.data) !== artifact.data.contentHash
  ) {
    throw new NonRetryableJobError(
      'The queued course copy is corrupted. Start the duplication again.',
    );
  }

  const existing = await findCourseCreatedByJob(job.id);
  if (existing) return existing;

  let destinationKeys: string[];
  try {
    destinationKeys = plannedCourseAssetDestinationKeys({
      destinationCourseId: payload.data.destinationCourseId,
      sourceUrls: artifact.data.assetUrls,
    });
  } catch (error) {
    if (error instanceof CourseAssetCopyError) throw new NonRetryableJobError(error.message);
    throw error;
  }

  try {
    await refreshLease(job, 'copying media');
    const copied = await copyCourseAssetRefs({
      destinationCourseId: payload.data.destinationCourseId,
      sourceUrls: artifact.data.assetUrls,
    });
    await refreshLease(job, 'writing course');
    return await persistDuplicatedCourse({
      jobId: job.id,
      sourceCourseId: payload.data.sourceCourseId,
      destinationCourseId: payload.data.destinationCourseId,
      requestedTitle: payload.data.requestedTitle,
      artifact: artifact.data,
      urlMap: copied.urlMap,
      assets: copied.assets,
    });
  } catch (error) {
    const committed = await findCourseCreatedByJob(job.id);
    const retryable = isRetryableJobError(error);
    if (!committed && (!retryable || job.attempts >= job.maxAttempts)) {
      await Promise.all(destinationKeys.map((key) => deleteObject(key).catch(() => undefined)));
    }
    if (error instanceof CourseAssetCopyError) throw new NonRetryableJobError(error.message);
    if (
      error instanceof Error &&
      (error.message === 'COURSE_DUPLICATE_GROUNDING_INVALID' ||
        error.message === 'COURSE_DUPLICATE_GRAPH_INVALID')
    ) {
      throw new NonRetryableJobError(
        'The queued course copy is invalid. Start the duplication again.',
      );
    }
    if (committed) return committed;
    throw error;
  }
}

function playerBundleRoot(): string {
  const configured = process.env.SCORM_PLAYER_BUNDLE_PATH;
  if (configured) return configured;
  throw new NonRetryableJobError(
    'The course export tool is not fully configured in this environment. Contact an administrator before triggering exports.',
  );
}

export async function executeJob(job: ClaimedJob): Promise<unknown> {
  if (job.kind === 'DOCUMENT_INDEX') return indexDocument(job);
  if (job.kind === 'SCORM_EXPORT') return scormExport(job);
  if (job.kind === 'COURSE_DUPLICATE') return duplicateCourse(job);

  if (AssistantQaGenerationPayloadSchema.safeParse(job.payload).success)
    return generateAssistantQa(job);
  if (CourseGenerationPayloadSchema.safeParse(job.payload).success) return generateCourse(job);
  throw new NonRetryableJobError('This AI operation is not registered with the worker.');
}

export function isRetryableJobError(error: unknown): boolean {
  if (error instanceof NonRetryableJobError) return false;
  if (error instanceof RagServiceError && error.status && error.status < 500) return false;
  return true;
}
