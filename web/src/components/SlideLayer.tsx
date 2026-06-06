"use client";

import { useEffect, useRef, useState } from "react";
import { X, Bot, Send, Sparkles } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

type Message = { role: "assistant" | "user"; text: string; streaming?: boolean };
type Turn    = { role: "user" | "assistant"; content: string };

interface SlideLayerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  topic?: string;
  body?: string;
  children?: React.ReactNode;
  className?: string;
  backdropClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
  animation?: "up" | "down" | "fade";
}

const ANIMATION_CLASSES = {
  up:   { open: "translate-y-0 opacity-100", closed: "translate-y-full opacity-0" },
  down: { open: "translate-y-0 opacity-100", closed: "-translate-y-full opacity-0" },
  fade: { open: "opacity-100 scale-100",     closed: "opacity-0 scale-95" },
};

const SUGGESTIONS = [
  "Give me a 30-second pitch for this",
  "What problems does this solve?",
  "How does this compare to alternatives?",
];

function renderText(text: string) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const isBullet = line.startsWith("- ") || line.startsWith("• ");
        const content  = isBullet ? line.slice(2) : line;
        const parts    = content.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i}>
            {isBullet && <span className="mr-1.5 text-sky-400 select-none" aria-hidden="true">•</span>}
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j} className="font-semibold text-white">{part.slice(2, -2)}</strong>
              ) : part
            )}
            {i < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

const TITLE_ID = "slide-layer-title";

export function SlideLayer({
  open,
  onClose,
  title,
  topic,
  body,
  children,
  className        = "",
  backdropClassName = "",
  headerClassName  = "",
  contentClassName = "",
  animation        = "up",
}: SlideLayerProps) {
  const [messages, setMessages]               = useState<Message[]>([]);
  const [input, setInput]                     = useState("");
  const [streaming, setStreaming]             = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Populated with the last complete AI response for the aria-live region
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const panelRef        = useRef<HTMLDivElement>(null);
  const abortRef        = useRef<AbortController | null>(null);
  const conversationRef = useRef<Turn[]>([]);
  const firstResRef     = useRef(false);
  const bottomRef       = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const onCloseRef      = useRef(onClose);
  const swipeStartY     = useRef(0);

  // Keep onClose ref fresh without re-registering listeners
  useEffect(() => { onCloseRef.current = onClose; });

  // Focus trap — keeps keyboard navigation inside the panel while open
  useFocusTrap(panelRef, open);

  // Escape key closes the panel
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset + auto-fire whenever a new hotspot opens
  useEffect(() => {
    if (!open || !topic || children) return;
    setMessages([]);
    setInput("");
    setShowSuggestions(false);
    setLiveAnnouncement("");
    conversationRef.current = [];
    firstResRef.current     = false;
    sendQuery(
      `Briefly explain "${topic}" to a sales rep in 2-3 sentences. Be concise and sales-focused.`,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topic]);

  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendQuery(queryText: string, hideFromUI = false) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setStreaming(true);

    conversationRef.current = [
      ...conversationRef.current,
      { role: "user", content: queryText },
    ];

    if (!hideFromUI) {
      setMessages((prev) => [...prev, { role: "user", text: queryText }]);
    }

    setMessages((prev) => [...prev, { role: "assistant", text: "", streaming: true }]);

    let fullResponse = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationRef.current, context_hint: topic, slide_content: body }),
        signal: abortRef.current.signal,
      });

      const reader = res.body!.getReader();
      const dec    = new TextDecoder();

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
          msgs[msgs.length - 1] = { role: "assistant", text: "Couldn't load content right now.", streaming: false };
          return msgs;
        });
      }
    } finally {
      setMessages((prev) => {
        const msgs = [...prev];
        if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], streaming: false };
        return msgs;
      });

      if (fullResponse) {
        conversationRef.current = [
          ...conversationRef.current,
          { role: "assistant", content: fullResponse },
        ];
        // Announce completed response to screen readers
        setLiveAnnouncement(fullResponse);
        if (!firstResRef.current) {
          firstResRef.current = true;
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

  const anim = ANIMATION_CLASSES[animation];

  return (
    <div
      className={`absolute inset-0 z-30 transition-all duration-300 ease-out ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {/* Screen-reader announcement for completed AI responses */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        } ${backdropClassName || "bg-black/55 backdrop-blur-[2px]"}`}
      />

      {/* Bottom sheet */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { swipeStartY.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => { if (e.changedTouches[0].clientY - swipeStartY.current > 64) onClose(); }}
        className={`absolute left-0 right-0 bottom-9 rounded-t-2xl overflow-hidden
          flex flex-col transition-all duration-300 ease-out
          ${open ? anim.open : anim.closed}
          ${className || "bg-zinc-900/97 backdrop-blur-xl max-h-[72%]"}`}
      >
        {/* Header */}
        <div
          className={`relative shrink-0 flex items-center gap-3 px-6 pt-5 pb-4 border-b border-white/8
            ${headerClassName || "bg-zinc-800/50"}`}
        >
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/15 rounded-full pointer-events-none" aria-hidden="true" />
          <div className="bg-sky-500/20 p-2 rounded-lg shrink-0" aria-hidden="true">
            <Sparkles className="h-5 w-5 text-sky-400" />
          </div>
          <h3 id={TITLE_ID} className="text-base font-semibold text-white flex-1 truncate">{title}</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10 shrink-0"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div
          className={`flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 ${contentClassName}`}
          style={{ scrollbarWidth: "none" }}
          aria-label="Conversation"
        >
          {children ?? (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 mt-1 bg-sky-500/20 rounded-full p-1.5 h-fit" aria-hidden="true">
                      <Bot className="h-4 w-4 text-sky-400" />
                    </div>
                  )}
                  <div
                    className={`text-sm leading-relaxed rounded-2xl px-4 py-3 max-w-[88%]
                      ${msg.role === "user"
                        ? "bg-sky-500/20 text-white rounded-tr-sm"
                        : "bg-white/10 text-zinc-200 rounded-tl-sm"
                      }`}
                  >
                    {msg.text ? (
                      msg.role === "assistant" ? renderText(msg.text) : msg.text
                    ) : (
                      msg.streaming && (
                        <span className="flex gap-1 items-center py-0.5" aria-label="Loading response">
                          {[0, 150, 300].map((d) => (
                            <span key={d} className="h-1 w-1 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: `${d}ms` }} aria-hidden="true" />
                          ))}
                        </span>
                      )
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Suggestions */}
        {topic && !children && showSuggestions && !streaming && (
          <div className="shrink-0 px-4 pb-3 flex flex-col gap-2">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest" aria-hidden="true">
              Try asking
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-sm text-sky-300 bg-sky-500/10 border border-sky-500/25
                    rounded-full px-4 py-1.5 hover:bg-sky-500/20 active:scale-95
                    transition-all duration-150 text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        {topic && !children && (
          <div className="shrink-0 px-4 py-3 border-t border-white/8 flex gap-3 items-center bg-zinc-900/60">
            <label htmlFor="sl-input" className="sr-only">Ask about this feature</label>
            <input
              id="sl-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about this feature…"
              disabled={streaming}
              className="flex-1 bg-white/10 text-white text-sm placeholder:text-zinc-500
                rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-sky-500/50
                disabled:opacity-40 transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || streaming}
              aria-label="Send message"
              className="shrink-0 bg-sky-500/20 hover:bg-sky-500/35 disabled:opacity-30
                disabled:cursor-not-allowed text-sky-400 rounded-xl p-3 transition-all active:scale-95"
            >
              <Send className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
