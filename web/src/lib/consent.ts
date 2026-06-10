// ── Storage-consent utility ───────────────────────────────────────────────────
// Single source of truth for the cookie/localStorage consent state shared by
// CookieConsent (writes) and the session bootstrap in MotoViewer (reads +
// reacts). Until the user accepts, nothing identifying is persisted on the
// device and no progress/quiz records are written server-side.

export type ConsentStatus = "accepted" | "declined" | "unset";

const CONSENT_KEY = "mototutor_cookie_consent";
export const SESSION_KEY = "mototutor_session";

/** Fired on `window` whenever consent changes; detail is the new ConsentStatus. */
export const CONSENT_EVENT = "mototutor:consent-change";

export function getConsent(): ConsentStatus {
  if (typeof window === "undefined") return "unset";
  switch (localStorage.getItem(CONSENT_KEY)) {
    case "true":
      return "accepted";
    case "declined":
      return "declined";
    default:
      return "unset";
  }
}

export function setConsent(status: Exclude<ConsentStatus, "unset">): void {
  localStorage.setItem(CONSENT_KEY, status === "accepted" ? "true" : "declined");
  if (status === "declined") {
    // Withdraw the persisted identifier immediately — the app keeps working
    // with an in-memory session id for the rest of the visit.
    localStorage.removeItem(SESSION_KEY);
  }
  window.dispatchEvent(new CustomEvent<ConsentStatus>(CONSENT_EVENT, { detail: status }));
}
