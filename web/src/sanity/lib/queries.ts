import { groq } from 'next-sanity';

// ── Shared fragments ──────────────────────────────────────────────────────────

const LESSON_FIELDS = groq`
  "sectionType": "lesson",
  "_key": _id,
  headline,
  body,
  lessonType,
  media { asset->{ url } },
  textOverlay { x, y, width },
  hotspots[] {
    _key,
    label,
    topic,
    x,
    y,
    body,
    photos[] { asset->{ url, originalFilename } },
    videoFile { asset->{ url } },
    videoAspectRatio,
  },
  videoAspectRatio,
  videoFile { asset->{ url } },
  floatingGraphics[] { image { asset->{ url } }, x, y, width },
  stageBackground { asset->{ url } },
  enableCompletionAnimation,
  completionTransition,
  colorVariants[] { label, colorHex, image { asset->{ url } } },
  splitReverseLayout,
  dropZones[] { id, label, correctChipId, xPositionPct, yPositionPct },
  chips[] { id, text },
  scrollChapters[] { heading, body, targetScale, targetRotation, targetX, targetY },
`;

const SPEC_FIELDS = groq`
  "sectionType": "specification",
  "_key": _id,
  title,
  subtitle,
  heroImage { asset->{ url } },
  specGroups[] {
    groupName,
    specs[] { label, value, highlight }
  },
  footnotes,
`;

// Client-safe projection — answer correctness (isCorrect / feedback) and the
// post-answer explanation never reach the browser; grading happens server-side
// against QUIZ_GRADING_QUERY in /api/quiz/grade.
const QUIZ_FIELDS = groq`
  "sectionType": "quiz",
  "_key": _id,
  title,
  instructions,
  questions[] {
    _key,
    questionText,
    questionType,
    image { asset->{url} },
    answers[] { _key, text },
  },
  passingScore,
  allowRetry,
  showCorrectAnswers,
`;

const DISCLAIMER_FIELDS = groq`
  "sectionType": "disclaimer",
  "_key": _id,
  title,
  category,
  body,
  disclaimers,
  acknowledgementRequired,
  acknowledgementLabel,
`;

const CHAPTER_FIELDS = groq`
  _id,
  title,
  slug,
  estimatedDuration,
  "lessons": lessons[]->{
    ${LESSON_FIELDS}
  },
  "quickCheck": quickCheck->{ ${QUIZ_FIELDS} },
`;

// ── Queries ───────────────────────────────────────────────────────────────────

// All published modules — used for the course library grid
export const COURSES_QUERY = groq`
  *[_type == "course" && published == true] | order(_createdAt desc) {
    _id,
    title,
    slug,
    description,
    thumbnail { asset->{ url } },
    learningObjectives,
    "chapterCount": count(chapters),
  }
`;

// Single module with all chapters and sections fully resolved
export const COURSE_BY_SLUG_QUERY = groq`
  *[_type == "course" && slug.current == $slug && published == true][0] {
    _id,
    title,
    slug,
    description,
    thumbnail { asset->{ url } },
    coverImage { asset->{ url } },
    coverHeadline,
    coverButtonText,
    coverButtonColor,
    learningObjectives,
    "chapters": chapters[]->{
      ${CHAPTER_FIELDS}
    },
    "specifications": specifications[]->{${SPEC_FIELDS}},
    "disclaimer": disclaimer->{${DISCLAIMER_FIELDS}},
  }
`;

// SERVER-ONLY: full quiz answer key for /api/quiz/grade. Never use this query
// in code whose result is serialized to the browser.
export const QUIZ_GRADING_QUERY = groq`
  *[_type == "quiz" && _id == $id][0] {
    questions[] {
      answers[] { text, isCorrect, feedback },
      explanation,
    },
    passingScore,
  }
`;
