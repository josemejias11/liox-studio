export const BLOCK_CATALOG = [
  { type: 'content', title: 'Content', description: 'Focused explanatory screen with optional learning recall.' },
  { type: 'interaction', title: 'Hotspot exploration', description: 'Learners inspect labelled product details.' },
  { type: 'stage', title: 'Product stage', description: 'Guided product storytelling with progressive callouts.' },
  { type: 'video', title: 'Video', description: 'A focused video learning moment.' },
  { type: 'quiz', title: 'In-lesson quiz', description: 'Practice challenge in the learner flow.' },
  { type: 'canvas', title: 'Canvas inspection', description: 'Spatial product inspection with required targets.' },
  { type: 'colorSwitcher', title: 'Colour switcher', description: 'Compare product colour variants.' },
  { type: 'splitScreen', title: 'Split screen', description: 'Compare two complementary content areas.' },
  { type: 'dragDrop', title: 'Drag and drop', description: 'Active classification or matching practice.' },
  { type: 'scrollStory', title: 'Scroll story', description: 'A paced visual narrative with scrolling chapters.' },
] as const;

export type BlockType = (typeof BLOCK_CATALOG)[number]['type'];

export function createLessonDefaults(type: BlockType): Record<string, unknown> {
  const block = BLOCK_CATALOG.find((candidate) => candidate.type === type);
  return {
    headline: `New ${block?.title ?? 'learning'} screen`,
    lessonType: type,
    ...(type === 'canvas' ? { hotspots: [] } : {}),
    ...(type === 'dragDrop' ? { chips: [], dropZones: [] } : {}),
    ...(type === 'scrollStory' ? { scrollChapters: [] } : {}),
    ...(type === 'colorSwitcher' ? { colorVariants: [] } : {}),
  };
}
