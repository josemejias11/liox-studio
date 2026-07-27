export type LocalizationUnitKind = 'plainText' | 'portableTextSpan';

export interface LocalizationUnit {
  unitId: string;
  sourceText: string;
  kind: LocalizationUnitKind;
  context: string;
}

export interface LocalizationInventory {
  sourceCourseId: string;
  sourceRevision: string;
  sourceTitle: string;
  units: LocalizationUnit[];
  fingerprint: string;
}

interface PortableTextSpan {
  _key: string;
  _type: string;
  text?: string;
}

interface PortableTextBlock {
  _key: string;
  children?: PortableTextSpan[];
}

interface CoveredFeatureSource {
  _key: string;
  label?: string;
  summary?: string;
}

interface HotspotSource {
  _key: string;
  label?: string;
  topic?: string;
  body?: PortableTextBlock[];
}

interface ColorVariantSource {
  _key: string;
  label?: string;
}

interface DropZoneSource {
  _key: string;
  label?: string;
}

interface ChipSource {
  _key: string;
  text?: string;
}

interface ScrollChapterSource {
  _key: string;
  heading?: string;
  body?: PortableTextBlock[];
}

interface LessonSource {
  _id: string;
  headline?: string;
  body?: PortableTextBlock[];
  deviceName?: string;
  coveredFeatures?: CoveredFeatureSource[];
  hotspots?: HotspotSource[];
  colorVariants?: ColorVariantSource[];
  dropZones?: DropZoneSource[];
  chips?: ChipSource[];
  scrollChapters?: ScrollChapterSource[];
}

interface QuizAnswerSource {
  _key: string;
  text?: string;
  feedback?: string;
}

interface QuizQuestionSource {
  _key: string;
  questionText?: string;
  answers?: QuizAnswerSource[];
  explanation?: string;
}

interface QuickCheckSource {
  _id: string;
  title?: string;
  instructions?: string;
  questions?: QuizQuestionSource[];
}

interface ChapterSource {
  _id: string;
  title?: string;
  lessons?: LessonSource[];
  quickCheck?: QuickCheckSource;
}

interface SpecificationItemSource {
  _key: string;
  label?: string;
  value?: string;
}

interface SpecificationGroupSource {
  _key: string;
  groupName?: string;
  specs?: SpecificationItemSource[];
}

interface SpecificationSource {
  _id: string;
  title?: string;
  subtitle?: string;
  specGroups?: SpecificationGroupSource[];
  footnotes?: string[];
}

interface DisclaimerSource {
  _id: string;
  title?: string;
  body?: string;
  disclaimers?: string[];
  acknowledgementLabel?: string;
}

interface CourseLocalizationSource {
  _id: string;
  _rev: string;
  title?: string;
  description?: string;
  learningObjectives?: string[];
  coverHeadline?: string;
  coverButtonText?: string;
  chapters?: ChapterSource[];
  specifications?: SpecificationSource[];
  disclaimer?: DisclaimerSource;
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function addPlainTextUnit(
  units: LocalizationUnit[],
  unitId: string,
  sourceText: string | undefined,
  context: string,
): void {
  if (!hasText(sourceText)) return;

  units.push({ unitId, sourceText, kind: 'plainText', context });
}

function addPortableTextUnits(
  units: LocalizationUnit[],
  documentId: string,
  fieldPath: string,
  blocks: PortableTextBlock[] | undefined,
  context: string,
): void {
  for (const block of blocks ?? []) {
    for (const child of block.children ?? []) {
      if (child._type !== 'span' || !hasText(child.text)) continue;

      units.push({
        unitId: `${documentId}:${fieldPath}[${block._key}].children[${child._key}].text`,
        sourceText: child.text,
        kind: 'portableTextSpan',
        context,
      });
    }
  }
}

async function createFingerprint(units: LocalizationUnit[]): Promise<string> {
  const fingerprintPayload = units.map(({ unitId, sourceText, kind }) => ({
    unitId,
    sourceText,
    kind,
  }));
  const encodedPayload = new TextEncoder().encode(JSON.stringify(fingerprintPayload));
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedPayload);

  return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildLocalizationInventory(
  source: CourseLocalizationSource,
): Promise<LocalizationInventory> {
  const units: LocalizationUnit[] = [];
  const courseContext = `Course: ${source.title ?? 'Untitled course'}`;

  addPlainTextUnit(units, `${source._id}:title`, source.title, `${courseContext} / Title`);
  addPlainTextUnit(
    units,
    `${source._id}:description`,
    source.description,
    `${courseContext} / Description`,
  );

  // The existing learningObjectives, specification footnotes, and disclaimer
  // disclaimers arrays contain primitive strings and do not carry Sanity `_key`
  // values. Their positional IDs are therefore the only faithful authored paths;
  // inserting or reordering items intentionally produces a different frozen-source
  // identity.
  for (const [index, objective] of (source.learningObjectives ?? []).entries()) {
    addPlainTextUnit(
      units,
      `${source._id}:learningObjectives[${index}]`,
      objective,
      `${courseContext} / Learning objective ${index + 1}`,
    );
  }

  addPlainTextUnit(
    units,
    `${source._id}:coverHeadline`,
    source.coverHeadline,
    `${courseContext} / Cover headline`,
  );
  addPlainTextUnit(
    units,
    `${source._id}:coverButtonText`,
    source.coverButtonText,
    `${courseContext} / Cover button text`,
  );

  for (const chapter of source.chapters ?? []) {
    const chapterContext = `Chapter: ${chapter.title ?? 'Untitled chapter'}`;
    addPlainTextUnit(units, `${chapter._id}:title`, chapter.title, `${chapterContext} / Title`);

    for (const lesson of chapter.lessons ?? []) {
      const lessonContext = `${chapterContext} / Lesson: ${lesson.headline ?? 'Untitled lesson'}`;
      addPlainTextUnit(units, `${lesson._id}:headline`, lesson.headline, `${lessonContext} / Headline`);
      addPlainTextUnit(
        units,
        `${lesson._id}:deviceName`,
        lesson.deviceName,
        `${lessonContext} / Quick recall topic`,
      );
      addPortableTextUnits(units, lesson._id, 'body', lesson.body, `${lessonContext} / Body`);

      for (const feature of lesson.coveredFeatures ?? []) {
        const featurePath = `coveredFeatures[${feature._key}]`;
        addPlainTextUnit(
          units,
          `${lesson._id}:${featurePath}.label`,
          feature.label,
          `${lessonContext} / Quick recall feature / Prompt`,
        );
        addPlainTextUnit(
          units,
          `${lesson._id}:${featurePath}.summary`,
          feature.summary,
          `${lessonContext} / Quick recall feature / Revealed answer`,
        );
      }

      for (const hotspot of lesson.hotspots ?? []) {
        const hotspotPath = `hotspots[${hotspot._key}]`;
        const hotspotContext = `${lessonContext} / Hotspot`;
        addPlainTextUnit(
          units,
          `${lesson._id}:${hotspotPath}.label`,
          hotspot.label,
          `${hotspotContext} / Label`,
        );
        addPlainTextUnit(
          units,
          `${lesson._id}:${hotspotPath}.topic`,
          hotspot.topic,
          `${hotspotContext} / Topic`,
        );
        addPortableTextUnits(
          units,
          lesson._id,
          `${hotspotPath}.body`,
          hotspot.body,
          `${hotspotContext} / Body`,
        );
      }

      for (const variant of lesson.colorVariants ?? []) {
        const variantPath = `colorVariants[${variant._key}]`;
        addPlainTextUnit(
          units,
          `${lesson._id}:${variantPath}.label`,
          variant.label,
          `${lessonContext} / Color switcher variant / Label`,
        );
      }

      for (const dropZone of lesson.dropZones ?? []) {
        const dropZonePath = `dropZones[${dropZone._key}]`;
        addPlainTextUnit(
          units,
          `${lesson._id}:${dropZonePath}.label`,
          dropZone.label,
          `${lessonContext} / Drag and drop zone / Label`,
        );
      }

      for (const chip of lesson.chips ?? []) {
        const chipPath = `chips[${chip._key}]`;
        addPlainTextUnit(
          units,
          `${lesson._id}:${chipPath}.text`,
          chip.text,
          `${lessonContext} / Drag and drop chip / Text`,
        );
      }

      for (const scrollChapter of lesson.scrollChapters ?? []) {
        const scrollChapterPath = `scrollChapters[${scrollChapter._key}]`;
        const scrollChapterContext = `${lessonContext} / Scroll story chapter`;
        addPlainTextUnit(
          units,
          `${lesson._id}:${scrollChapterPath}.heading`,
          scrollChapter.heading,
          `${scrollChapterContext} / Heading`,
        );
        addPortableTextUnits(
          units,
          lesson._id,
          `${scrollChapterPath}.body`,
          scrollChapter.body,
          `${scrollChapterContext} / Body`,
        );
      }
    }

    const quickCheck = chapter.quickCheck;
    if (!quickCheck) continue;

    const quickCheckContext = `${chapterContext} / Quick check: ${quickCheck.title ?? 'Untitled quick check'}`;
    addPlainTextUnit(
      units,
      `${quickCheck._id}:title`,
      quickCheck.title,
      `${quickCheckContext} / Title`,
    );
    addPlainTextUnit(
      units,
      `${quickCheck._id}:instructions`,
      quickCheck.instructions,
      `${quickCheckContext} / Instructions`,
    );

    for (const question of quickCheck.questions ?? []) {
      const questionPath = `questions[${question._key}]`;
      const questionContext = `${quickCheckContext} / Question`;
      addPlainTextUnit(
        units,
        `${quickCheck._id}:${questionPath}.questionText`,
        question.questionText,
        `${questionContext} / Question text`,
      );

      for (const answer of question.answers ?? []) {
        const answerPath = `${questionPath}.answers[${answer._key}]`;
        addPlainTextUnit(
          units,
          `${quickCheck._id}:${answerPath}.text`,
          answer.text,
          `${questionContext} / Answer`,
        );
        addPlainTextUnit(
          units,
          `${quickCheck._id}:${answerPath}.feedback`,
          answer.feedback,
          `${questionContext} / Answer feedback`,
        );
      }

      addPlainTextUnit(
        units,
        `${quickCheck._id}:${questionPath}.explanation`,
        question.explanation,
        `${questionContext} / Explanation`,
      );
    }
  }

  for (const specification of source.specifications ?? []) {
    const specificationContext = `Specification: ${specification.title ?? 'Untitled specification'}`;
    addPlainTextUnit(
      units,
      `${specification._id}:title`,
      specification.title,
      `${specificationContext} / Title`,
    );
    addPlainTextUnit(
      units,
      `${specification._id}:subtitle`,
      specification.subtitle,
      `${specificationContext} / Subtitle`,
    );

    for (const group of specification.specGroups ?? []) {
      const groupPath = `specGroups[${group._key}]`;
      const groupContext = `${specificationContext} / Specification group`;
      addPlainTextUnit(
        units,
        `${specification._id}:${groupPath}.groupName`,
        group.groupName,
        `${groupContext} / Name`,
      );

      for (const item of group.specs ?? []) {
        const itemPath = `${groupPath}.specs[${item._key}]`;
        addPlainTextUnit(
          units,
          `${specification._id}:${itemPath}.label`,
          item.label,
          `${groupContext} / Specification / Label`,
        );
        addPlainTextUnit(
          units,
          `${specification._id}:${itemPath}.value`,
          item.value,
          `${groupContext} / Specification / Value`,
        );
      }
    }

    for (const [index, footnote] of (specification.footnotes ?? []).entries()) {
      addPlainTextUnit(
        units,
        `${specification._id}:footnotes[${index}]`,
        footnote,
        `${specificationContext} / Footnote ${index + 1}`,
      );
    }
  }

  const disclaimer = source.disclaimer;
  if (disclaimer) {
    const disclaimerContext = `Disclaimer: ${disclaimer.title ?? 'Untitled disclaimer'}`;
    addPlainTextUnit(
      units,
      `${disclaimer._id}:title`,
      disclaimer.title,
      `${disclaimerContext} / Title`,
    );
    addPlainTextUnit(
      units,
      `${disclaimer._id}:body`,
      disclaimer.body,
      `${disclaimerContext} / Body`,
    );

    for (const [index, entry] of (disclaimer.disclaimers ?? []).entries()) {
      addPlainTextUnit(
        units,
        `${disclaimer._id}:disclaimers[${index}]`,
        entry,
        `${disclaimerContext} / Entry ${index + 1}`,
      );
    }

    addPlainTextUnit(
      units,
      `${disclaimer._id}:acknowledgementLabel`,
      disclaimer.acknowledgementLabel,
      `${disclaimerContext} / Acknowledgement button label`,
    );
  }

  return {
    sourceCourseId: source._id,
    sourceRevision: source._rev,
    sourceTitle: source.title ?? '',
    units,
    fingerprint: await createFingerprint(units),
  };
}
