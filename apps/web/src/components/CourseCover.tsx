'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface CourseCoverProps {
  title: string;
  coverHeadline?: string;
  coverImage?: string;
  buttonText?: string;
  buttonColor?: string;
  learningObjectives?: string[];
  imageSizes?: string;
  onStart: () => void;
}

export function CourseCover({
  title,
  coverHeadline,
  coverImage,
  buttonText = 'Start Course',
  buttonColor,
  learningObjectives,
  imageSizes = '100vw',
  onStart,
}: CourseCoverProps) {
  const finalHeadline = coverHeadline || title;

  // Map button colors — Motorola 2026 brand palette only
  let btnClass = 'bg-white text-black hover:bg-white/90';
  if (buttonColor === 'moto-indigo') btnClass = 'bg-accent text-foreground hover:bg-accent/90';
  else if (buttonColor === 'moto-frost')
    btnClass = 'bg-background text-foreground hover:bg-background/90';
  else if (buttonColor === 'moto-pearl') btnClass = 'bg-card text-foreground hover:bg-card/90';

  return (
    <div className="dark absolute inset-0 h-full w-full overflow-hidden bg-black">
      {/* Background Media */}
      {coverImage ? (
        <motion.div
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.7 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <Image
            src={coverImage}
            alt="Course cover"
            fill
            priority
            sizes={imageSizes}
            className="object-cover"
          />
        </motion.div>
      ) : (
        <div className="absolute inset-0 bg-neutral-950" />
      )}

      {/* Sophisticated Gradients */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/20 via-black/40 to-black/90" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent opacity-80" />

      {/* Subtle ambient glow behind text */}
      <div className="bg-accent/20 pointer-events-none absolute top-1/2 left-1/2 h-100 w-200 -translate-x-1/2 -translate-y-1/2 rounded-[100%] opacity-50 mix-blend-screen blur-[120px]" />

      {/* Content */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ y: 20, opacity: 0, filter: 'blur(10px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex max-w-5xl flex-col items-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-widest text-white/70 uppercase backdrop-blur-md"
          >
            {title !== finalHeadline ? title : 'Course Introduction'}
          </motion.div>

          <h1 className="text-center text-5xl leading-[1.1] font-bold tracking-tight text-white drop-shadow-2xl md:text-7xl lg:text-8xl">
            {finalHeadline}
          </h1>

          {learningObjectives && learningObjectives.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 flex w-full max-w-md flex-col gap-2 text-left text-sm text-white/70"
              aria-label="Learning objectives"
            >
              {learningObjectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="bg-accent/30 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full">
                    <span className="bg-accent h-1.5 w-1.5 rounded-full" />
                  </span>
                  {obj}
                </li>
              ))}
            </motion.ul>
          )}
        </motion.div>
      </div>

      {/* Call to Action Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto absolute right-0 bottom-12 left-0 z-20 flex justify-center"
      >
        <button
          onClick={onStart}
          className={`group completion-button-glow relative flex items-center gap-3 overflow-hidden rounded-full border border-white/10 px-8 py-4 text-lg font-semibold shadow-2xl transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none active:scale-95 ${btnClass}`}
        >
          {/* Button inner glow effect */}
          <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 ease-in-out group-hover:translate-x-full" />

          <span className="relative z-10">{buttonText}</span>

          <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/10 transition-colors group-hover:bg-black/20">
            <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      </motion.div>
    </div>
  );
}
