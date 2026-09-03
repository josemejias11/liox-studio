'use client';

import { useEffect, useState } from 'react';

const SESSION_KEY = 'lb_studio_session';

// crypto.randomUUID is secure-context-only and is undefined on plain http://
// (except localhost). apps/web's own browser usage is always secure-context,
// but the same code also runs inside an exported SCORM bundle that may be
// served over plain http:// on an internal LMS network — this generates a
// local session identifier either way (it's not a security token, so a
// non-cryptographic fallback is fine).
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function useCourseSession(preview = false): { sessionId: string; persistSession: boolean } {
  const [sessionId, setSessionId] = useState<string>('');
  const [previewSessionId] = useState(() => generateId());

  useEffect(() => {
    if (preview) return;

    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = generateId();
      localStorage.setItem(SESSION_KEY, sid);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionId(sid ?? generateId());
  }, [preview]);

  return {
    sessionId: preview ? previewSessionId : sessionId,
    persistSession: preview ? false : Boolean(sessionId),
  };
}
