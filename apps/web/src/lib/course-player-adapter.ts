import type { CourseGraph } from '@moto-ai/database';
import { courseSummarySchema, type CourseSummary } from '@/lib/contracts/player-course';
import { normalizeCourseContent, type NormalizedCourseContent } from '@/lib/course-content';

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clientSafeQuiz(quiz: NonNullable<CourseGraph['chapters'][number]['quickCheck']>) {
  const payload = objectPayload(quiz.payload);
  const questions = Array.isArray(payload.questions)
    ? payload.questions.map((question) => {
        const source = objectPayload(question);
        const answers = Array.isArray(source.answers)
          ? source.answers.map((answer) => {
              const item = objectPayload(answer);
              return { _key: item._key, text: item.text };
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
  const items = sectionType === 'specification'
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : []);
  return items.map((item) => {
    const source = objectPayload(item);
    return {
      ...source,
      sectionType,
      _key: typeof source._id === 'string' ? source._id : source._key,
    };
  });
}

function rawCourse(course: CourseGraph) {
  const cover = objectPayload(course.cover);
  return {
    _id: course.id,
    title: course.title,
    courseMode: course.courseMode,
    description: course.description ?? undefined,
    learningObjectives: course.learningObjectives ?? undefined,
    thumbnail: cover.thumbnail,
    coverImage: cover.coverImage,
    coverHeadline: cover.coverHeadline,
    coverButtonText: cover.coverButtonText,
    coverButtonColor: cover.coverButtonColor,
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
      quickCheck: chapter.quickCheck ? clientSafeQuiz(chapter.quickCheck) : undefined,
    })),
    specifications: courseSections(course.specifications, 'specification'),
    disclaimer: courseSections(course.disclaimer, 'disclaimer')[0],
  };
}

export function toPlayerCourseContent(course: CourseGraph): NormalizedCourseContent | null {
  return normalizeCourseContent(rawCourse(course));
}

export function toPlayerCourseSummary(input: {
  id: string;
  slug: string;
  title: string;
  courseMode: string;
  description: string | null;
  learningObjectives: unknown;
  cover: unknown;
  _count: { chapters: number };
}): CourseSummary | null {
  const cover = objectPayload(input.cover);
  const parsed = courseSummarySchema.safeParse({
    _id: input.id,
    title: input.title,
    courseMode: input.courseMode,
    slug: { current: input.slug },
    description: input.description ?? undefined,
    thumbnail: cover.thumbnail,
    learningObjectives: input.learningObjectives ?? undefined,
    chapterCount: input._count.chapters,
  });
  return parsed.success ? parsed.data : null;
}
