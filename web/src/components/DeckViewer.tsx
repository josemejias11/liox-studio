"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, PlayCircle, MousePointer2, Layers, Plus } from "lucide-react";
import { LessonFrame } from "./LessonFrame";
import { Hotspot } from "./Hotspot";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { ProductStage } from "./ProductStage";
import { QuizLesson } from "./QuizLesson";
import { CourseComplete } from "./CourseComplete";
import { NavMap } from "./NavMap";
import { FullWidthCarousel } from "./FullWidthCarousel";
import { VideoLesson } from "./VideoLesson";
import { useLessonProgress } from "@/hooks/useLessonProgress";
import { LayerFrame } from "./LayerFrame";
import { PortableText } from "@portabletext/react";

interface SanityLayerContent {
  _key: string;
  headline: string;
  body?: any;
  layerType: "content" | "interaction" | "video" | "quiz";
  media?: { asset?: { url?: string } };
  photos?: { asset?: { url?: string } }[];
  hotspots?: SanityHotspot[];
  textOverlay?: { x?: number; y?: number; width?: string };
  videoUrl?: string;
  videoFile?: { asset?: { url?: string } };
}

interface SanityHotspot {
  _key: string;
  label: string;
  topic: string;
  x: number;
  y: number;
  contentMode?: "tooltip" | "layer";
  layerContent?: SanityLayerContent;
  body?: any;
  photos?: { asset?: { url?: string } }[];
}

interface SanityLesson {
  _key: string;
  headline: string;
  body?: any;
  lessonType: "content" | "interaction" | "stage" | "video" | "quiz";
  media?: { asset?: { url?: string } };
  textOverlay?: {
    x?: number;
    y?: number;
    width?: string;
  };
  stageBackground?: { asset?: { url?: string } };
  completionTransition?: "spin" | "rise" | "fade";
  hotspots?: SanityHotspot[];
  textHotspots?: { _key: string; triggerWord: string; linkedLayer: string }[];
  videoUrl?: string;
  videoFile?: { asset?: { url?: string } };
  chapterTitle?: string;
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

const TRANSITION_EXIT_MS  = 210;
const TRANSITION_ENTER_MS = 380;

const getSemanticWidthClass = (width?: string) => {
  switch (width) {
    case "small": return "max-w-sm";
    case "medium": return "max-w-md";
    case "large": return "max-w-lg";
    case "full": return "max-w-full";
    default: return width || "max-w-xl";
  }
};

export default function DeckViewer({
  module,
  lessons,
}: {
  module: SanityModule;
  lessons: SanityLesson[];
}) {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState<{ topic: string; title: string; body?: string; x?: number; y?: number } | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const lastLayerIdRef = useRef<string | null>(null);
  if (activeLayerId && activeLayerId !== lastLayerIdRef.current) {
    lastLayerIdRef.current = activeLayerId;
  }
  const [sessionId, setSessionId] = useState("");
  const { visited, markVisited: baseMarkVisited } = useLessonProgress(sessionId);

  // Phase 10 — transitions + completion
  const [animClass, setAnimClass] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [showNavMap, setShowNavMap] = useState(false);
  const toggleNavMap = () => setShowNavMap((v) => !v);

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

  const currentLesson = lessons[currentLessonIndex];
  const lessonKey = currentLesson?._key ?? "";
  const hotspots = currentLesson?.hotspots ?? [];
  
  // A lesson is locked until all hotspots are visited
  const visitedOnLesson = visited[lessonKey]?.size ?? 0;
  const missingHotspots = hotspots.filter(h => !(visited[lessonKey]?.has(h.label)));
  const nextLocked = (hotspots.length > 0 && missingHotspots.length > 0);
  
  const imageUrl = currentLesson?.media?.asset?.url;

  // Stats for completion screen
  const totalHotspotsVisited = Object.values(visited).reduce((sum, s) => sum + s.size, 0);
  const totalHotspots = lessons.reduce((sum, s) => sum + (s.hotspots?.length ?? 0), 0);

  function markVisited(label: string) {
    baseMarkVisited(lessonKey, label, hotspots.length);
  }

  const portableTextComponents = {
    marks: {
      layerLink: ({ children, value }: any) => {
        return (
          <button
            onClick={() => {
              const hotspot = hotspots.find(h => h.label === value?.linkedLayer && h.contentMode === "layer");
              if (hotspot) {
                baseMarkVisited(lessonKey, hotspot.label, hotspots.length);
                setActiveLayerId(hotspot._key);
              } else {
                console.warn(`Layer link failed: No layer found with headline "${value?.linkedLayer}"`);
                alert(`Content missing: Could not find layer "${value?.linkedLayer}"`);
              }
            }}
            className="text-accent font-medium underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors mx-1"
          >
            {children}
          </button>
        );
      }
    }
  };

  // ── Transition helper ──────────────────────────────────────────────────────
  function transitionTo(action: () => void, dir: "forward" | "backward") {
    clearTimers();
    setAnimClass(`lesson-exit-${dir}`);
    const t1 = setTimeout(() => {
      action();
      setAnimClass(`lesson-enter-${dir}`);
      const t2 = setTimeout(() => setAnimClass(""), TRANSITION_ENTER_MS);
      timerRefs.current = [t2];
    }, TRANSITION_EXIT_MS);
    timerRefs.current = [t1];
  }

  function navigate(targetIndex: number) {
    const dir = targetIndex > currentLessonIndex ? "forward" : "backward";
    transitionTo(() => {
      setCurrentLessonIndex(targetIndex);
      setActiveLayer(null);
    }, dir);
  }

  function goNext() {
    if (nextLocked) return;
    if (currentLessonIndex >= lessons.length - 1) {
      transitionTo(() => setIsComplete(true), "forward");
      return;
    }
    navigate(currentLessonIndex + 1);
  }

  function goPrev() {
    if (isComplete) {
      transitionTo(() => {
        setIsComplete(false);
        setCurrentLessonIndex(lessons.length - 1);
        setActiveLayer(null);
      }, "backward");
      return;
    }
    if (currentLessonIndex <= 0) return;
    navigate(currentLessonIndex - 1);
  }

  // ── Nav map overlay (rendered inside each post-cover LessonFrame) ──────────
  const navMapEl = showNavMap ? (
    <NavMap
      lessons={lessons}
      currentIndex={isComplete ? lessons.length : currentLessonIndex}
      visited={visited}
      onNavigate={(i) => {
        setShowNavMap(false);
        if (isComplete) {
          transitionTo(() => {
            setIsComplete(false);
            setCurrentLessonIndex(i);
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
    const finalImageUrl = module.coverImage?.asset?.url || module.thumbnail?.asset?.url || lessons[0]?.media?.asset?.url;
    const finalHeadline = module.coverHeadline || module.title;
    const buttonText = module.coverButtonText || "start course";
    
    // Map button colors — Motorola 2026 brand palette only
    let btnClass = "bg-background text-foreground hover:bg-background/90";
    if (module.coverButtonColor === "moto-indigo") btnClass = "bg-accent text-foreground hover:bg-accent/90";
    else if (module.coverButtonColor === "moto-frost") btnClass = "bg-background text-foreground hover:bg-background/90";
    else if (module.coverButtonColor === "moto-pearl") btnClass = "bg-card text-foreground hover:bg-card/90";

    return (
      <LessonFrame moduleTitle={module.title}>
        {finalImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={finalImageUrl} alt="Course cover" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-background flex items-center justify-center" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 pointer-events-none dark">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground text-center drop-shadow-2xl max-w-4xl tracking-tight">
            {finalHeadline}
          </h1>
          
          {module.learningObjectives && module.learningObjectives.length > 0 && (
            <div className="mt-8 w-full max-w-2xl relative">
              {/* Ambient indigo glow — floats the card off the hero */}
              <div className="absolute inset-0 rounded-3xl bg-accent/10 blur-2xl pointer-events-none" />

              <div className="relative bg-gradient-to-br from-white/5 via-background/55 to-background/70 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl overflow-hidden">
                {/* Top edge accent line */}
                <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-accent/55 to-transparent" />

                {/* Label row with flanking lines */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/35" />
                  <h3 className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground font-semibold shrink-0 select-none">
                    What you will learn
                  </h3>
                  <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/35" />
                </div>

                {/* Objectives list */}
                <ul className="space-y-3.5">
                  {module.learningObjectives.map((obj, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3.5 text-left stage-rise"
                      style={{ animationDelay: `${0.08 + i * 0.07}s`, animationFillMode: "both" }}
                    >
                      <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 ring-1 ring-inset ring-accent/45 text-accent text-[9px] font-bold leading-none select-none">
                        ✓
                      </span>
                      <span className="text-foreground/90 text-base md:text-lg font-medium leading-snug">
                        {obj}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setHasStarted(true)}
          className={`absolute bottom-8 md:bottom-12 right-8 md:right-12 flex items-center gap-2 font-semibold text-base px-6 py-3 rounded-full shadow-2xl transition-all active:scale-95 z-20 hover:shadow-[0_0_24px_rgba(104,91,199,0.75)] border-none outline-none ${btnClass}`}
        >
          {buttonText} <ChevronRight className="h-5 w-5" />
        </button>
      </LessonFrame>
    );
  }

  // ── Course completion ──────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={module.title}>
        <div className={`absolute inset-0 ${animClass}`}>
          <CourseComplete
            moduleTitle={module.title}
            totalLessons={lessons.length}
            totalHotspotsVisited={totalHotspotsVisited}
            totalHotspots={totalHotspots}
            onRestart={() => {
              transitionTo(() => {
                setIsComplete(false);
                setCurrentLessonIndex(0);
                setActiveLayer(null);
              }, "forward");
            }}
          />
        </div>
        {navMapEl}
      </LessonFrame>
    );
  }

  // ── Product Stage lesson ────────────────────────────────────────────────────
  if (currentLesson?.lessonType === "stage") {
    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={module.title}>
        <div className={`absolute inset-0 ${animClass}`}>
          <ProductStage
            headline={currentLesson.headline}
            productImage={currentLesson.media?.asset?.url}
            stageBackground={currentLesson.stageBackground?.asset?.url}
            completionTransition={currentLesson.completionTransition}
            hotspots={hotspots}
            visited={visited[lessonKey] ?? new Set()}
            onVisit={markVisited}
            onNext={goNext}
          />
        </div>
        {navMapEl}
      </LessonFrame>
    );
  }

  // ── Video lesson ────────────────────────────────────────────────────────────
  if (currentLesson?.lessonType === "video") {
    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={module.title}>
        <div className={`absolute inset-0 ${animClass}`}>
          <VideoLesson
            headline={currentLesson.headline}
            videoUrl={currentLesson.videoUrl}
            videoFileUrl={currentLesson.videoFile?.asset?.url}
            onNext={goNext}
          />
        </div>
        {navMapEl}
      </LessonFrame>
    );
  }

  // ── Quiz lesson ─────────────────────────────────────────────────────────────
  if (currentLesson?.lessonType === "quiz") {
    const quizContext = [
      `Product: ${module.title}`,
      `Features: ${lessons
        .flatMap((s) => s.hotspots ?? [])
        .map((h) => h.topic || h.label)
        .filter(Boolean)
        .join(", ")}`,
      `Explored by learner: ${Object.values(visited)
        .flatMap((labels) => Array.from(labels))
        .join(", ") || "none yet"}`,
    ].join("\n");

    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={module.title}>
        <div className={`absolute inset-0 ${animClass}`}>
          <QuizLesson context={quizContext} onNext={goNext} sessionId={sessionId} moduleId={module._id} />
        </div>
        {navMapEl}
      </LessonFrame>
    );
  }

  // ── Regular lessons ─────────────────────────────────────────────────────────
  const targetId = activeLayerId || lastLayerIdRef.current;
  const activeHotspot = targetId ? hotspots.find(h => h._key === targetId) : null;
  const layerContent = activeHotspot?.layerContent;
  const lessonTextOverlayX = currentLesson.textOverlay?.x ?? 6;
  const lessonTextOverlayY = currentLesson.textOverlay?.y ?? 15;
  const lessonTextOverlayWidth = getSemanticWidthClass(currentLesson.textOverlay?.width);

  return (
    <LessonFrame
      currentLesson={currentLessonIndex + 1}
      totalLessons={lessons.length}
      onPrev={goPrev}
      onNext={goNext}
      nextDisabled={nextLocked}
      onToggleNavMap={toggleNavMap}
      moduleTitle={module.title}
      completionHint={
        nextLocked
          ? `Tap all ${hotspots.length} features to continue (${visitedOnLesson} / ${hotspots.length})`
          : undefined
      }
    >
      <div className={`absolute inset-0 ${animClass}`}>
        {/* Background Image or Solid Color */}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={currentLesson.headline} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-background" />
        )}
        
        {/* Lesson Content */}
        {(!imageUrl || currentLesson.body) && (
          <div 
            className={`absolute pointer-events-none z-10 flex flex-col ${
              imageUrl 
                ? 'left-[6%] right-[6%] bottom-[12%] md:left-[var(--desktop-x)] md:right-auto md:top-[var(--desktop-y)] md:bottom-auto'
                : ''
            }`}
            style={imageUrl ? { 
              '--desktop-x': `max(6%, ${lessonTextOverlayX}%)`,
              '--desktop-y': `${lessonTextOverlayY}%`,
            } as React.CSSProperties : { inset: 0, padding: '6%', justifyContent: 'center' }}
          >
            <div className={`pointer-events-auto w-full ${imageUrl ? lessonTextOverlayWidth : 'max-w-xl flex flex-col gap-4'}
              ${imageUrl ? 'bg-card/60 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-2xl' : ''}
            `}>
              <h2 className={`text-foreground text-2xl font-semibold leading-tight`}>{currentLesson?.headline}</h2>
              {currentLesson?.body && (
                <div className={`prose dark:prose-invert max-w-none text-muted-foreground mt-4 text-base font-light leading-relaxed whitespace-pre-wrap`}>
                  {typeof currentLesson.body === 'string' ? currentLesson.body : <PortableText value={currentLesson.body} components={portableTextComponents} />}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Hotspots */}
        {hotspots.map((h, i) => {
          let Icon = null;
          if (h.contentMode === "layer" && h.layerContent) {
            if (h.layerContent.layerType === "video") Icon = PlayCircle;
            else if (h.layerContent.layerType === "interaction") Icon = MousePointer2;
            else Icon = Layers;
          }

          return (
            <Hotspot
              key={i}
              x={h.x}
              y={h.y}
              label={h.label}
              visited={visited[lessonKey]?.has(h.label) ?? false}
              className={h.contentMode === "layer" ? "w-8 h-8 bg-black/50 backdrop-blur-md border border-white/20 text-white rounded-full flex items-center justify-center hover:bg-black/70 hover:scale-110 transition-all shadow-xl" : ""}
              pulseClassName={h.contentMode === "layer" ? "bg-white" : ""}
              icon={Icon ? <Icon className="w-4 h-4" /> : (h.contentMode === "layer" ? <Plus className="w-4 h-4" /> : undefined)}
              onVisit={() => markVisited(h.label)}
              onOpen={() => {
                if (h.contentMode === "layer" && h.layerContent) {
                  baseMarkVisited(lessonKey, h.label, hotspots.length);
                  setActiveLayerId(h._key);
                  return;
                }
                setActiveLayer({ topic: h.topic, title: h.label, body: h.body, x: h.x, y: h.y });
              }}
            />
          );
        })}

        <DiscoveryPanel
          open={activeLayer !== null}
          onClose={() => setActiveLayer(null)}
          label={activeLayer?.title ?? ""}
          topic={activeLayer?.topic}
          body={activeLayer?.body}
          x={activeLayer?.x}
          y={activeLayer?.y}
          mode="popover"
        />

        {/* Layer Sub-content */}
        {layerContent && (
          <LayerFrame
            open={activeLayerId !== null}
            onClose={() => setActiveLayerId(null)}
            parentLessonTitle={currentLesson.headline}
            layerTitle={layerContent.headline}
          >
            {/* Layer Media with Text Overlay */}
            {(layerContent.media?.asset?.url || (layerContent.photos && layerContent.photos.length > 0)) ? (
              <div className="relative mb-6">
                {layerContent.media?.asset?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={layerContent.media.asset.url} alt={layerContent.headline} className="w-full rounded-2xl object-cover max-h-[60vh] shadow-2xl ring-1 ring-white/10" />
                ) : layerContent.photos ? (
                  <FullWidthCarousel photos={layerContent.photos} className="!mb-0" />
                ) : null}

                {/* Text Overlay Box */}
                {layerContent.textOverlay && layerContent.body && (
                  <div 
                    className="absolute z-10 pointer-events-none flex flex-col p-4 md:p-0"
                    style={{ 
                      left: `${layerContent.textOverlay.x ?? 6}%`,
                      top: `${layerContent.textOverlay.y ?? 15}%`,
                    }}
                  >
                    <div className={`pointer-events-auto bg-card/60 backdrop-blur-2xl p-5 md:p-6 rounded-2xl border border-white/10 shadow-xl ${getSemanticWidthClass(layerContent.textOverlay.width)}`}>
                      <div className="prose prose-invert max-w-none text-foreground/90 leading-relaxed text-sm md:text-base line-clamp-6 hover:line-clamp-none transition-all">
                        {typeof layerContent.body === 'string' ? layerContent.body : <PortableText value={layerContent.body} />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Normal Body (if no text overlay configuration) */}
            {(!layerContent.textOverlay || (!layerContent.media?.asset?.url && !(layerContent.photos && layerContent.photos.length > 0))) && layerContent.body && (
              <div className="prose prose-invert max-w-none text-foreground/80 whitespace-pre-wrap leading-relaxed mb-6">
                {typeof layerContent.body === 'string' ? layerContent.body : <PortableText value={layerContent.body} />}
              </div>
            )}
            
            {layerContent.layerType === "video" && (layerContent.videoUrl || layerContent.videoFile?.asset?.url) && (
              <div className="mt-6 aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl">
                <video
                  src={layerContent.videoFile?.asset?.url || layerContent.videoUrl}
                  controls
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            )}
            
            {/* If layer has hotspots, render them relatively */}
            {layerContent.layerType === "interaction" && layerContent.hotspots && layerContent.hotspots.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm uppercase tracking-widest text-accent/80 font-bold mb-4">Interactive Features</h3>
                <div className="space-y-4">
                  {layerContent.hotspots.map((h, i) => (
                    <div key={i} className="bg-white/5 rounded-2xl p-5 border border-white/10">
                      <h4 className="font-semibold text-foreground text-lg mb-2">{h.label}</h4>
                      <div className="text-foreground/70 text-sm leading-relaxed prose prose-invert">
                        {typeof h.body === 'string' ? h.body : <PortableText value={h.body} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </LayerFrame>
        )}
      </div>
      {navMapEl}
    </LessonFrame>
  );
}
