'use client';

import { useState } from 'react';

export function ReviewFeedbackPanel({
  token,
  lessons,
  selectedLessonId,
  onSelectLesson,
}: {
  token: string;
  lessons: Array<{ id: string; label: string }>;
  selectedLessonId?: string;
  onSelectLesson: (lessonId?: string) => void;
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
        body: JSON.stringify({ authorName, message, lessonId: selectedLessonId }),
      });
      const result = await response.json() as { error?: string };
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
    <aside className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Review feedback</p>
      <h2 className="mt-2 text-lg font-semibold">Tell the course team what should change</h2>
      <div className="mt-5 space-y-4">
        <label className="block text-xs font-medium">Your name<input className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" name="reviewer-name" onChange={(event) => setAuthorName(event.target.value)} value={authorName} /></label>
        <label className="block text-xs font-medium">Attach to<select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" name="review-lesson" onChange={(event) => onSelectLesson(event.target.value || undefined)} value={selectedLessonId ?? ''}><option value="">Entire course</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.label}</option>)}</select></label>
        <label className="block text-xs font-medium">Feedback<textarea className="mt-1 min-h-36 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" name="review-message" onChange={(event) => setMessage(event.target.value)} placeholder="Describe the requested change and why it matters." value={message} /></label>
        {status && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{status}</p>}
        <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={sending || !authorName.trim() || !message.trim()} onClick={submit} type="button">{sending ? 'Submitting…' : 'Submit feedback'}</button>
      </div>
    </aside>
  );
}
