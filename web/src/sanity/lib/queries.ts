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
      lessons[] {
        _key,
        headline,
        body,
        lessonType,
        speakerNotes,
        media { asset->{ url } },
        hotspots[] {
          _key,
          label,
          topic,
          linkedLayer,
          body,
          photos[] { asset->{ url } },
          x,
          y,
        },
        videoUrl,
        videoFile { asset->{ url } },
        stageBackground { asset->{ url } },
        completionTransition,
        layers[] {
          _key,
          headline,
          body,
          layerType,
          speakerNotes,
          media { asset->{ url } },
          photos[] { asset->{ url } },
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
        },
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
      lessons[] {
        _key,
        headline,
        body,
        lessonType,
        speakerNotes,
        media { asset->{ url } },
        hotspots[] {
          _key,
          label,
          topic,
          linkedLayer,
          body,
          photos[] { asset->{ url } },
          x,
          y,
        },
        videoUrl,
        videoFile { asset->{ url } },
        stageBackground { asset->{ url } },
        completionTransition,
        layers[] {
          _key,
          headline,
          body,
          layerType,
          speakerNotes,
          media { asset->{ url } },
          photos[] { asset->{ url } },
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
        },
      },
    },
  }
`;
