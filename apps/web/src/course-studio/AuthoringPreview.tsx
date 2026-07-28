'use client';

import MotoViewer from '@/player/MotoViewer';
import type { NormalizedCourseContent } from '@/lib/course-content';

export function AuthoringPreview({ content }: { content: NormalizedCourseContent }) {
  return <div className="aspect-video w-full overflow-hidden rounded-xl border border-border"><MotoViewer course={content.course} sections={content.sections} preview /></div>;
}
