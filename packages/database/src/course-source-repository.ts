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
  indexStatus: 'PENDING' | 'INDEXED' | 'FAILED';
  chunksStored: number | null;
  indexError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toSourceIndexStatus(status: SourceRecord['indexStatus']): CourseSourceIndexStatus {
  return status.toLowerCase() as CourseSourceIndexStatus;
}

function toCourseSourceFile(source: SourceRecord): CourseSourceFile {
  return {
    ...source,
    indexStatus: toSourceIndexStatus(source.indexStatus),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

async function requireCourseSource(courseId: string, sourceId: string): Promise<SourceRecord> {
  const source = await prisma.courseSourceFile.findFirst({
    where: { id: sourceId, courseId },
  });
  if (!source) throw new Error('COURSE_SOURCE_NOT_FOUND');
  return source;
}

export async function createPendingSource(input: CreatePendingSourceInput): Promise<CourseSourceFile> {
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

export async function getCourseSource(courseId: string, sourceId: string): Promise<CourseSourceFile> {
  return toCourseSourceFile(await requireCourseSource(courseId, sourceId));
}

export async function markSourceIndexed(
  courseId: string,
  sourceId: string,
  chunksStored: number,
): Promise<CourseSourceFile> {
  await requireCourseSource(courseId, sourceId);
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
  await requireCourseSource(courseId, sourceId);
  const source = await prisma.courseSourceFile.update({
    where: { id: sourceId },
    data: { indexStatus: 'FAILED', chunksStored: null, indexError },
  });
  return toCourseSourceFile(source);
}

export async function listCourseSources(courseId: string): Promise<CourseSourceFile[]> {
  const sources = await prisma.courseSourceFile.findMany({
    where: { courseId },
    orderBy: { createdAt: 'desc' },
  });
  return sources.map(toCourseSourceFile);
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

export async function removeCourseSource(courseId: string, sourceId: string): Promise<CourseSourceFile> {
  const source = await prisma.$transaction(async (tx) => {
    const existing = await tx.courseSourceFile.findFirst({
      where: { id: sourceId, courseId },
      include: { revisionLinks: { select: { revisionId: true }, take: 1 } },
    });
    if (!existing) throw new Error('COURSE_SOURCE_NOT_FOUND');
    if (existing.revisionLinks.length > 0) throw new Error('COURSE_SOURCE_FROZEN');
    return tx.courseSourceFile.delete({ where: { id: sourceId } });
  });
  return toCourseSourceFile(source);
}
