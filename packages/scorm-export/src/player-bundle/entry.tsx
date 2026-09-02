import { createRoot } from 'react-dom/client';
import MotoViewer from '@/learning/player/MotoViewer';
import type { CourseContent, CourseSection } from '@/shared/contracts/player-course';
import type { OfflineAssistantPayload } from '@lb-studio/contracts';
import { ScormBridge } from './scorm-api';

// styles.css is NOT imported here on purpose: it is compiled to dist/player.css by a
// dedicated PostCSS + Tailwind step in scripts/build-player.mjs and linked separately
// from the generated HTML. Tailwind v4's `@import 'tailwindcss'` (and the tw-animate-css /
// shadcn imports) are magic strings resolved by @tailwindcss/postcss's own resolver, not
// generic CSS the JS bundler's built-in CSS loader can follow — importing it from this
// entry point makes esbuild try (and fail) to resolve those same imports itself.

interface CourseDataPayload {
  content: { course: CourseContent; sections: CourseSection[] };
  assistant: OfflineAssistantPayload | undefined;
}

function readCoursePayload(): CourseDataPayload {
  const script = document.getElementById('course-data');
  if (!script?.textContent) throw new Error('Course data payload missing.');
  return JSON.parse(script.textContent) as CourseDataPayload;
}

function mount(): void {
  const container = document.getElementById('app');
  if (!container) throw new Error('Mount point #app missing.');

  const payload = readCoursePayload();
  const bridge = new ScormBridge();
  bridge.connect();

  const savedBookmark = bridge.getBookmark() || undefined;

  const root = createRoot(container);
  root.render(
    <MotoViewer
      course={payload.content.course}
      sections={payload.content.sections}
      preview
      bypassNavigationLocks={false}
      initialSectionKey={savedBookmark}
      assistant={payload.assistant ?? undefined}
      onLessonChange={(lessonKey) => {
        bridge.reportInProgress();
        bridge.setBookmark(lessonKey);
      }}
      onFinalQuizResult={(result) => bridge.reportQuizResult(result)}
      onCourseComplete={() => bridge.reportComplete()}
    />,
  );

  window.addEventListener('beforeunload', () => bridge.finish());
}

mount();
