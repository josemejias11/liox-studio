"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { PhotoCardStack } from "./PhotoCardStack";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { PortableText } from "@portabletext/react";

type Message = { role: "assistant" | "user"; text: string; streaming?: boolean };
type Turn = { role: "user" | "assistant"; content: string };

interface Photo {
  asset?: { url?: string };
}

interface DiscoveryPanelProps {
  open: boolean;
  onClose: () => void;
  label: string;
  topic?: string;
  body?: any;
  photos?: Photo[];
  x?: number;
  y?: number;
  mode?: "sidebar" | "popover";
  course_title?: string;
  course_description?: string;
}

const SUGGESTIONS = [
  "How would I demo this to a customer?",
  "What problem does this solve?",
  "How does this compare to competitors?",
];

// Lightweight Markdown: **bold**, bullet lines, line breaks — no external library
function renderText(text: string) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const isBullet = line.startsWith("- ") || line.startsWith("• ");
        const content = isBullet ? line.slice(2) : line;
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i}>
            {isBullet && (
              <span className="mr-1.5 text-accent select-none">•</span>
            )}
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j} className="font-semibold text-foreground">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                part
              )
            )}
            {i < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

export function DiscoveryPanel({
  open,
  onClose,
  label,
  topic,
  body,
  photos = [],
  x,
  y,
  mode,
  course_title,
  course_description,
}: DiscoveryPanelProps) {
  const hasLearnContent = !!(body || (photos?.length ?? 0) > 0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  // Tracks whether the viewport is below the md breakpoint (768 px).
  // Initialized false (SSR-safe); corrected on mount and kept in sync with resize.
  const [isMobileView, setIsMobileView] = useState(false);

  const panelRef         = useRef<HTMLDivElement>(null);
  const abortRef         = useRef<AbortController | null>(null);
  const conversationRef  = useRef<Turn[]>([]);
  const firstResponseRef = useRef(false);
  const bottomRef        = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLInputElement>(null);
  const swipeTouchStartX = useRef(0);
  const swipeTouchStartY = useRef(0);
  const lastPosRef       = useRef<{ x: number; y: number } | null>(null);
  const scrollBodyRef    = useRef<HTMLDivElement>(null);
  const userHasSentRef   = useRef(false);

  useEffect(() => {
    if (open) {
      if (x !== undefined && y !== undefined) lastPosRef.current = { x, y };
      else lastPosRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveAnnouncement(`Opened ${label}. ${hasLearnContent ? "Learn content available." : ""}`);
    } else {
      setLiveAnnouncement(`Closed ${label}.`);
    }
  }, [open, label, hasLearnContent, x, y]);

  useFocusTrap(panelRef, open);

  // Sync isMobileView with the viewport width (md breakpoint = 768 px).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileView(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Reset all state when a new hotspot opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([]);
      setInput("");
      setShowSuggestions(true); // show suggestion chips upfront before user sends
      conversationRef.current = [];
      firstResponseRef.current = false;
      userHasSentRef.current = false;
      if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
    }
  }, [open, label]);

  // Auto-fire AI greeting when the panel opens with a topic.
  // Gated on firstResponseRef (reset synchronously by the [open, label] effect above)
  // so it fires exactly once per hotspot open, even if open/topic change together.
  useEffect(() => {
    if (open && !firstResponseRef.current && topic) {
      sendQuery(
        `Briefly explain the "${topic}" feature to a sales rep in 2-3 sentences. Be concise and sales-focused.`,
        true // hide the auto-fire prompt from the UI
      );
    }
    // sendQuery is defined in the component body and reads `body`/`topic` via closure.
    // topic is included so the effect re-fires if the hotspot topic changes while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, label, topic]);

  // Abort in-flight request when panel closes
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  // Scroll to bottom only after the user explicitly sends a message,
  // or when there is no learn content (pure AI chat — greeting should be visible).
  useEffect(() => {
    if (userHasSentRef.current || !hasLearnContent) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hasLearnContent]);

  async function sendQuery(queryText: string, hideFromUI = false) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);

    // Append user turn to conversation history
    conversationRef.current = [
      ...conversationRef.current,
      { role: "user", content: queryText },
    ];

    // Show user bubble (except for hidden auto-fire)
    if (!hideFromUI) {
      setMessages((prev) => [...prev, { role: "user", text: queryText }]);
    }

    // Streaming placeholder for assistant
    setMessages((prev) => [...prev, { role: "assistant", text: "", streaming: true }]);

    let fullResponse = "";

    // Extract plain text from PortableText array for the AI
    const plainTextBody = typeof body === "string"
      ? body
      : Array.isArray(body)
        ? body.map((b: any) => b.children?.map((c: any) => c.text).join("") || "").join("\n")
        : "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationRef.current,
          context_hint: topic,
          lesson_content: plainTextBody,
          course_title,
          course_description,
        }),
        signal: controller.signal,
      });

      const reader = res.body!.getReader();
      // Use { stream: true } so the decoder doesn't flush its internal buffer on each call,
      // allowing multi-byte characters split across chunks to be handled correctly.
      const dec = new TextDecoder("utf-8", { fatal: false });
      // Buffer accumulates text across read() calls so that a `data:` line straddling
      // two chunks is never split and dropped.
      let sseBuffer = "";

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += dec.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        // The last element is an incomplete line (or ""); keep it for the next read.
        sseBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break outer;
          try {
            fullResponse += JSON.parse(payload).text ?? "";
            setMessages((prev) => {
              const msgs = [...prev];
              msgs[msgs.length - 1] = { role: "assistant", text: fullResponse, streaming: true };
              return msgs;
            });
          } catch {}
        }
      }
      // Flush any remaining bytes the decoder was holding for multi-byte chars.
      dec.decode();
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== "AbortError" && !controller.signal.aborted) {
        setMessages((prev) => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = {
            role: "assistant",
            text: "Couldn't load content right now.",
            streaming: false,
          };
          return msgs;
        });
      }
    } finally {
      // Only finalize state for the request that is still current.
      // If another sendQuery was called while this one was in-flight, abortRef.current
      // will have been replaced; the old request must not touch the new request's state.
      if (abortRef.current === controller) {
        // Finalize streaming bubble
        setMessages((prev) => {
          const msgs = [...prev];
          if (msgs.length > 0)
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], streaming: false };
          return msgs;
        });

        // Record completed assistant turn for multi-turn context
        if (fullResponse) {
          conversationRef.current = [
            ...conversationRef.current,
            { role: "assistant", content: fullResponse },
          ];
          setLiveAnnouncement(fullResponse);
          if (!firstResponseRef.current) {
            firstResponseRef.current = true;
            // suggestions remain visible — they were shown upfront and hide only on user send
          }
        }

        setStreaming(false);
      }
    }
  }

  function handleSend(text?: string) {
    const q = (text ?? input).trim();
    if (!q || streaming) return;
    if (!text) setInput("");
    setShowSuggestions(false);
    userHasSentRef.current = true;
    sendQuery(q);
    inputRef.current?.focus();
  }

  return (
    <div
      className={`absolute inset-0 z-30 transition-all duration-300 ease-out ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {/* Dimmer */}
      <div
        onClick={onClose}
        className={`absolute inset-0 transition-opacity duration-300 bg-background/40 backdrop-blur-[1px] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Screen-reader live region for completed AI responses */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Panel — popover (floating) or sidebar */}
      {(() => {
        const posX = x !== undefined ? x : lastPosRef.current?.x;
        const posY = y !== undefined ? y : lastPosRef.current?.y;

        // If mode is explicitly popover, always treat as floating (even if x/y are not fully resolved yet)
        // If mode isn't set, guess based on whether we have coordinates.
        const isFloating = mode === "popover" || (mode === undefined && posX !== undefined && posY !== undefined);

        let floatingStyle: React.CSSProperties = {};
        let originClass = "origin-center";

        if (isFloating && posX !== undefined && posY !== undefined) {
          const isLeft = posX < 50;
          const isTop  = posY < 50;

          // Clamp so the panel never bleeds outside the player container.
          // Horizontal: keep at least 4% margin from each edge.
          // Vertical: keep at least 2% margin from each edge.
          if (isLeft) floatingStyle.left  = `clamp(4%, ${posX + 2}%, 56%)`;
          else        floatingStyle.right = `clamp(4%, ${100 - posX + 2}%, 56%)`;

          if (isTop) {
            floatingStyle.top = `clamp(2%, ${posY}%, 55%)`;
            // Cap height to the space remaining below the hotspot so the panel never bleeds
            // past the player's overflow-hidden boundary.
            floatingStyle.maxHeight = `min(700px, ${Math.max(20, 98 - posY)}%)`;
          } else {
            floatingStyle.bottom = `clamp(2%, ${100 - posY}%, 55%)`;
            floatingStyle.maxHeight = `min(700px, ${Math.max(20, posY - 2)}%)`;
          }

          if  (isLeft &&  isTop)  originClass = "origin-top-left";
          else if (isLeft && !isTop)  originClass = "origin-bottom-left";
          else if (!isLeft && isTop)  originClass = "origin-top-right";
          else                        originClass = "origin-bottom-right";
        } else if (isFloating) {
          // Fallback if we are in popover mode but x/y aren't known yet (prevents jumping from sidebar)
          floatingStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", maxHeight: "min(700px, 88%)" };
        }

        // Desktop/tablet floating panel — maxHeight is set via floatingStyle (dynamic, based on hotspot position).
        const floatingClasses = `absolute w-[min(500px,58%)] rounded-3xl flex flex-col
          bg-card/80 backdrop-blur-3xl border border-white/10
          shadow-2xl transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${originClass}
          ${open ? "opacity-100 scale-100" : "opacity-0 scale-[0.3] pointer-events-none"}`;

        // Mobile bottom-sheet — slides up from the bottom, full width, ~72 % of viewport height.
        const mobileClasses = `absolute bottom-0 left-0 right-0 w-full h-[72vh] rounded-t-3xl flex flex-col
          bg-card/80 backdrop-blur-3xl border-t border-white/10
          shadow-2xl transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${open ? "translate-y-0" : "translate-y-full pointer-events-none"}`;

        // Sidebar (non-lesson / explicit sidebar mode) — slightly wider than before.
        const sidebarClasses = `absolute top-0 right-0 bottom-0 w-[48%] flex flex-col
          bg-card/80 backdrop-blur-2xl border-l border-white/10
          shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? "translate-x-0" : "translate-x-full"}`;

        return (
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              swipeTouchStartX.current = e.touches[0].clientX;
              swipeTouchStartY.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              // Sidebar: swipe right to close
              if (!isFloating && e.changedTouches[0].clientX - swipeTouchStartX.current > 56) onClose();
              // Mobile bottom-sheet: swipe down to close
              if (isMobileView && e.changedTouches[0].clientY - swipeTouchStartY.current > 80) onClose();
            }}
            // On mobile: bottom-sheet positioning (no inline style — Tailwind classes handle it).
            // On desktop floating: apply the clamp-based x/y inline style.
            // On sidebar: no inline style.
            style={(!isMobileView && isFloating) ? floatingStyle : undefined}
            className={isMobileView ? mobileClasses : (isFloating ? floatingClasses : sidebarClasses)}
          >

            {/* ── Header ── */}
            <div className="shrink-0 px-5 pt-4 pb-3.5 border-b border-white/8">
              <div className="flex items-center justify-between">
                {/* Left: AI indicator + label pill */}
                <div className="flex items-center gap-2.5">
                  <div className="bg-accent/20 rounded-full p-1.5 ring-1 ring-accent/30">
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-accent/15 text-foreground border border-accent/25">
                    {label}
                  </span>
                </div>
                {/* Right: close */}
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl
                    hover:bg-foreground/8 min-h-11 min-w-11 flex items-center justify-center"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Single scrollable body ── */}
            <div
              ref={scrollBodyRef}
              className="flex-1 overflow-y-auto scrollbar-none"
              style={{ scrollbarWidth: "none" }}
            >

              {/* Learn content — photos and rich text body, shown above AI chat if present */}
              {hasLearnContent && (
                <div className="px-4 pt-4 pb-2 flex flex-col gap-4">
                  {(photos?.length ?? 0) > 0 && <PhotoCardStack photos={photos} />}
                  {body && (
                    <div className="text-foreground text-[13.5px] leading-relaxed prose prose-sm prose-invert max-w-none">
                      {typeof body === "string" ? body : <PortableText value={body} />}
                    </div>
                  )}
                  {/* Separator — visually bridges learn content and AI chat section */}
                  <div className="flex items-center gap-3 mt-1 mb-1">
                    <div className="h-px flex-1 bg-white/8" />
                    <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                      <Sparkles className="h-2.5 w-2.5" />
                      AI Assistant
                    </span>
                    <div className="h-px flex-1 bg-white/8" />
                  </div>
                </div>
              )}

              {/* AI chat messages + suggestions */}
              <div className="px-4 py-3 flex flex-col gap-3">

                {/* Empty / welcome state when there is no topic to auto-fire */}
                {messages.length === 0 && !streaming && !topic && (
                  <div className="flex flex-col items-center py-8 gap-3 text-center">
                    <div className="bg-accent/10 rounded-full p-3.5 ring-1 ring-accent/20">
                      <Sparkles className="h-5 w-5 text-accent/70" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug">
                      Ask me anything about{" "}
                      <span className="text-foreground font-medium">{label}</span>
                    </p>
                  </div>
                )}

                {/* Message bubbles */}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="shrink-0 mt-1 bg-accent/15 rounded-full p-1.5 h-fit ring-1 ring-accent/20">
                        <Sparkles className="h-3 w-3 text-accent" />
                      </div>
                    )}
                    <div
                      className={`text-sm leading-relaxed rounded-2xl px-3.5 py-2.5 max-w-[88%] ${
                        msg.role === "user"
                          ? "bg-foreground/8 text-foreground rounded-tr-sm"
                          : "bg-accent/15 border border-accent/20 text-foreground rounded-tl-sm"
                      }`}
                    >
                      {msg.text ? (
                        msg.role === "assistant" ? renderText(msg.text) : msg.text
                      ) : (
                        msg.streaming && (
                          <span className="flex gap-1 items-center py-0.5">
                            {[0, 150, 300].map((d) => (
                              <span
                                key={d}
                                className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce"
                                style={{ animationDelay: `${d}ms` }}
                              />
                            ))}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                ))}

                {/* Suggestion chips — shown upfront on open, hidden after user sends */}
                {showSuggestions && !streaming && (
                  <div className="flex flex-col gap-2 pt-1 pb-1">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Try asking
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSend(s)}
                          className="text-sm text-accent bg-accent/10 border border-accent/25
                            rounded-full px-3.5 py-1.5 hover:bg-accent/20 active:scale-[0.97]
                            transition-all duration-150 text-left"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* ── Input bar ── */}
            <div className="shrink-0 px-4 py-3 border-t border-white/8">
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask about this feature…"
                  disabled={streaming}
                  className="flex-1 bg-foreground/6 text-foreground text-sm placeholder:text-muted-foreground
                    rounded-full px-4 py-2.5 outline-none
                    focus:ring-2 focus:ring-accent/60 focus:ring-offset-0
                    disabled:opacity-40 transition-all duration-200"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || streaming}
                  className="shrink-0 bg-accent text-accent-foreground
                    hover:bg-accent/90
                    disabled:bg-foreground/10 disabled:text-muted-foreground disabled:cursor-not-allowed
                    rounded-full p-2.5 min-w-11 min-h-11 flex items-center justify-center
                    transition-all duration-200 active:scale-90"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

          </div>
        );
      })()}
    </div>
  );
}
