'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import type { CourseSpecification } from '@/lib/contracts/player-course';

interface SpecificationPageProps {
  spec: CourseSpecification;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SpecificationPage({ spec }: SpecificationPageProps) {
  const heroUrl = spec.heroImage?.asset?.url;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
    },
  };

  return (
    <div className="bg-background absolute inset-0 flex flex-col overflow-hidden">
      {/* ── Scrollable content area ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Hero image — full-bleed within the content area */}
        {heroUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="aspect-4/3 w-full shrink-0 overflow-hidden"
          >
            <Image
              src={heroUrl}
              alt={spec.title}
              width={1200}
              height={900}
              className="h-full w-full object-cover"
            />
          </motion.div>
        )}

        <motion.div
          className="mx-auto w-full max-w-3xl px-6 pb-4 md:px-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="pt-6 pb-4">
            <p className="text-accent mb-2 text-xs font-semibold tracking-[0.2em] uppercase">
              Specifications
            </p>
            <h1 className="text-foreground text-3xl leading-tight font-bold tracking-tight md:text-4xl">
              {spec.title}
            </h1>
            {spec.subtitle && (
              <p className="text-muted-foreground mt-2 max-w-2xl text-base leading-relaxed">
                {spec.subtitle}
              </p>
            )}
          </motion.div>

          {/* Spec groups */}
          <div className="mt-4 flex flex-col gap-8">
            {(spec.specGroups ?? []).map((group, groupIndex) => (
              <motion.section variants={itemVariants} key={groupIndex} aria-label={group.groupName}>
                {/* Group header */}
                <h2 className="text-muted-foreground border-border/40 mb-4 border-b pb-2 text-xs font-semibold tracking-[0.15em] uppercase">
                  {group.groupName}
                </h2>

                {/* Spec rows */}
                <dl className="flex flex-col">
                  {(group.specs ?? []).map((item, specIndex) => (
                    <div
                      key={specIndex}
                      className={
                        item.highlight
                          ? 'bg-accent/10 border-accent/20 -mx-4 my-1 flex items-start justify-between gap-4 rounded-xl border px-4 py-3.5 shadow-sm'
                          : 'border-border/10 flex items-start justify-between gap-4 border-b py-3.5 last:border-0'
                      }
                    >
                      <dt className="text-foreground/70 w-[45%] shrink-0 text-sm leading-snug font-medium">
                        {item.label}
                      </dt>
                      <dd
                        className={
                          item.highlight
                            ? 'text-accent text-right text-sm leading-snug font-bold'
                            : 'text-foreground text-right text-sm leading-snug font-semibold'
                        }
                      >
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </motion.section>
            ))}

            {/* Footnotes */}
            {spec.footnotes && spec.footnotes.length > 0 && (
              <motion.footer
                variants={itemVariants}
                className="border-border/20 mt-2 border-t pt-4"
              >
                {spec.footnotes.map((note, i) => (
                  <p
                    key={i}
                    className="text-muted-foreground/60 mt-2 text-xs leading-relaxed italic"
                  >
                    {note}
                  </p>
                ))}
              </motion.footer>
            )}

            {/* Bottom scroll padding so last content clears the nav bar */}
            <div className="h-24" aria-hidden="true" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
