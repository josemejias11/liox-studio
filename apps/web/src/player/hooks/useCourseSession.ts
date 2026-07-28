'use client';

import { useEffect, useState } from 'react';
import { CONSENT_EVENT, SESSION_KEY, getConsent, type ConsentStatus } from '@/lib/consent';

export function useCourseSession(preview = false): { sessionId: string; persistSession: boolean } {
  const [sessionId, setSessionId] = useState<string>('');
  const [persistSession, setPersistSession] = useState(false);
  const [previewSessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    // Studio and review previews must not observe or mutate learner identity.
    if (preview) return;

    const consent = getConsent();
    let sid = consent === 'accepted' ? localStorage.getItem(SESSION_KEY) : null;
    if (consent === 'accepted' && !sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, sid);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionId(sid ?? crypto.randomUUID());
    setPersistSession(consent === 'accepted');

    function onConsentChange(e: Event) {
      const status = (e as CustomEvent<ConsentStatus>).detail;
      if (status === 'accepted') {
        setSessionId((prev) => {
          const id = prev || crypto.randomUUID();
          localStorage.setItem(SESSION_KEY, id);
          return id;
        });
        setPersistSession(true);
      } else {
        setPersistSession(false);
      }
    }

    window.addEventListener(CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(CONSENT_EVENT, onConsentChange);
  }, [preview]);

  return {
    sessionId: preview ? previewSessionId : sessionId,
    persistSession: preview ? false : persistSession,
  };
}
