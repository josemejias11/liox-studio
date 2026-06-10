"use client";

import { useEffect, useState } from "react";
import { X, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getConsent, setConsent } from "@/lib/consent";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if the user has already made a choice
    if (getConsent() === "unset") {
      // Delay showing it slightly for a smoother entry
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleAccept() {
    setConsent("accepted");
    setShow(false);
  }

  function handleDecline() {
    // Declining clears any persisted session id and keeps all future
    // session/progress state in memory only (see lib/consent.ts).
    setConsent("declined");
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 md:right-auto md:left-8 md:bottom-8 md:max-w-sm z-9999"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 bg-accent/20 p-2 rounded-full shrink-0">
                <ShieldCheck className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-sm mb-1">Your Privacy</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  We use an anonymous local identifier to securely save your interactive lesson progress across sessions. No personal data is stored.
                </p>
              </div>
              <button 
                onClick={handleDecline}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-2 -mt-2 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex gap-2 w-full pt-2">
              <button
                onClick={handleDecline}
                className="flex-1 py-2 text-xs font-medium bg-background border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 py-2 text-xs font-semibold bg-accent text-accent-foreground rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-md shadow-accent/20"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
