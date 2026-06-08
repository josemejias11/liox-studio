"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface CourseCoverProps {
  title: string;
  coverHeadline?: string;
  coverImage?: string;
  buttonText?: string;
  buttonColor?: string;
  onStart: () => void;
}

export function CourseCover({
  title,
  coverHeadline,
  coverImage,
  buttonText = "Start Course",
  buttonColor,
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
        <motion.img
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.7 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          src={coverImage}
          alt="Course cover"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-950" />
      )}

      {/* Sophisticated Gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/90 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 pointer-events-none" />
      
      {/* Subtle ambient glow behind text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-accent/20 blur-[120px] rounded-[100%] pointer-events-none opacity-50 mix-blend-screen" />

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
          className={`group relative flex items-center gap-3 font-semibold text-lg px-8 py-4 rounded-full shadow-2xl transition-all duration-300 active:scale-95 border border-white/10 overflow-hidden completion-button-glow ${btnClass}`}
        >
          {/* Button inner glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
          
          <span className="relative z-10">{buttonText}</span>
          
          <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/10 group-hover:bg-black/20 transition-colors">
            <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>
      </motion.div>
    </div>
  );
}
