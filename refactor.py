import os
import re

file_path = "/Users/josemejias/Workbench-QA/eLe-ai/web/src/components/MotoViewer.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Add AnimatedLessonSlide component
slide_component = """// ── Framer Motion slide variants ─────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "50%" : "-50%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "50%" : "-50%",
    opacity: 0,
  }),
};

function AnimatedLessonSlide({
  children,
  navDirection,
  slideKey,
}: {
  children: React.ReactNode;
  navDirection: number;
  slideKey: string;
}) {
  return (
    <AnimatePresence mode="wait" custom={navDirection}>
      <motion.div
        key={slideKey}
        custom={navDirection}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="absolute inset-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}"""

content = content.replace(
    """// ── Framer Motion slide variants ─────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "50%" : "-50%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "50%" : "-50%",
    opacity: 0,
  }),
};""", slide_component)

# 2. Add navigation helpers
nav_helpers = """  // ── Helpers for repeated navigation logic ──────────────────────────────────
  function advanceToPostChapterPhase() {
    if (specSections.length > 0) {
      setCoursePhase({ phase: "specifications", specIndex: 0 });
    } else if (quizSection) {
      setCoursePhase({ phase: "quiz", quizData: quizSection });
    } else if (disclaimerSection) {
      setCoursePhase({ phase: "disclaimer" });
    } else {
      triggerComplete();
    }
  }

  function goBackToLastChapterOrCover() {
    const lastChapter = chapters[chapters.length - 1];
    if (lastChapter) {
      const lastChapterLessons = lessonSections.filter(
        (ls) => ls.chapterIndex === lastChapter.chapterIndex
      );
      setCoursePhase({
        phase: "chapter",
        chapterIndex: lastChapter.chapterIndex,
        lessonIndex: Math.max(0, lastChapterLessons.length - 1),
      });
    } else {
      setCoursePhase({ phase: "cover" });
    }
  }

  // ── Navigation: goNext ────────────────────────────────────────────────────"""

content = content.replace("  // ── Navigation: goNext ────────────────────────────────────────────────────", nav_helpers)

# 3. Replace duplicated goNext blocks
go_next_block1 = """      if (lessonSections.length > 0) {
        setCoursePhase({ phase: "chapter", chapterIndex: 0, lessonIndex: 0 });
      } else if (specSections.length > 0) {
        setCoursePhase({ phase: "specifications", specIndex: 0 });
      } else if (quizSection) {
        setCoursePhase({ phase: "quiz", quizData: quizSection });
      } else if (disclaimerSection) {
        setCoursePhase({ phase: "disclaimer" });
      } else {
        triggerComplete();
      }"""

go_next_block1_rep = """      if (lessonSections.length > 0) {
        setCoursePhase({ phase: "chapter", chapterIndex: 0, lessonIndex: 0 });
      } else {
        advanceToPostChapterPhase();
      }"""

content = content.replace(go_next_block1, go_next_block1_rep)

go_next_block2 = """      // No more chapters — advance to specifications, quiz, disclaimer, or complete
      if (specSections.length > 0) {
        setCoursePhase({ phase: "specifications", specIndex: 0 });
      } else if (quizSection) {
        setCoursePhase({ phase: "quiz", quizData: quizSection });
      } else if (disclaimerSection) {
        setCoursePhase({ phase: "disclaimer" });
      } else {
        triggerComplete();
      }"""

go_next_block2_rep = """      // No more chapters — advance to specifications, quiz, disclaimer, or complete
      advanceToPostChapterPhase();"""

content = content.replace(go_next_block2, go_next_block2_rep)

go_next_block3 = """      if (specIndex < specSections.length - 1) {
        setCoursePhase({ phase: "specifications", specIndex: specIndex + 1 });
      } else if (quizSection) {
        setCoursePhase({ phase: "quiz", quizData: quizSection });
      } else if (disclaimerSection) {
        setCoursePhase({ phase: "disclaimer" });
      } else {
        triggerComplete();
      }"""

go_next_block3_rep = """      if (specIndex < specSections.length - 1) {
        setCoursePhase({ phase: "specifications", specIndex: specIndex + 1 });
      } else {
        advanceToPostChapterPhase();
      }"""

content = content.replace(go_next_block3, go_next_block3_rep)


# 4. Replace duplicated goPrev blocks
go_prev_block = """      // First spec — go to last lesson of last chapter (or cover)
      const lastChapter = chapters[chapters.length - 1];
      if (lastChapter) {
        const lastChapterLessons = lessonSections.filter(
          (ls) => ls.chapterIndex === lastChapter.chapterIndex
        );
        setCoursePhase({
          phase: "chapter",
          chapterIndex: lastChapter.chapterIndex,
          lessonIndex: Math.max(0, lastChapterLessons.length - 1),
        });
      } else {
        setCoursePhase({ phase: "cover" });
      }"""

go_prev_block_rep = """      // First spec — go to last lesson of last chapter (or cover)
      goBackToLastChapterOrCover();"""
content = content.replace(go_prev_block, go_prev_block_rep)


go_prev_block2 = """      if (specSections.length > 0) {
        setCoursePhase({ phase: "specifications", specIndex: specSections.length - 1 });
      } else {
        const lastChapter = chapters[chapters.length - 1];
        if (lastChapter) {
          const lastChapterLessons = lessonSections.filter(
            (ls) => ls.chapterIndex === lastChapter.chapterIndex
          );
          setCoursePhase({
            phase: "chapter",
            chapterIndex: lastChapter.chapterIndex,
            lessonIndex: Math.max(0, lastChapterLessons.length - 1),
          });
        } else {
          setCoursePhase({ phase: "cover" });
        }
      }"""

go_prev_block2_rep = """      if (specSections.length > 0) {
        setCoursePhase({ phase: "specifications", specIndex: specSections.length - 1 });
      } else {
        goBackToLastChapterOrCover();
      }"""

# This block happens 3 times (quiz, disclaimer, complete)
content = content.replace(go_prev_block2, go_prev_block2_rep)


# 5. Replace AnimatePresence boilerplates

def replacer(match):
    key = match.group(1)
    # remove curly braces and quotes for slideKey
    key_clean = key.replace("{", "").replace("}", "").replace('"', "").replace("'", "").replace("`", "")
    inner = match.group(2)
    return '<AnimatedLessonSlide navDirection={navDirection} slideKey={`' + key_clean + '`}>\n' + inner + '            </AnimatedLessonSlide>'

pattern = re.compile(
    r'<AnimatePresence mode="wait" custom=\{navDirection\}>\s*<motion\.div\s*key=(\{?[^>]+?\}?)\s*custom=\{navDirection\}\s*variants=\{slideVariants\}\s*initial="enter"\s*animate="center"\s*exit="exit"\s*transition=\{\{ duration: 0\.35, ease: \[0\.32, 0\.72, 0, 1\] \}\}\s*className="absolute inset-0"\s*>\s*(.*?)\s*</motion\.div>\s*</AnimatePresence>',
    re.DOTALL
)

content = pattern.sub(replacer, content)

with open(file_path, "w") as f:
    f.write(content)
