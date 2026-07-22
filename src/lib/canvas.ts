export const CANVAS_LESSON_TYPE = 'canvas' as const;
export const MIN_CANVAS_ZOOM = 1;
export const MAX_CANVAS_ZOOM = 3;

type CanvasLesson = {
  lessonType?: string;
  hotspots?: Array<{ label: string; required?: boolean }>;
};

export function getRequiredCanvasTargetCount(lesson: CanvasLesson): number {
  return lesson.lessonType === CANVAS_LESSON_TYPE
    ? (lesson.hotspots ?? []).filter((target) => target.required).length
    : 0;
}

export function isCanvasComplete(lesson: CanvasLesson, visited: Set<string>): boolean {
  const requiredLabels = (lesson.hotspots ?? [])
    .filter((target) => target.required)
    .map((target) => target.label);

  return requiredLabels.length > 0 && requiredLabels.every((label) => visited.has(label));
}

export function clampCanvasZoom(zoom: number): number {
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, zoom));
}
