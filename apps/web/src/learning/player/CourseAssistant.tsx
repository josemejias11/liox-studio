'use client';

import { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { matchOfflineAssistant, type OfflineAssistantPayload } from '@moto-ai/contracts';

export function CourseAssistant({
  payload,
  onAnswer,
}: {
  payload: OfflineAssistantPayload;
  onAnswer?: (context: { question: string; matchedQaId: string | null; answer: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = question.trim();
    if (!query) return;
    const result = matchOfflineAssistant(payload, query);
    setAnswer(result.answer);
    onAnswer?.({ question: query, matchedQaId: result.itemId, answer: result.answer });
  }
  return (
    <div className="fixed right-4 bottom-4 z-50 md:right-8 md:bottom-8">
      {open && (
        <section className="border-border bg-card mb-3 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Course Assistant</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Answers are approved for this course version.
              </p>
            </div>
            <button
              aria-label="Close Course Assistant"
              className="rounded p-1"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form className="mt-4 flex gap-2" onSubmit={submit}>
            <input
              className="bg-background min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about this course"
              value={question}
            />
            <button
              aria-label="Ask Course Assistant"
              className="bg-primary text-primary-foreground rounded-lg p-2"
              type="submit"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          {answer && (
            <p className="bg-muted mt-4 rounded-lg p-3 text-sm leading-relaxed">{answer}</p>
          )}
        </section>
      )}
      <button
        aria-label="Open Course Assistant"
        className="bg-primary text-primary-foreground flex h-14 w-14 items-center justify-center rounded-full shadow-xl"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
