import { groq } from "next-sanity";

// All published modules — used for the course library grid
export const MODULES_QUERY = groq`
  *[_type == "module" && published == true] | order(_createdAt desc) {
    _id,
    title,
    slug,
    description,
    thumbnail { asset->{ url } },
    learningObjectives,
    "lessonCount": count(lessons),
  }
`;

// Single module with all lessons and slides fully resolved
export const MODULE_BY_SLUG_QUERY = groq`
  *[_type == "module" && slug.current == $slug && published == true][0] {
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
    "lessons": lessons[]-> {
      _id,
      title,
      slug,
      estimatedDuration,
      slides[] {
        _key,
        headline,
        body,
        slideType,
        speakerNotes,
        media { asset->{ url } },
        hotspots[] {
          _key,
          label,
          topic,
          body,
          photos[] { asset->{ url } },
          x,
          y,
        },
        videoUrl,
        videoFile { asset->{ url } },
        stageBackground { asset->{ url } },
        completionTransition,
      },
    },
  }
`;

// First published module — used on the homepage while we have no routing
export const FIRST_MODULE_QUERY = groq`
  *[_type == "module" && published == true] | order(_createdAt desc) [0] {
    _id,
    title,
    slug,
    description,
    thumbnail,
    learningObjectives,
    "lessons": lessons[]-> {
      _id,
      title,
      slug,
      estimatedDuration,
      slides[] {
        _key,
        headline,
        body,
        slideType,
        speakerNotes,
        media { asset->{ url } },
        hotspots[] {
          _key,
          label,
          topic,
          body,
          photos[] { asset->{ url } },
          x,
          y,
        },
        videoUrl,
        videoFile { asset->{ url } },
        stageBackground { asset->{ url } },
        completionTransition,
      },
    },
  }
`;
