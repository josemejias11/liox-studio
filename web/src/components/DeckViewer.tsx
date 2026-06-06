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
  theme?: "frost-black" | "black-frost" | "pearl-black" | "black-pearl" | "indigo-frost";
}

interface SanityModule {
  _id: string;
  title: string;
  thumbnail?: { asset?: { url?: string } };
  coverImage?: { asset?: { url?: string } };
  coverHeadline?: string;
  coverButtonText?: string;
  coverButtonColor?: string;
  learningObjectives?: string[];
}

const SLIDE_THEMES = {
  "frost-black":  { bg: "bg-moto-frost",  headline: "text-moto-black",  body: "text-moto-slate"     },
  "black-frost":  { bg: "bg-moto-black",  headline: "text-moto-frost",  body: "text-moto-slate"     },
  "pearl-black":  { bg: "bg-moto-pearl",  headline: "text-moto-black",  body: "text-moto-sandstone" },
  "black-pearl":  { bg: "bg-moto-black",  headline: "text-moto-pearl",  body: "text-moto-sandstone" },
  "indigo-frost": { bg: "bg-moto-indigo", headline: "text-moto-frost",  body: "text-moto-frost"     },
} as const;

type SlideTheme = keyof typeof SLIDE_THEMES;

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
    const finalImageUrl = module.coverImage?.asset?.url || module.thumbnail?.asset?.url || slides[0]?.media?.asset?.url;
    const finalHeadline = module.coverHeadline || module.title;
    const buttonText = module.coverButtonText || "start course";
    
    // Map button colors — Motorola 2026 brand palette only
    let btnClass = "bg-moto-black text-moto-frost hover:bg-moto-black/90 border-transparent";
    if (module.coverButtonColor === "moto-indigo") btnClass = "bg-moto-indigo text-moto-frost hover:bg-moto-indigo/90 border-transparent";
    else if (module.coverButtonColor === "moto-frost") btnClass = "bg-moto-frost text-moto-black hover:bg-moto-frost/90 border-transparent";
    else if (module.coverButtonColor === "moto-pearl") btnClass = "bg-moto-pearl text-moto-black hover:bg-moto-pearl/90 border-transparent";

    return (
      <SlideFrame moduleTitle={module.title}>
        {finalImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={finalImageUrl} alt="Course cover" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-moto-black flex items-center justify-center" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 pointer-events-none">
          <h1 className="text-4xl md:text-6xl font-bold text-moto-frost text-center drop-shadow-2xl max-w-4xl tracking-tight">
            {finalHeadline}
          </h1>
          
          {module.learningObjectives && module.learningObjectives.length > 0 && (
            <div className="mt-8 w-full max-w-2xl bg-moto-black/40 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-moto-white/20 shadow-2xl">
              <h3 className="text-moto-frost uppercase tracking-[0.2em] text-xs font-bold mb-4 text-center">What you will learn</h3>
              <ul className="text-moto-white text-lg md:text-xl space-y-3">
                {module.learningObjectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-3 text-left">
                    <span className="text-moto-indigo mt-1">✓</span>
                    <span className="drop-shadow-sm font-medium">{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          onClick={() => setHasStarted(true)}
          className={`absolute bottom-8 md:bottom-12 right-8 md:right-12 flex items-center gap-2 font-semibold text-base px-6 py-3 rounded-full shadow-2xl transition-all active:scale-95 z-20 hover:-translate-y-1 ${btnClass}`}
        >
          {buttonText} <ChevronRight className="h-5 w-5" />
        </button>
      </SlideFrame>
    );
  }

  // ── Course completion ──────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <SlideFrame onToggleNavMap={toggleNavMap} onToggleNotes={toggleNotes} notesOpen={showNotes} moduleTitle={module.title}>
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
      <SlideFrame onToggleNavMap={toggleNavMap} onToggleNotes={toggleNotes} notesOpen={showNotes} speakerNotes={currentSlide.speakerNotes} moduleTitle={module.title}>
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
      <SlideFrame onToggleNavMap={toggleNavMap} onToggleNotes={toggleNotes} notesOpen={showNotes} speakerNotes={currentSlide.speakerNotes} moduleTitle={module.title}>
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
      <SlideFrame onToggleNavMap={toggleNavMap} onToggleNotes={toggleNotes} notesOpen={showNotes} speakerNotes={currentSlide.speakerNotes} moduleTitle={module.title}>
        <div className={`absolute inset-0 ${animClass}`}>
          <QuizSlide context={quizContext} onNext={goNext} sessionId={sessionId} moduleId={module._id} />
        </div>
        {navMapEl}
      </SlideFrame>
    );
  }

  // ── Regular slides ─────────────────────────────────────────────────────────
  const rawTheme = currentSlide?.theme;
  const slideTheme: SlideTheme = rawTheme && rawTheme in SLIDE_THEMES ? rawTheme as SlideTheme : "frost-black";
  const tc = SLIDE_THEMES[slideTheme];

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
      theme={slideTheme}
      moduleTitle={module.title}
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
          <div className={`absolute inset-0 ${tc.bg} flex flex-col items-start justify-center p-[6%] overflow-auto gap-4`}>
            <h2 className={`${tc.headline} text-2xl font-semibold leading-tight`}>{currentSlide?.headline}</h2>
            {currentSlide?.body && (
              <p className={`${tc.body} text-base font-light leading-relaxed whitespace-pre-wrap`}>{currentSlide.body}</p>
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
