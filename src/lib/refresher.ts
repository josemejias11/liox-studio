type RefresherLesson = {
  coveredFeatures?: Array<{ label: string }>;
};

export function getCoveredFeatureLabels(lesson: RefresherLesson): string[] {
  return (lesson.coveredFeatures ?? []).map((feature) => feature.label).filter(Boolean);
}

export function isRefresherComplete(lesson: RefresherLesson, visited: Set<string>): boolean {
  const labels = getCoveredFeatureLabels(lesson);
  return labels.length > 0 && labels.every((label) => visited.has(label));
}
