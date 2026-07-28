import { groq } from 'next-sanity';

export const AUTHORING_COURSES_QUERY = groq`
  *[_type == "course"] | order(_updatedAt desc) {
    _id,
    _updatedAt,
    title,
    thumbnail,
  }
`;

// This query is private to the Lionbridge authoring tool. Public learner
// queries remain in `sanity/lib/queries.ts` and must not receive authoring data.
export const AUTHORING_COURSE_QUERY = groq`
  *[_type == "course" && _id == $courseId][0] {
    _id,
    _rev,
    _updatedAt,
    title,
    description,
    thumbnail,
    learningObjectives,
    courseMode,
    coverImage,
    coverHeadline,
    coverButtonText,
    coverButtonColor,
    masterReleases,
    "chapters": chapters[]-> {
      _id,
      _rev,
      title,
      estimatedDuration,
      "lessons": lessons[]-> { ... },
      "quickCheck": quickCheck-> { ... },
    },
    "specifications": specifications[]-> { ... },
    "disclaimer": disclaimer-> { ... },
  }
`;
