'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import type { ChatMessage } from '../course-ai/useChatConversation';

const SUGGESTIONS = [
  'How would I demo this to a customer?',
  'What problem does this solve?',
  'How does this compare to competitors?',
];

interface DiscoveryConversationProps {
  label: string;
  topic?: string;
  messages: ChatMessage[];
  isLoading: boolean;
  hasLearnContent: boolean;
  learnContent?: ReactNode;
  onSend: (query: string) => void;
}

function renderMessageText(text: string) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, index) => {
        const isBullet = line.startsWith('- ') || line.startsWith('• ');
        const content = isBullet ? line.slice(2) : line;
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={`${index}-${line}`}>
            {isBullet && <span className="text-accent mr-1.5 select-none">•</span>}
            {parts.map((part, partIndex) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <strong key={`${partIndex}-${part}`} className="text-foreground font-semibold">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                part
              ),
            )}
            {index < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

export function DiscoveryConversation({
  label,
  topic,
  messages,
  isLoading,
  hasLearnContent,
  learnContent,
  onSend,
}: DiscoveryConversationProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [userHasSent, setUserHasSent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userHasSent || !hasLearnContent) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, userHasSent, hasLearnContent]);

  function send(text?: string) {
    const query = (text ?? input).trim();
    if (!query || isLoading) return;
    setInput('');
    setShowSuggestions(false);
    setUserHasSent(true);
    onSend(query);
    inputRef.current?.focus();
  }

  return (
    <>
      <div className="scrollbar-none flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {learnContent}

        <div className="flex flex-col gap-3 px-4 py-3">
          {messages.length === 0 && !isLoading && !topic && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="bg-accent/10 ring-accent/20 rounded-full p-3.5 ring-1">
                <Sparkles className="text-accent/70 h-5 w-5" />
              </div>
              <p className="text-muted-foreground text-sm leading-snug">
                Ask me anything about <span className="text-foreground font-medium">{label}</span>
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="bg-accent/15 ring-accent/20 mt-1 h-fit shrink-0 rounded-full p-1.5 ring-1">
                  <Sparkles className="text-accent h-3 w-3" />
                </div>
              )}
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-foreground/8 text-foreground rounded-tr-sm'
                    : 'bg-accent/15 border-accent/20 text-foreground rounded-tl-sm border'
                }`}
              >
                {message.content ? (
                  message.role === 'assistant' ? (
                    renderMessageText(message.content)
                  ) : (
                    message.content
                  )
                ) : (
                  message.pending && (
                    <span className="flex items-center gap-1 py-0.5">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="bg-accent h-1.5 w-1.5 animate-bounce rounded-full"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </span>
                  )
                )}
              </div>
            </div>
          ))}

          {showSuggestions && !isLoading && (
            <div className="flex flex-col gap-2 pt-1 pb-1">
              <p className="text-muted-foreground text-[9px] font-semibold tracking-widest uppercase">
                Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="text-accent bg-accent/10 border-accent/25 hover:bg-accent/20 rounded-full border px-3.5 py-1.5 text-left text-sm transition-all duration-150 active:scale-[0.97]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            name="discovery-question"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && send()}
            placeholder="Ask about this feature…"
            aria-label="Ask the Course AI Assistant about this feature"
            disabled={isLoading}
            className="bg-foreground/6 text-foreground placeholder:text-muted-foreground focus:ring-accent/60 flex-1 rounded-full px-4 py-2.5 text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!input.trim() || isLoading}
            className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:bg-foreground/10 disabled:text-muted-foreground flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-2.5 transition-all duration-200 active:scale-90 disabled:cursor-not-allowed"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
