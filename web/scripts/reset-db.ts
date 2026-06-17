import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting Postgres tables...\n');

  // Delete in FK-safe order: children before the Session parent
  const quizAttempts = await prisma.quizAttempt.deleteMany();
  console.log(`✓ QuizAttempt    — ${quizAttempts.count} row(s) deleted`);

  const lessonProgress = await prisma.lessonProgress.deleteMany();
  console.log(`✓ LessonProgress — ${lessonProgress.count} row(s) deleted`);

  const hotspotVisits = await prisma.hotspotVisit.deleteMany();
  console.log(`✓ HotspotVisit   — ${hotspotVisits.count} row(s) deleted`);

  const generatedQuizzes = await prisma.generatedQuiz.deleteMany();
  console.log(`✓ GeneratedQuiz  — ${generatedQuizzes.count} row(s) deleted`);

  const sessions = await prisma.session.deleteMany();
  console.log(`✓ Session        — ${sessions.count} row(s) deleted`);

  console.log('\nDatabase cleared — ready for fresh content.');
}

main()
  .catch((err: unknown) => {
    console.error('DB reset failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
