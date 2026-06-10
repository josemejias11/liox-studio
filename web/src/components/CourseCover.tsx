"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { sanityImageLoader } from "@/lib/sanity-image-loader";

interface CourseCoverProps {
  title: string;
  coverHeadline?: string;
  coverImage?: string;
  buttonText?: string;
  buttonColor?: string;
  learningObjectives?: string[];
  onStart: () => void;
}

export function CourseCover({
  title,
  coverHeadline,
  coverImage,
  buttonText = "Start Course",
  buttonColor,
  learningObjectives,
  onStart,
}: CourseCoverProps) {
  const finalHeadline = coverHeadline || title;

  // Map button colors — Motorola 2026 brand palette only
  let btnClass = "bg-white text-black hover:bg-white/90";
  if (buttonColor === "moto-indigo") btnClass = "bg-accent text-foreground hover:bg-accent/90";
  else if (buttonColor === "moto-frost") btnClass = "bg-background text-foreground hover:bg-background/90";
  else if (buttonColor === "moto-pearl") btnClass = "bg-card text-foreground hover:bg-card/90";

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black dark">
      {/* Background Media */}
      {coverImage ? (
        <motion.div
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.7 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <Image
            src={coverImage}
            alt="Course cover"
            fill
            priority
            sizes="100vw"
            loader={sanityImageLoader}
            className="object-cover"
          />
        </motion.div>
      ) : (
        <div className="absolute inset-0 bg-neutral-950" />
      )}

      {/* Sophisticated Gradients */}
      <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/40 to-black/90 pointer-events-none" />
      <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent opacity-80 pointer-events-none" />
      
      {/* Subtle ambient glow behind text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-100 bg-accent/20 blur-[120px] rounded-[100%] pointer-events-none opacity-50 mix-blend-screen" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10">
        <motion.div
          initial={{ y: 20, opacity: 0, filter: "blur(10px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center max-w-5xl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-medium tracking-widest uppercase text-white/70"
          >
            {title !== finalHeadline ? title : "Course Introduction"}
          </motion.div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white text-center tracking-tight leading-[1.1] drop-shadow-2xl">
            {finalHeadline}
          </h1>

          {learningObjectives && learningObjectives.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 flex flex-col gap-2 text-white/70 text-sm text-left max-w-md w-full"
              aria-label="Learning objectives"
            >
              {learningObjectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-accent/30 flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
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
        className="absolute bottom-12 left-0 right-0 flex justify-center z-20 pointer-events-auto"
      >
        <button
          onClick={onStart}
          className={`group relative flex items-center gap-3 font-semibold text-lg px-8 py-4 rounded-full shadow-2xl transition-all duration-300 active:scale-95 border border-white/10 overflow-hidden completion-button-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${btnClass}`}
        >
          {/* Button inner glow effect */}
          <div className="absolute inset-0 bg-linear-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          
          <span className="relative z-10">{buttonText}</span>
          
          <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/10 group-hover:bg-black/20 transition-colors">
            <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>
      </motion.div>
    </div>
  );
}
