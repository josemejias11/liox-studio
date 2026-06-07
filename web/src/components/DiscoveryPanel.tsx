"use client";

import { useEffect, useRef, useState } from "react";
import { X, Bot, Send, BookOpen, Sparkles } from "lucide-react";
import { PhotoCardStack } from "./PhotoCardStack";
import { useFocusTrap } from "@/lib/useFocusTrap";

type Tab = "learn" | "ask";
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
  body?: string;
  photos?: Photo[];
}

const SUGGESTIONS = [
  "How do I pitch this to a customer?",
  "What makes this stand out from competitors?",
  "Give me a quick 30-second demo tip.",
];

// Lightweight markdown: **bold**, bullet lines, line breaks — no external library
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
}: DiscoveryPanelProps) {
  const hasLearnContent = !!(body || photos.length);
  const [tab, setTab] = useState<Tab>(hasLearnContent ? "learn" : "ask");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const panelRef        = useRef<HTMLDivElement>(null);
  const abortRef        = useRef<AbortController | null>(null);
  const conversationRef = useRef<Turn[]>([]);
  const firstResponseRef = useRef(false);
  const bottomRef       = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const swipeTouchStartX = useRef(0);

  useFocusTrap(panelRef, open);

  // Reset all state when a new hotspot opens
  useEffect(() => {
    if (open) {
      setTab(hasLearnContent ? "learn" : "ask");
      setMessages([]);
      setInput("");
      setShowSuggestions(false);
      conversationRef.current = [];
      firstResponseRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, label]);

  // Auto-fire AI summary when switching to Ask tab with no messages yet
  useEffect(() => {
    if (tab === "ask" && open && messages.length === 0 && topic) {
      sendQuery(
        `Briefly explain the "${topic}" feature to a sales rep in 2-3 sentences. Be concise and sales-focused.`,
        true // hide the auto-fire prompt from the UI
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, open]);

  // Abort in-flight request when panel closes
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  // Scroll to bottom as messages grow
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendQuery(queryText: string, hideFromUI = false) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
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
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationRef.current,
          context_hint: topic,
          lesson_content: body,
        }),
        signal: abortRef.current.signal,
      });

      const reader = res.body!.getReader();
      const dec = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
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
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== "AbortError") {
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
          setShowSuggestions(true);
        }
      }

      setStreaming(false);
    }
  }

  function handleSend(text?: string) {
    const q = (text ?? input).trim();
    if (!q || streaming) return;
    if (!text) setInput("");
    setShowSuggestions(false);
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

      {/* Panel — lessons in from the right */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { swipeTouchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (e.changedTouches[0].clientX - swipeTouchStartX.current > 56) onClose();
        }}
        className={`absolute top-0 right-0 bottom-0 w-[42%] flex flex-col
          bg-background/96 backdrop-blur-2xl border-l border-border/10
          shadow-2xl shadow-moto-black/60
          transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* ── Header ── */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/8">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-accent/20 text-foreground border border-accent/30">
              {label}
            </span>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-background/10"
              aria-label="Close panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex gap-1 bg-background/5 p-0.5 rounded-lg">
            <button
              onClick={() => setTab("learn")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-md transition-all duration-150
                ${tab === "learn" ? "bg-background/12 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <BookOpen className="h-3 w-3" />
              Learn
            </button>
            <button
              onClick={() => setTab("ask")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-md transition-all duration-150
                ${tab === "ask" ? "bg-background/12 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Sparkles className="h-3 w-3" />
              Ask AI
            </button>
          </div>
        </div>

        {/* ── Learn tab ── */}
        {tab === "learn" && (
          <div
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 scrollbar-none"
            style={{ scrollbarWidth: "none" }}
          >
            {photos.length > 0 && <PhotoCardStack photos={photos} />}
            {body ? (
              <p className="text-foreground text-[12px] leading-relaxed">{body}</p>
            ) : (
              !photos.length && (
                <p className="text-muted-foreground text-[11px] italic text-center mt-6">
                  No content yet. Switch to Ask AI to learn about this feature.
                </p>
              )
            )}
          </div>
        )}

        {/* ── Ask AI tab ── */}
        {tab === "ask" && (
          <>
            {/* Message list */}
            <div
              className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 scrollbar-none"
              style={{ scrollbarWidth: "none" }}
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 mt-0.5 bg-accent/20 rounded-full p-1 h-fit">
                      <Bot className="h-2.5 w-2.5 text-accent" />
                    </div>
                  )}
                  <div
                    className={`text-[11.5px] leading-relaxed rounded-2xl px-3 py-2 max-w-[88%]
                      ${msg.role === "user"
                        ? "bg-accent/20 text-foreground rounded-tr-sm"
                        : "bg-background/7 text-foreground rounded-tl-sm"
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
                              className="h-1 w-1 rounded-full bg-accent/60 animate-bounce"
                              style={{ animationDelay: `${d}ms` }}
                            />
                          ))}
                        </span>
                      )
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Suggested question pills — appear after first AI response */}
            {showSuggestions && !streaming && (
              <div className="shrink-0 px-3 pb-2 flex flex-col gap-1.5">
                <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest">
                  Try asking
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-[10.5px] text-foreground bg-accent/10 border border-accent/25
                        rounded-full px-3 py-1 hover:bg-accent/20 active:scale-95
                        transition-all duration-150 text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input bar */}
            <div className="shrink-0 px-3 py-2 border-t border-border/8 flex gap-2 items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask about this feature…"
                disabled={streaming}
                className="flex-1 bg-background/7 text-foreground text-[11.5px] placeholder:text-muted-foreground
                  rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-accent/50
                  disabled:opacity-40 transition-all"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || streaming}
                className="shrink-0 bg-accent/20 hover:bg-accent/35 disabled:opacity-30
                  disabled:cursor-not-allowed text-accent rounded-xl p-2 transition-all active:scale-90"
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
