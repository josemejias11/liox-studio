'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PortableTextMarkComponent } from '@portabletext/react';
import { Check, Plus } from 'lucide-react';

export interface InlineDiscoveryCueProps {
  label: string;
  summary?: string;
  visited: boolean;
  onActivate: () => void;
  children: ReactNode;
}

export interface InlineDiscoveryCueValue {
  label: string;
  summary?: string;
  visited: boolean;
  onActivate: () => void;
}

export type InlineDiscoveryCueResolver = (
  linkedLayer: string | undefined,
) => InlineDiscoveryCueValue | undefined;

const InlineDiscoveryCueContext = createContext<InlineDiscoveryCueResolver | undefined>(undefined);

export function InlineDiscoveryCueProvider({
  resolveLinkedLayer,
  children,
}: {
  resolveLinkedLayer: InlineDiscoveryCueResolver;
  children: ReactNode;
}) {
  return (
    <InlineDiscoveryCueContext.Provider value={resolveLinkedLayer}>
      {children}
    </InlineDiscoveryCueContext.Provider>
  );
}

export const InlineDiscoveryCueMark: PortableTextMarkComponent<{
  _type: 'layerLink';
  linkedLayer?: string;
}> = ({ children, value }) => {
  const resolveLinkedLayer = useContext(InlineDiscoveryCueContext);
  const cue = resolveLinkedLayer?.(value?.linkedLayer);

  if (!cue) return <>{children}</>;

  return <InlineDiscoveryCue {...cue}>{children}</InlineDiscoveryCue>;
};

export function InlineDiscoveryCue({
  label,
  summary,
  visited,
  onActivate,
  children,
}: InlineDiscoveryCueProps) {
  const [expanded, setExpanded] = useState(false);

  function activate() {
    onActivate();
    if (summary) setExpanded((value) => !value);
  }

  return (
    <span className="relative mx-1 inline-block">
      <button
        type="button"
        aria-label={`Connect to ${label}`}
        aria-expanded={summary ? expanded : undefined}
        onClick={activate}
        className="group/cue pointer-events-auto inline-flex min-h-11 items-center gap-1 rounded-lg px-1.5 font-semibold text-[#443b86] underline decoration-[#685bc7]/45 decoration-2 underline-offset-4 transition-colors hover:bg-[#685bc7]/8 hover:decoration-[#685bc7] focus-visible:ring-2 focus-visible:ring-[#685bc7] focus-visible:outline-none"
      >
        {children}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#685bc7] text-white">
          {visited ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </span>
      </button>
      {summary && expanded && (
        <span
          role="note"
          className="mt-2 block max-w-md rounded-xl border border-[#685bc7]/15 bg-[#f0eef8] px-4 py-3 text-sm leading-relaxed text-[#514b77] shadow-sm"
        >
          {summary}
        </span>
      )}
    </span>
  );
}
