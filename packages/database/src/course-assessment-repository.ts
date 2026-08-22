import { Prisma } from '@prisma/client';
import type { CourseAssessmentInput } from '@moto-ai/contracts';
import type { CourseGraph } from '@moto-ai/contracts/course-studio';
import { prisma } from './index';
import { getAuthoringCourse } from './course-repository';

function assessmentPayload(input: CourseAssessmentInput): Prisma.InputJsonObject {
  return {
    questions: input.questions as unknown as Prisma.InputJsonArray,
    passingScore: input.passingScore,
    allowRetry: input.allowRetry,
    showCorrectAnswers: input.showCorrectAnswers,
  };
}

function newId(prefix: string): string {
  return `${prefix}.${crypto.randomUUID()}`;
}

async function refreshedCourse(courseId: string): Promise<CourseGraph> {
  const course = await getAuthoringCourse(courseId);
  if (!course) throw new Error('COURSE_NOT_FOUND');
  return course;
}

async function ensureQuizOwnership(
  tx: Prisma.TransactionClient,
  quizId: string,
  courseId: string,
): Promise<void> {
  const quiz = await tx.courseQuiz.findFirst({
    where: { id: quizId, courseId },
    select: { id: true },
  });
  if (!quiz) throw new Error('QUIZ_OWNERSHIP_MISMATCH');
}

export async function upsertChapterQuickCheck(
  courseId: string,
  chapterId: string,
  input: CourseAssessmentInput,
): Promise<CourseGraph> {
  await prisma.$transaction(async (tx) => {
    const chapter = await tx.courseChapter.findFirst({
      where: { id: chapterId, courseId },
      select: { quickCheckId: true },
    });
    if (!chapter) throw new Error('CHAPTER_NOT_FOUND');

    const data = {
      title: input.title,
      instructions: input.instructions,
      payload: assessmentPayload(input),
    };
    if (chapter.quickCheckId) {
      await ensureQuizOwnership(tx, chapter.quickCheckId, courseId);
      await tx.courseQuiz.update({ where: { id: chapter.quickCheckId }, data });
      return;
    }

    const quickCheckId = newId('quiz');
    await tx.courseQuiz.create({ data: { id: quickCheckId, courseId, ...data } });
    await tx.courseChapter.update({ where: { id: chapterId }, data: { quickCheckId } });
  });
  return refreshedCourse(courseId);
}

export async function removeChapterQuickCheck(
  courseId: string,
  chapterId: string,
): Promise<CourseGraph> {
  await prisma.$transaction(async (tx) => {
    const chapter = await tx.courseChapter.findFirst({
      where: { id: chapterId, courseId },
      select: { quickCheckId: true },
    });
    if (!chapter) throw new Error('CHAPTER_NOT_FOUND');
    if (!chapter.quickCheckId) return;

    await ensureQuizOwnership(tx, chapter.quickCheckId, courseId);
    await tx.courseChapter.update({ where: { id: chapterId }, data: { quickCheckId: null } });
    await tx.courseQuiz.delete({ where: { id: chapter.quickCheckId } });
  });
  return refreshedCourse(courseId);
}

export async function upsertFinalAssessment(
  courseId: string,
  input: CourseAssessmentInput,
): Promise<CourseGraph> {
  await prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { finalQuizId: true },
    });
    if (!course) throw new Error('COURSE_NOT_FOUND');

    const data = {
      title: input.title,
      instructions: input.instructions,
      payload: assessmentPayload(input),
    };
    if (course.finalQuizId) {
      await ensureQuizOwnership(tx, course.finalQuizId, courseId);
      await tx.courseQuiz.update({ where: { id: course.finalQuizId }, data });
      return;
    }

    const finalQuizId = newId('quiz');
    await tx.courseQuiz.create({ data: { id: finalQuizId, courseId, ...data } });
    await tx.course.update({ where: { id: courseId }, data: { finalQuizId } });
  });
  return refreshedCourse(courseId);
}

export async function removeFinalAssessment(courseId: string): Promise<CourseGraph> {
  await prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { finalQuizId: true },
    });
    if (!course) throw new Error('COURSE_NOT_FOUND');
    if (!course.finalQuizId) return;

    await ensureQuizOwnership(tx, course.finalQuizId, courseId);
    await tx.course.update({ where: { id: courseId }, data: { finalQuizId: null } });
    await tx.courseQuiz.delete({ where: { id: course.finalQuizId } });
  });
  return refreshedCourse(courseId);
}
