import type {
  CourseRevisionSource,
  CourseSourceFile,
  CourseSourceIndexStatus,
} from '@moto-ai/contracts/course-studio';
import { prisma } from './index';

export interface CreatePendingSourceInput {
  courseId: string;
  r2Key: string;
  filename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
}

type SourceRecord = {
  id: string;
  courseId: string;
  r2Key: string;
  filename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  indexStatus: 'PENDING' | 'INDEXED' | 'FAILED' | 'DELETING';
  chunksStored: number | null;
  indexError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toSourceIndexStatus(status: SourceRecord['indexStatus']): CourseSourceIndexStatus {
  return status.toLowerCase() as CourseSourceIndexStatus;
}

function toCourseSourceFile(
  source: SourceRecord,
  ownership: CourseSourceFile['ownership'] = 'owned',
  courseId = source.courseId,
): CourseSourceFile {
  return {
    ...source,
    courseId,
    indexStatus: toSourceIndexStatus(source.indexStatus),
    ownership,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

async function requireOwnedCourseSource(courseId: string, sourceId: string): Promise<SourceRecord> {
  const source = await prisma.courseSourceFile.findFirst({
    where: { id: sourceId, courseId },
  });
  if (!source) throw new Error('COURSE_SOURCE_NOT_FOUND');
  return source;
}

export async function createPendingSource(
  input: CreatePendingSourceInput,
): Promise<CourseSourceFile> {
  const source = await prisma.courseSourceFile.create({
    data: {
      courseId: input.courseId,
      r2Key: input.r2Key,
      filename: input.filename,
      contentType: input.contentType,
      byteSize: input.byteSize,
      sha256: input.sha256,
    },
  });
  return toCourseSourceFile(source);
}

export async function getCourseSource(
  courseId: string,
  sourceId: string,
): Promise<CourseSourceFile> {
  return toCourseSourceFile(await requireOwnedCourseSource(courseId, sourceId));
}

export async function markSourceIndexed(
  courseId: string,
  sourceId: string,
  chunksStored: number,
): Promise<CourseSourceFile> {
  const existing = await requireOwnedCourseSource(courseId, sourceId);
  if (existing.indexStatus === 'DELETING') throw new Error('COURSE_SOURCE_REMOVAL_IN_PROGRESS');
  const source = await prisma.courseSourceFile.update({
    where: { id: sourceId },
    data: { indexStatus: 'INDEXED', chunksStored, indexError: null },
  });
  return toCourseSourceFile(source);
}

export async function markSourceFailed(
  courseId: string,
  sourceId: string,
  indexError: string,
): Promise<CourseSourceFile> {
  const existing = await requireOwnedCourseSource(courseId, sourceId);
  if (existing.indexStatus === 'DELETING') throw new Error('COURSE_SOURCE_REMOVAL_IN_PROGRESS');
  const source = await prisma.courseSourceFile.update({
    where: { id: sourceId },
    data: { indexStatus: 'FAILED', chunksStored: null, indexError },
  });
  return toCourseSourceFile(source);
}

export async function listCourseSources(courseId: string): Promise<CourseSourceFile[]> {
  const [ownedSources, inheritedBindings] = await Promise.all([
    prisma.courseSourceFile.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.courseSourceBinding.findMany({
      where: { courseId },
      orderBy: { sourceFile: { createdAt: 'desc' } },
      include: { sourceFile: true },
    }),
  ]);
  return [
    ...ownedSources.map((source) => toCourseSourceFile(source)),
    ...inheritedBindings.map((binding) =>
      toCourseSourceFile(binding.sourceFile, 'inherited', binding.courseId),
    ),
  ];
}

export async function retryCourseSourceIndex(
  courseId: string,
  sourceId: string,
): Promise<CourseSourceFile> {
  const source = await requireOwnedCourseSource(courseId, sourceId);
  if (source.indexStatus === 'DELETING') throw new Error('COURSE_SOURCE_REMOVAL_IN_PROGRESS');
  if (source.indexStatus !== 'FAILED') throw new Error('COURSE_SOURCE_RETRY_NOT_ALLOWED');
  const retried = await prisma.courseSourceFile.update({
    where: { id: source.id },
    data: { indexStatus: 'PENDING', chunksStored: null, indexError: null },
  });
  return toCourseSourceFile(retried);
}

// Removal is deliberately two-phase. The retained DELETING row carries the
// R2 key and source ID needed to retry cleanup after either external store is
// unavailable. A source in this state cannot be frozen into a new revision.
export async function beginCourseSourceRemoval(
  courseId: string,
  sourceId: string,
): Promise<CourseSourceFile> {
  const source = await prisma.$transaction(async (tx) => {
    const existing = await tx.courseSourceFile.findFirst({
      where: { id: sourceId, courseId },
      include: { revisionLinks: { select: { revisionId: true }, take: 1 } },
    });
    if (!existing) throw new Error('COURSE_SOURCE_NOT_FOUND');
    if (existing.revisionLinks.length > 0) throw new Error('COURSE_SOURCE_FROZEN');
    if (existing.indexStatus === 'DELETING') return existing;
    return tx.courseSourceFile.update({
      where: { id: sourceId },
      data: { indexStatus: 'DELETING', indexError: null },
    });
  });
  return toCourseSourceFile(source);
}

export async function completeCourseSourceRemoval(
  courseId: string,
  sourceId: string,
): Promise<CourseSourceFile> {
  const source = await prisma.$transaction(async (tx) => {
    const existing = await tx.courseSourceFile.findFirst({
      where: { id: sourceId, courseId, indexStatus: 'DELETING' },
      include: { revisionLinks: { select: { revisionId: true }, take: 1 } },
    });
    if (!existing) throw new Error('COURSE_SOURCE_NOT_FOUND');
    if (existing.revisionLinks.length > 0) throw new Error('COURSE_SOURCE_FROZEN');
    return tx.courseSourceFile.delete({ where: { id: sourceId } });
  });
  return toCourseSourceFile(source);
}

export async function listRevisionSources(
  courseId: string,
  revisionId: string,
): Promise<CourseRevisionSource[]> {
  const revision = await prisma.courseRevision.findFirst({
    where: { id: revisionId, courseId },
    select: {
      sources: {
        orderBy: { sourceFileId: 'asc' },
        select: { revisionId: true, sourceFileId: true, sha256: true, filename: true },
      },
    },
  });
  if (!revision) throw new Error('REVISION_NOT_FOUND');
  return revision.sources;
}

export async function listFrozenRevisionSourceIds(
  courseId: string,
  revisionId: string,
): Promise<string[]> {
  return (await listRevisionSources(courseId, revisionId)).map((source) => source.sourceFileId);
}
