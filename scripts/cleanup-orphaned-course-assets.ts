// One-time, manual cleanup tool: finds CourseAsset rows (course lesson-media images
// and video) that are no longer referenced by any live course, trashed-but-restorable
// lesson, or frozen course revision, and optionally deletes them.
//
// Scoped strictly to CourseAsset — CourseSourceFile and CourseScormExport have their
// own distinct lifecycle/deletion rules (frozen-source protection, revision-scoped
// retention) and are intentionally left untouched here.
//
// Defaults to a dry run: pass --delete to actually remove orphaned files and rows.
// This is intentionally a manual, one-time tool; a recurring background sweep is a
// deliberate future option, not built here.
import { loadEnvConfig } from '@next/env';
import { prisma } from '@moto-ai/database';
import { collectAssetRefs, r2KeyFor, deleteObject } from '@moto-ai/storage';

async function collectUsedKeys(): Promise<Set<string>> {
  const used = new Set<string>();

  const addFromPayloads = (payloads: unknown[]) => {
    for (const payload of payloads) {
      for (const url of collectAssetRefs(payload)) {
        const key = r2KeyFor(url);
        if (key) used.add(key);
      }
    }
  };

  const courses = await prisma.course.findMany({
    select: {
      cover: true,
      specifications: true,
      disclaimer: true,
      learningObjectives: true,
      chapters: { select: { lessons: { select: { body: true, payload: true } } } },
      quizzes: { select: { payload: true } },
    },
  });
  for (const course of courses) {
    addFromPayloads([
      course.cover,
      course.specifications,
      course.disclaimer,
      course.learningObjectives,
    ]);
    for (const chapter of course.chapters) {
      for (const lesson of chapter.lessons) addFromPayloads([lesson.body, lesson.payload]);
    }
    for (const quiz of course.quizzes) addFromPayloads([quiz.payload]);
  }

  const trashItems = await prisma.courseLessonTrash.findMany({
    select: { body: true, payload: true },
  });
  for (const item of trashItems) addFromPayloads([item.body, item.payload]);

  const revisions = await prisma.courseRevision.findMany({ select: { snapshot: true } });
  for (const revision of revisions) addFromPayloads([revision.snapshot]);

  return used;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  const shouldDelete = process.argv.includes('--delete');

  const usedKeys = await collectUsedKeys();
  const assets = await prisma.courseAsset.findMany({
    select: { id: true, r2Key: true, filename: true, byteSize: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const orphaned = assets.filter((asset) => !usedKeys.has(asset.r2Key));

  console.log(
    `Checked ${assets.length} CourseAsset row(s); ${usedKeys.size} distinct key(s) in use.`,
  );
  console.log(`Found ${orphaned.length} orphaned asset(s).`);
  console.log('');

  let reclaimableBytes = 0;
  for (const asset of orphaned) {
    reclaimableBytes += asset.byteSize ?? 0;
    console.log(
      `${asset.id}  ${asset.r2Key}  ${asset.filename}  ${asset.byteSize ?? 'unknown'} bytes  created ${asset.createdAt.toISOString()}`,
    );
  }
  console.log('');
  console.log(`Reclaimable: ${reclaimableBytes.toLocaleString()} bytes`);

  if (!shouldDelete) {
    console.log('');
    console.log(
      'Dry run only — no files or rows were deleted. Re-run with --delete to remove them.',
    );
    return;
  }

  console.log('');
  console.log('Deleting orphaned assets...');
  let deleted = 0;
  let failed = 0;
  for (const asset of orphaned) {
    try {
      await deleteObject(asset.r2Key);
      await prisma.courseAsset.delete({ where: { id: asset.id } });
      deleted += 1;
      console.log(`deleted  ${asset.id}  ${asset.r2Key}`);
    } catch (error) {
      failed += 1;
      console.error(
        `failed   ${asset.id}  ${asset.r2Key} — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log('');
  console.log(`Deleted ${deleted}, failed ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Cleanup failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
