import { groq } from "next-sanity";

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
    contentMode,
    layerContent {
      headline,
      body,
      layerType,
      media { asset->{ url } },
      photos[] { asset->{ url, originalFilename } },
      videoAspectRatio,
      videoFile { asset->{ url } },
      textOverlay { x, y, width }
    },
    body,
    photos[] { asset->{ url, originalFilename } },
  },
  videoAspectRatio,
  videoFile { asset->{ url } },
  floatingGraphics[] { image { asset->{ url } }, x, y, width },
  stageBackground { asset->{ url } },
  enableCompletionAnimation,
  completionTransition,
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

const QUIZ_FIELDS = groq`
  "sectionType": "quiz",
  "_key": _id,
  title,
  instructions,
  questions[] {
    _key,
    questionText,
    questionType,
    answers[] { _key, text, isCorrect, feedback },
    explanation,
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
    "quiz": quiz->{${QUIZ_FIELDS}},
    "disclaimer": disclaimer->{${DISCLAIMER_FIELDS}},
  }
`;
