"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface InterviewSkeletonProps {
  mode?: "video" | "audio";
  status?: string;
}

export function InterviewSkeleton({ mode = "audio", status = "Preparing your interview..." }: InterviewSkeletonProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Avatar/Waveform skeleton */}
      <div className="relative">
        <motion.div
          className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 via-blue-500 to-purple-600"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: "easeInOut" as const,
          }}
        />
        {/* Ripple effect */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-blue-400"
          animate={{
            scale: [1, 1.5, 2],
            opacity: [0.5, 0.2, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut" as const,
          }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-blue-400"
          animate={{
            scale: [1, 1.5, 2],
            opacity: [0.5, 0.2, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut" as const,
            delay: 0.5,
          }}
        />
      </div>

      {/* Status text with animation */}
      <motion.div
        className="text-center space-y-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" as const }}
      >
        <motion.h2
          className="text-xl font-semibold text-foreground"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {mode === "video" ? "Video Interview" : "Audio Interview"}
        </motion.h2>
        <motion.p
          className="text-muted-foreground"
          key={status}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {status}
        </motion.p>
      </motion.div>

      {/* Progress indicator */}
      <div className="flex items-center gap-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 rounded-full bg-blue-500"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      {/* Interview UI skeleton preview */}
      <motion.div
        className="w-full max-w-2xl bg-card rounded-xl shadow-lg p-6 space-y-4"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" as const }}
      >
        {/* Question area skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-24 bg-muted" />
          <Skeleton className="h-6 w-full bg-muted" />
          <Skeleton className="h-6 w-3/4 bg-muted" />
        </div>

        {/* Waveform skeleton */}
        <div className="flex items-center justify-center gap-1 py-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-blue-300"
              animate={{
                height: [16, 32, 24, 40, 16],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.08,
                ease: "easeInOut" as const,
              }}
            />
          ))}
        </div>

        {/* Controls skeleton */}
        <div className="flex justify-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full bg-muted" />
          <Skeleton className="h-12 w-12 rounded-full bg-muted" />
          <Skeleton className="h-12 w-12 rounded-full bg-muted" />
        </div>
      </motion.div>
    </motion.div>
  );
}

// Compact skeleton for inline loading states
export function InterviewLoadingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-blue-500"
          animate={{
            y: [0, -8, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

// Skeleton for question transition
export function QuestionTransitionSkeleton() {
  return (
    <motion.div
      className="space-y-3 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
        }}
      >
        <Skeleton className="h-5 w-3/4 bg-muted" />
      </motion.div>
      <Skeleton className="h-5 w-1/2 bg-muted" />
    </motion.div>
  );
}
