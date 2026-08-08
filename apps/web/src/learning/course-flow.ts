import type { CourseSection, CourseContent } from '@/shared/contracts/player-course';
import { deriveCourseStructure } from '@/learning/course-structure';

export type CourseFlowItem =
  | { kind: 'lesson'; key: string; index: number; title: string }
  | { kind: 'specification'; key: string; index: number; title: string }
  | { kind: 'disclaimer'; key: string; index: number; title: string };

export interface CourseFlow {
  structure: ReturnType<typeof deriveCourseStructure>;
  items: CourseFlowItem[];
}

export function deriveCourseFlow(
  sections: CourseSection[],
  chapters: CourseContent['chapters'] = [],
): CourseFlow {
  const structure = deriveCourseStructure(sections, chapters);
  const items: CourseFlowItem[] = [];

  for (const section of structure.lessonSections) {
    items.push({
      kind: 'lesson',
      key: section._key,
      index: items.length,
      title: section.headline,
    });
  }

  for (const [index, section] of structure.specSections.entries()) {
    items.push({
      kind: 'specification',
      key: section._key ?? `spec-${index}`,
      index: items.length,
      title: section.title,
    });
  }

  if (structure.disclaimerSection) {
    items.push({
      kind: 'disclaimer',
      key: structure.disclaimerSection._key ?? 'disclaimer',
      index: items.length,
      title: structure.disclaimerSection.title ?? 'Disclaimer',
    });
  }

  return { structure, items };
}

export function getNavItems(flow: CourseFlow): CourseFlowItem[] {
  return flow.items;
}

export function getFlowItemByIndex(flow: CourseFlow, index: number): CourseFlowItem | undefined {
  return flow.items[index];
}
