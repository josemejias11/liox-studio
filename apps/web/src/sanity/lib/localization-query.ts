import { groq } from 'next-sanity';

// Resolved English authoring source used exclusively when freezing a
// localization release. It intentionally excludes learner-only configuration
// and binary media fields.
export const COURSE_LOCALIZATION_SOURCE_QUERY = groq`
  *[_type == "course" && _id == $courseId][0] {
    _id,
    _rev,
    title,
    description,
    learningObjectives,
    coverHeadline,
    coverButtonText,
    "chapters": chapters[]->{
      _id,
      title,
      "lessons": lessons[]->{
        _id,
        headline,
        body,
        deviceName,
        coveredFeatures[] { _key, label, summary },
        hotspots[] { _key, label, topic, body },
        colorVariants[] { _key, label },
        dropZones[] { _key, label },
        chips[] { _key, text },
        scrollChapters[] { _key, heading, body },
      },
      "quickCheck": quickCheck->{
        _id,
        title,
        instructions,
        questions[] {
          _key,
          questionText,
          answers[] { _key, text, feedback },
          explanation,
        },
      },
    },
    "specifications": specifications[]->{
      _id,
      title,
      subtitle,
      specGroups[] {
        _key,
        groupName,
        specs[] { _key, label, value },
      },
      footnotes,
    },
    "disclaimer": disclaimer->{
      _id,
      title,
      body,
      disclaimers,
      acknowledgementLabel,
    },
  }
`;
