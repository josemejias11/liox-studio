"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { SlideFrame } from "./SlideFrame";
import { Hotspot } from "./Hotspot";
import { SlideLayer } from "./SlideLayer";
import { ProductStage } from "./ProductStage";
import { QuizSlide } from "./QuizSlide";
import { CourseComplete } from "./CourseComplete";
import { NavMap } from "./NavMap";
import { VideoSlide } from "./VideoSlide";
import { useSlideProgress } from "@/hooks/useSlideProgress";

interface SanityHotspot {
  _key: string;
  label: string;
  topic: string;
  body?: string;
  photos?: { asset?: { url?: string } }[];
  x: number;
  y: number;
}

interface SanitySlide {
  _key: string;
  headline: string;
  body?: string;
  slideType: "content" | "interaction" | "stage" | "video" | "quiz";
  media?: { asset?: { url?: string } };
  stageBackground?: { asset?: { url?: string } };
  completionTransition?: "spin" | "rise" | "fade";
  hotspots?: SanityHotspot[];
  videoUrl?: string;
  videoFile?: { asset?: { url?: string } };
  speakerNotes?: string;
  lessonTitle?: string;
}

interface SanityModule {
  _id: string;
  title: string;
}

const TRANSITION_EXIT_MS  = 210;
const TRANSITION_ENTER_MS = 380;

export default function DeckViewer({
  module,
  slides,
}: {
  module: SanityModule;
  slides: SanitySlide[];
}) {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState<{ topic: string; title: string; body?: string } | null>(null);
  const [sessionId, setSessionId] = useState("");
  const { visited, markVisited: baseMarkVisited } = useSlideProgress(sessionId);

  // Phase 10 — transitions + completion
  const [animClass, setAnimClass] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Phase 11 — navigation map
  const [showNavMap, setShowNavMap] = useState(false);
  const toggleNavMap = () => setShowNavMap((v) => !v);

  // Phase 14 — speaker notes
  const [showNotes, setShowNotes] = useState(false);
  const toggleNotes = () => setShowNotes((v) => !v);

  function clearTimers() {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  }

  // Generate or restore anonymous session ID
  useEffect(() => {
    let sid = localStorage.getItem("decktutor_session");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("decktutor_session", sid);
    }
    setSessionId(sid);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => clearTimers, []);

  // Phase 14 — N key toggles speaker notes (when no text input is focused)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "n" || e.key === "N") setShowNotes((v) => !v);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const currentSlide = slides[currentSlideIndex];
  const slideKey = currentSlide?._key ?? "";
  const hotspots = currentSlide?.hotspots ?? [];
  const visitedOnSlide = visited[slideKey]?.size ?? 0;
  const nextLocked = hotspots.length > 0 && visitedOnSlide < hotspots.length;
  const imageUrl = currentSlide?.media?.asset?.url;

  // Stats for completion screen
  const totalHotspotsVisited = Object.values(visited).reduce((sum, s) => sum + s.size, 0);
  const totalHotspots = slides.reduce((sum, s) => sum + (s.hotspots?.length ?? 0), 0);

  function markVisited(label: string) {
    baseMarkVisited(slideKey, label, hotspots.length);
  }

  // ── Transition helper ──────────────────────────────────────────────────────
  function transitionTo(action: () => void, dir: "forward" | "backward") {
    clearTimers();
    setAnimClass(`slide-exit-${dir}`);
    const t1 = setTimeout(() => {
      action();
      setAnimClass(`slide-enter-${dir}`);
      const t2 = setTimeout(() => setAnimClass(""), TRANSITION_ENTER_MS);
      timerRefs.current = [t2];
    }, TRANSITION_EXIT_MS);
    timerRefs.current = [t1];
  }

  function navigate(targetIndex: number) {
    const dir = targetIndex > currentSlideIndex ? "forward" : "backward";
    transitionTo(() => {
      setCurrentSlideIndex(targetIndex);
      setActiveLayer(null);
    }, dir);
  }

  function goNext() {
    if (nextLocked) return;
    if (currentSlideIndex >= slides.length - 1) {
      transitionTo(() => setIsComplete(true), "forward");
      return;
    }
    navigate(currentSlideIndex + 1);
  }

  function goPrev() {
    if (isComplete) {
      transitionTo(() => {
        setIsComplete(false);
        setCurrentSlideIndex(slides.length - 1);
        setActiveLayer(null);
      }, "backward");
      return;
    }
    if (currentSlideIndex <= 0) return;
    navigate(currentSlideIndex - 1);
  }

  // ── Nav map overlay (rendered inside each post-cover SlideFrame) ──────────
  const navMapEl = showNavMap ? (
    <NavMap
      slides={slides}
      currentIndex={isComplete ? slides.length : currentSlideIndex}
      visited={visited}
      onNavigate={(i) => {
        setShowNavMap(false);
        if (isComplete) {
          transitionTo(() => {
            setIsComplete(false);
            setCurrentSlideIndex(i);
            setActiveLayer(null);
          }, "backward");
        } else {
          navigate(i);
        }
      }}
      onClose={() => setShowNavMap(false)}
    />
  ) : null;

  // ── Cover ──────────────────────────────────────────────────────────────────
  if (!hasStarted) {
    const coverImage = slides[0]?.media?.asset?.url;
    return (
      <SlideFrame>
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="Course cover" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
            <p className="text-white text-2xl font-light">{module.title}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        <button
          onClick={() => setHasStarted(true)}
          className="absolute bottom-8 right-8 flex items-center gap-2 bg-white text-zinc-900 font-semibold text-sm px-5 py-2.5 rounded-sm shadow-xl hover:bg-zinc-100 active:scale-95 transition-all"
        >
          start course <ChevronRight className="h-4 w-4" />
        </button>
      </SlideFrame>
    );
  }

  // ── Course completion ──────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <SlideFrame onToggleNavMap={toggleNavMap} onToggleNotes={toggleNotes} notesOpen={showNotes}>
        <div className={`absolute inset-0 ${animClass}`}>
          <CourseComplete
            moduleTitle={module.title}
            totalSlides={slides.length}
            totalHotspotsVisited={totalHotspotsVisited}
            totalHotspots={totalHotspots}
            onRestart={() => {
              transitionTo(() => {
                setIsComplete(false);
                setCurrentSlideIndex(0);
                setActiveLayer(null);
              }, "forward");
            }}
          />
        </div>
        {navMapEl}
      </SlideFrame>
    );
  }

  // ── Product Stage slide ────────────────────────────────────────────────────
  if (currentSlide?.slideType === "stage") {
    return (
      <SlideFrame onToggleNavMap={toggleNavMap} onToggleNotes={toggleNotes} notesOpen={showNotes} speakerNotes={currentSlide.speakerNotes}>
        <div className={`absolute inset-0 ${animClass}`}>
          <ProductStage
            headline={currentSlide.headline}
            productImage={currentSlide.media?.asset?.url}
            stageBackground={currentSlide.stageBackground?.asset?.url}
            completionTransition={currentSlide.completionTransition}
            hotspots={hotspots}
            visited={visited[slideKey] ?? new Set()}
            onVisit={markVisited}
            onNext={goNext}
          />
        </div>
        {navMapEl}
      </SlideFrame>
    );
  }

  // ── Video slide ────────────────────────────────────────────────────────────
  if (currentSlide?.slideType === "video") {
    return (
      <SlideFrame onToggleNavMap={toggleNavMap} onToggleNotes={toggleNotes} notesOpen={showNotes} speakerNotes={currentSlide.speakerNotes}>
        <div className={`absolute inset-0 ${animClass}`}>
          <VideoSlide
            headline={currentSlide.headline}
            videoUrl={currentSlide.videoUrl}
            videoFileUrl={currentSlide.videoFile?.asset?.url}
            onNext={goNext}
          />
        </div>
        {navMapEl}
      </SlideFrame>
    );
  }

  // ── Quiz slide ─────────────────────────────────────────────────────────────
  if (currentSlide?.slideType === "quiz") {
    const quizContext = [
      `Product: ${module.title}`,
      `Features: ${slides
        .flatMap((s) => s.hotspots ?? [])
        .map((h) => h.topic || h.label)
        .filter(Boolean)
        .join(", ")}`,
      `Explored by learner: ${Object.values(visited)
        .flatMap((labels) => Array.from(labels))
        .join(", ") || "none yet"}`,
    ].join("\n");

    return (
      <SlideFrame onToggleNavMap={toggleNavMap} onToggleNotes={toggleNotes} notesOpen={showNotes} speakerNotes={currentSlide.speakerNotes}>
        <div className={`absolute inset-0 ${animClass}`}>
          <QuizSlide context={quizContext} onNext={goNext} sessionId={sessionId} moduleId={module._id} />
        </div>
        {navMapEl}
      </SlideFrame>
    );
  }

  // ── Regular slides ─────────────────────────────────────────────────────────
  return (
    <SlideFrame
      currentSlide={currentSlideIndex + 1}
      totalSlides={slides.length}
      onPrev={goPrev}
      onNext={goNext}
      nextDisabled={nextLocked}
      onToggleNavMap={toggleNavMap}
      onToggleNotes={toggleNotes}
      notesOpen={showNotes}
      speakerNotes={currentSlide?.speakerNotes}
      completionHint={
        nextLocked
          ? `Tap all ${hotspots.length} features to continue (${visitedOnSlide} / ${hotspots.length})`
          : undefined
      }
    >
      <div className={`absolute inset-0 ${animClass}`}>
        {/* Slide content — image from Sanity CDN or text fallback */}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={currentSlide.headline} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-white flex flex-col items-start justify-center p-[6%] overflow-auto gap-4">
            <h2 className="text-zinc-900 text-2xl font-semibold leading-tight">{currentSlide?.headline}</h2>
            {currentSlide?.body && (
              <p className="text-zinc-600 text-base font-light leading-relaxed whitespace-pre-wrap">{currentSlide.body}</p>
            )}
          </div>
        )}

        {/* Hotspots — driven directly from Sanity content */}
        {hotspots.map((h) => (
          <Hotspot
            key={h._key}
            x={h.x}
            y={h.y}
            label={h.label}
            visited={visited[slideKey]?.has(h.label) ?? false}
            onVisit={() => markVisited(h.label)}
            onOpen={() => setActiveLayer({ topic: h.topic, title: h.label, body: h.body })}
          />
        ))}

        {/* AI Layer */}
        <SlideLayer
          open={activeLayer !== null}
          onClose={() => setActiveLayer(null)}
          title={activeLayer?.title ?? ""}
          topic={activeLayer?.topic}
          body={activeLayer?.body}
        />
      </div>
      {navMapEl}
    </SlideFrame>
  );
}
