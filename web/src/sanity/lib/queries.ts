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
    "chapterCount": count(chapters),
  }
`;

// Single module with all chapters and lessons fully resolved
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
    "chapters": chapters[]-> {
      _id,
      title,
      slug,
      estimatedDuration,
      lessons[]-> {
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
            photos[] { asset->{ url } },
            videoUrl,
            videoFile { asset->{ url } },
            textOverlay { x, y, width }
          },
          body,
          photos[] { asset->{ url } },
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
    "chapters": chapters[]-> {
      _id,
      title,
      slug,
      estimatedDuration,
      lessons[]-> {
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
            photos[] { asset->{ url } },
            videoUrl,
            videoFile { asset->{ url } },
            textOverlay { x, y, width }
          },
          body,
          photos[] { asset->{ url } },
        },
        videoUrl,
        videoFile { asset->{ url } },
        stageBackground { asset->{ url } },
        completionTransition,
      },
    },
  }
`;
