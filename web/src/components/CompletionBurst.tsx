'use client';

import React from 'react';

// Deterministic particles: 16 even angles × 3 radii (90 | 135 | 180 px)
const COLORS = ['#38bdf8', '#34d399', '#fff', '#fbbf24', '#a78bfa', '#f472b6'];
const PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * 2 * Math.PI;
  const dist = 90 + (i % 3) * 45;
  return {
    tx: `${(Math.cos(angle) * dist).toFixed(1)}px`,
    ty: `${(Math.sin(angle) * dist).toFixed(1)}px`,
    color: COLORS[i % COLORS.length],
    delay: `${((i % 8) * 0.018).toFixed(3)}s`,
    size: i % 5 === 0 ? 9 : 5,
  };
});

export function CompletionBurst({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      {/* Radial flash */}
      <div
        className="burst-flash absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(255,255,255,0.22), transparent)',
        }}
      />

      {/* 4 staggered expanding rings */}
      <div className="burst-ring burst-ring-sky" />
      <div className="burst-ring burst-ring-emerald" style={{ animationDelay: '0.08s' }} />
      <div className="burst-ring burst-ring-white" style={{ animationDelay: '0.18s' }} />
      <div className="burst-ring burst-ring-amber" style={{ animationDelay: '0.30s' }} />

      {/* 24 colored particles */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="burst-particle absolute rounded-full"
          style={
            {
              '--dp-tx': p.tx,
              '--dp-ty': p.ty,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              animationDelay: p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
