'use client';

import { useState } from 'react';

export function ReviewFeedbackPanel({
  token,
  lessons,
  selectedLessonId,
  onSelectLesson,
  assistantContext,
  assistantReferences,
}: {
  token: string;
  lessons: Array<{ id: string; label: string }>;
  selectedLessonId?: string;
  onSelectLesson: (lessonId?: string) => void;
  assistantContext?: { question: string; matchedQaId: string | null; answer: string };
  assistantReferences: import('@moto-ai/contracts').AssistantQaItem[];
}) {
  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    setSending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(token)}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          authorName,
          message,
          lessonId: selectedLessonId,
          assistantQuestion: assistantContext?.question,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Feedback could not be submitted.');
      setMessage('');
      setStatus('Feedback submitted. Thank you.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Feedback could not be submitted.');
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="border-border bg-card rounded-2xl border p-5">
      <p className="text-primary text-xs font-semibold tracking-[0.15em] uppercase">
        Review feedback
      </p>
      <h2 className="mt-2 text-lg font-semibold">Tell the course team what should change</h2>
      <div className="mt-5 space-y-4">
        <label className="block text-xs font-medium">
          Your name
          <input
            className="border-input bg-background mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            name="reviewer-name"
            onChange={(event) => setAuthorName(event.target.value)}
            value={authorName}
          />
        </label>
        <label className="block text-xs font-medium">
          Attach to
          <select
            className="border-input bg-background mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            name="review-lesson"
            onChange={(event) => onSelectLesson(event.target.value || undefined)}
            value={selectedLessonId ?? ''}
          >
            <option value="">Entire course</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium">
          Feedback
          <textarea
            className="border-input bg-background mt-1 min-h-36 w-full rounded-lg border px-3 py-2 text-sm"
            name="review-message"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe the requested change and why it matters."
            value={message}
          />
        </label>
        {assistantContext && (
          <div className="bg-muted rounded-lg px-3 py-2 text-xs">
            Assistant context attached: “{assistantContext.question}” ·{' '}
            {assistantContext.matchedQaId ? 'matched approved answer' : 'fallback'}
            {assistantContext.matchedQaId &&
              assistantReferences.find((item) => item.id === assistantContext.matchedQaId) && (
                <p className="text-muted-foreground mt-1">
                  Author references:{' '}
                  {assistantReferences
                    .find((item) => item.id === assistantContext.matchedQaId)!
                    .citations.map((citation) => citation.label)
                    .join(', ')}
                </p>
              )}
          </div>
        )}
        {status && (
          <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-xs">{status}</p>
        )}
        <button
          className="bg-primary text-primary-foreground w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          disabled={sending || !authorName.trim() || !message.trim()}
          onClick={submit}
          type="button"
        >
          {sending ? 'Submitting…' : 'Submit feedback'}
        </button>
      </div>
    </aside>
  );
}
