import type { SanityClient } from 'sanity';
import type { AuthoringLesson, StudioReference } from './authoring-types';
import { createLessonDefaults, type BlockType } from './block-catalog';
import { buildMasterSnapshot } from './master-snapshot';
import type { AuthoringCourse } from './authoring-types';

function documentId(prefix: string): string {
  return `${prefix}.${crypto.randomUUID()}`;
}

function reference(id: string, prefix: string): StudioReference {
  return { _key: `${prefix}-${crypto.randomUUID()}`, _ref: id };
}

function slugFor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

export async function createLionbridgeCourse(client: SanityClient): Promise<string> {
  const courseId = documentId('course');
  const chapterId = documentId('chapter');
  const lessonId = documentId('lesson');
  const title = 'New Motorola e-learning';
  const chapterTitle = 'Introduction';

  await client
    .transaction()
    .create({
      _id: courseId,
      _type: 'course',
      title,
      slug: { _type: 'slug', current: slugFor(title) },
      courseMode: 'standard',
      published: false,
      chapters: [reference(chapterId, 'chapter')],
    })
    .create({
      _id: chapterId,
      _type: 'chapter',
      title: chapterTitle,
      slug: { _type: 'slug', current: slugFor(chapterTitle) },
      lessons: [reference(lessonId, 'lesson')],
    })
    .create({ _id: lessonId, _type: 'lesson', ...createLessonDefaults('content') })
    .commit();

  return courseId;
}

export async function createChapter(client: SanityClient, courseId: string): Promise<string> {
  const chapterId = documentId('chapter');
  const title = 'New chapter';
  await client
    .transaction()
    .create({
      _id: chapterId,
      _type: 'chapter',
      title,
      slug: { _type: 'slug', current: `${slugFor(title)}-${chapterId.slice(-6)}` },
      lessons: [],
    })
    .patch(courseId, (patch) => patch.setIfMissing({ chapters: [] }).append('chapters', [reference(chapterId, 'chapter')]))
    .commit();
  return chapterId;
}

export async function createLesson(
  client: SanityClient,
  chapterId: string,
  lessonType: BlockType,
): Promise<string> {
  const lessonId = documentId('lesson');
  await client
    .transaction()
    .create({ _id: lessonId, _type: 'lesson', ...createLessonDefaults(lessonType) })
    .patch(chapterId, (patch) => patch.setIfMissing({ lessons: [] }).append('lessons', [reference(lessonId, 'lesson')]))
    .commit();
  return lessonId;
}

export async function moveReference(
  client: SanityClient,
  documentId: string,
  field: 'chapters' | 'lessons',
  references: StudioReference[],
  referenceKey: string,
  direction: -1 | 1,
): Promise<void> {
  const index = references.findIndex((item) => item._key === referenceKey);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= references.length) return;
  const next = [...references];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  await client.patch(documentId).set({ [field]: next }).commit();
}

export async function removeReference(
  client: SanityClient,
  documentId: string,
  field: 'chapters' | 'lessons',
  references: StudioReference[],
  referenceKey: string,
): Promise<void> {
  await client.patch(documentId).set({ [field]: references.filter((item) => item._key !== referenceKey) }).commit();
}

export async function duplicateLesson(
  client: SanityClient,
  chapterId: string,
  lesson: AuthoringLesson,
): Promise<string> {
  const lessonId = documentId('lesson');
  const { _id: _ignoredId, _rev: _ignoredRevision, _createdAt, _updatedAt, ...copy } = lesson as AuthoringLesson & {
    _createdAt?: string;
    _updatedAt?: string;
  };
  void _ignoredId;
  void _ignoredRevision;
  void _createdAt;
  void _updatedAt;
  await client
    .transaction()
    .create({ _id: lessonId, _type: 'lesson', ...copy, headline: `${lesson.headline ?? 'Untitled screen'} copy` })
    .patch(chapterId, (patch) => patch.setIfMissing({ lessons: [] }).append('lessons', [reference(lessonId, 'lesson')]))
    .commit();
  return lessonId;
}

export async function patchDocument(
  client: SanityClient,
  documentId: string,
  values: Record<string, unknown>,
): Promise<void> {
  await client.patch(documentId).set(values).commit();
}

export async function createMasterRelease(client: SanityClient, course: AuthoringCourse): Promise<void> {
  const snapshot = await buildMasterSnapshot(course);
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "courseMasterRelease" && sourceCourse._ref == $courseId && sourceRevision == $sourceRevision][0]{_id}`,
    { courseId: course._id, sourceRevision: course._rev },
  );
  if (existing) throw new Error('A master release already exists for this Course revision.');

  const releaseId = `courseMasterRelease.${snapshot.fingerprint}`;
  try {
    await client
      .transaction()
      .create({
        _id: releaseId,
        _type: 'courseMasterRelease',
        sourceCourse: { _type: 'reference', _ref: course._id },
        sourceRevision: snapshot.sourceRevision,
        sourceFingerprint: snapshot.fingerprint,
        sourceTitle: snapshot.sourceTitle,
        status: 'draft',
        snapshot: JSON.stringify(snapshot),
      })
      .patch(course._id, (patch) => patch.setIfMissing({ masterReleases: [] }).append('masterReleases', [reference(releaseId, 'master')]))
      .commit();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw new Error('A master release already exists for this Course revision.');
    }
    throw error;
  }
}
