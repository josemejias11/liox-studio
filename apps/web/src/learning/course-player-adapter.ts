import type { CourseGraph } from '@moto-ai/contracts/course-studio';
import { normalizeCourseContent, type NormalizedCourseContent } from '@/learning/course-content';

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clientSafeQuiz(quiz: NonNullable<CourseGraph['finalQuiz']>, includeAnswerKey: boolean) {
  const payload = objectPayload(quiz.payload);
  const questions = Array.isArray(payload.questions)
    ? payload.questions.map((question) => {
        const source = objectPayload(question);
        const answers = Array.isArray(source.answers)
          ? source.answers.map((answer) => {
              const item = objectPayload(answer);
              return {
                _key: item._key,
                text: item.text,
                ...(includeAnswerKey && typeof item.isCorrect === 'boolean'
                  ? { isCorrect: item.isCorrect }
                  : {}),
              };
            })
          : [];
        return {
          _key: source._key,
          questionText: source.questionText,
          questionType: source.questionType,
          image: source.image,
          answers,
        };
      })
    : [];
  return {
    sectionType: 'quiz',
    _key: quiz.id,
    title: quiz.title ?? undefined,
    instructions: quiz.instructions ?? undefined,
    questions,
    passingScore: payload.passingScore,
    allowRetry: payload.allowRetry,
    showCorrectAnswers: payload.showCorrectAnswers,
  };
}

function courseSections(value: unknown, sectionType: 'specification' | 'disclaimer') {
  const items =
    sectionType === 'specification' ? (Array.isArray(value) ? value : []) : value ? [value] : [];
  return items.map((item) => {
    const source = objectPayload(item);
    return {
      ...source,
      sectionType,
      _key: typeof source._id === 'string' ? source._id : source._key,
    };
  });
}

function rawCourse(course: CourseGraph, includeAnswerKey: boolean) {
  const cover = objectPayload(course.cover);
  return {
    _id: course.id,
    title: course.title,
    description: course.description ?? undefined,
    learningObjectives: course.learningObjectives ?? undefined,
    thumbnail: cover.thumbnail,
    coverImage: cover.coverImage,
    coverHeadline: cover.coverHeadline,
    coverButtonText: cover.coverButtonText,
    coverButtonColor: cover.coverButtonColor,
    theme: course.theme,
    chapters: course.chapters.map((chapter) => ({
      _id: chapter.id,
      title: chapter.title,
      estimatedDuration: chapter.estimatedDuration ?? undefined,
      lessons: chapter.lessons.map((lesson) => ({
        sectionType: 'lesson',
        _key: lesson.id,
        headline: lesson.headline,
        lessonType: lesson.lessonType,
        ...(lesson.body ? { body: lesson.body } : {}),
        ...objectPayload(lesson.payload),
      })),
      quickCheck: chapter.quickCheck
        ? clientSafeQuiz(chapter.quickCheck, includeAnswerKey)
        : undefined,
    })),
    finalQuiz: course.finalQuiz ? clientSafeQuiz(course.finalQuiz, includeAnswerKey) : undefined,
    specifications: courseSections(course.specifications, 'specification'),
    disclaimer: courseSections(course.disclaimer, 'disclaimer')[0],
  };
}

export function toPlayerCourseContent(
  course: CourseGraph,
  { includeAnswerKey = false }: { includeAnswerKey?: boolean } = {},
): NormalizedCourseContent | null {
  return normalizeCourseContent(rawCourse(course, includeAnswerKey));
}
