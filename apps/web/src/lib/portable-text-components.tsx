import React from 'react';

export const supMark = {
  sup: ({ children }: { children: React.ReactNode }) => <sup>{children}</sup>,
};

/** Marks authored by Studio remain ordinary Portable Text, so the player can use its default emphasis and list renderers. */
export const studioPortableTextMarks = ['strong', 'em', 'sup', 'layerLink'] as const;
