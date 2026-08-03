'use client';

import { useEffect, useState } from 'react';

const SESSION_KEY = 'mototutor_session';

export function useCourseSession(preview = false): { sessionId: string; persistSession: boolean } {
  const [sessionId, setSessionId] = useState<string>('');
  const [previewSessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    // Studio and review previews must not observe or mutate learner identity.
    if (preview) return;

    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, sid);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionId(sid ?? crypto.randomUUID());
  }, [preview]);

  return {
    sessionId: preview ? previewSessionId : sessionId,
    persistSession: preview ? false : Boolean(sessionId),
  };
}
