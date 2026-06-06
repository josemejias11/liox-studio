"use client";

import { useEffect, useRef, useState } from "react";
import { X, Bot, Send } from "lucide-react";

type Message = { role: "assistant" | "user"; text: string; streaming?: boolean };

interface SlideLayerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  // When set, the layer auto-sends an initial explanation and scopes all chat to this feature
  topic?: string;
  // Static content — bypasses chat mode entirely
  children?: React.ReactNode;

  // ── Design knobs ──────────────────────────────────────────────────────────
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

export function SlideLayer({
  open,
  onClose,
  title,
  topic,
  children,
  className = "",
  backdropClassName = "",
  headerClassName = "",
  contentClassName = "",
  animation = "up",
}: SlideLayerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom as messages grow
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-send initial explanation whenever the layer opens on a new topic
  useEffect(() => {
    if (!open || !topic || children) return;
    setMessages([]);
    setInput("");
    sendQuery(`Explain this feature in 2-3 sentences for a sales rep: ${topic}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topic]);

  // Abort in-flight request on close
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  async function sendQuery(query: string) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setStreaming(true);

    // Add placeholder assistant bubble
    setMessages((prev) => [...prev, { role: "assistant", text: "", streaming: true }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, context_hint: topic }),
        signal: abortRef.current.signal,
      });

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            acc += JSON.parse(payload).text ?? "";
            setMessages((prev) => {
              const msgs = [...prev];
              msgs[msgs.length - 1] = { role: "assistant", text: acc, streaming: true };
              return msgs;
            });
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
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
      setStreaming(false);
    }
  }

  function handleSend() {
    const q = input.trim();
    if (!q || streaming) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
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
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        } ${backdropClassName || "bg-black/55 backdrop-blur-[2px]"}`}
      />

      {/* Sheet panel */}
      <div
        className={`absolute left-0 right-0 bottom-9 rounded-t-2xl overflow-hidden
          flex flex-col transition-all duration-300 ease-out
          ${open ? anim.open : anim.closed}
          ${className || "bg-zinc-900/97 backdrop-blur-xl max-h-[75%]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-3 px-5 py-3 shrink-0 ${
            headerClassName || "border-b border-white/10 bg-zinc-800/60"
          }`}
        >
          <div className="bg-primary/20 p-1.5 rounded-lg shrink-0">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-white flex-1 truncate">{title}</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10 shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div
          className={`flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 ${
            contentClassName || "text-zinc-200"
          }`}
        >
          {children ?? (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 mt-0.5 bg-primary/20 rounded-full p-1 h-fit">
                      <Bot className="h-2.5 w-2.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`text-[12px] leading-relaxed rounded-2xl px-3 py-2 max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-primary/25 text-white rounded-tr-sm"
                        : "bg-white/8 text-zinc-200 rounded-tl-sm"
                    }`}
                  >
                    {msg.text || (msg.streaming && (
                      <span className="flex gap-1 items-center py-0.5">
                        {[0, 150, 300].map((d) => (
                          <span
                            key={d}
                            className="h-1 w-1 rounded-full bg-primary/60 animate-bounce"
                            style={{ animationDelay: `${d}ms` }}
                          />
                        ))}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input bar — only shown in chat mode (when topic is set, no static children) */}
        {topic && !children && (
          <div className="shrink-0 px-3 py-2 border-t border-white/10 flex gap-2 items-center bg-zinc-900/80">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about this feature…"
              disabled={streaming}
              className="flex-1 bg-white/8 text-white text-[12px] placeholder:text-zinc-500 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-40 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              className="shrink-0 bg-primary/20 hover:bg-primary/40 disabled:opacity-30 disabled:cursor-not-allowed text-primary rounded-xl p-2 transition-all"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
