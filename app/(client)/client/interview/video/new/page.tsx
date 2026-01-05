"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mic, Video, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Status messages for perceived progress
const STATUS_MESSAGES = [
  { text: "Preparing your interview...", delay: 0 },
  { text: "Setting up personalized questions...", delay: 800 },
  { text: "Initializing audio system...", delay: 1600 },
  { text: "Almost ready...", delay: 2400 },
];

function NewVideoInterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const audioOnly = searchParams.get("audioOnly") === "true";

  const [statusIndex, setStatusIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const creatingRef = useRef(false);

  // Animate through status messages for perceived progress
  useEffect(() => {
    const timers = STATUS_MESSAGES.slice(1).map((msg, i) =>
      setTimeout(() => setStatusIndex(i + 1), msg.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (creatingRef.current) return;
    creatingRef.current = true;

    const createInterview = async () => {
      try {
        const res = await fetch("/api/interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "live_video" }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to create interview");
        }

        const interview = await res.json();

        // Store pre-generated audio for instant playback
        if (interview.firstQuestionAudioUrl) {
          localStorage.setItem(
            `interview_audio_${interview.id}`,
            interview.firstQuestionAudioUrl
          );
        }

        // Replace current URL so back button doesn't return here
        const audioParam = audioOnly ? "?audioOnly=true" : "";
        router.replace(`/client/interview/video/${interview.id}${audioParam}`);
      } catch (err) {
        console.error("Failed to create interview:", err);
        setError(err instanceof Error ? err.message : "Failed to create interview");
        toast.error("Failed to start interview");
      }
    };

    createInterview();
  }, [router, audioOnly]);

  if (error) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
          <p className="text-red-500 max-w-md">{error}</p>
        </div>
        <Link href="/client/interview/start">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Go back and try again
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] gap-8 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Animated avatar/icon with ripple effect */}
      <div className="relative">
        {/* Ripple circles */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border-2 border-blue-400"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{
              scale: [1, 1.8, 2.5],
              opacity: [0.6, 0.2, 0],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              delay: i * 0.8,
              ease: "easeOut",
            }}
          />
        ))}

        {/* Main icon container */}
        <motion.div
          className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center relative z-10 shadow-xl"
          animate={{
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {audioOnly ? (
            <Mic className="w-14 h-14 text-white" />
          ) : (
            <Video className="w-14 h-14 text-white" />
          )}
        </motion.div>

        {/* Spinner badge */}
        <motion.div
          className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-lg z-20"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
        >
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        </motion.div>
      </div>

      {/* Status text with smooth transitions */}
      <div className="text-center space-y-2">
        <motion.h2
          className="text-2xl font-semibold text-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {audioOnly ? "Audio Interview" : "Video Interview"}
        </motion.h2>

        <div className="h-6 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={statusIndex}
              className="text-muted-foreground absolute inset-x-0"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {STATUS_MESSAGES[statusIndex].text}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Animated loading dots */}
      <div className="flex gap-2.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-blue-500"
            animate={{
              y: [0, -12, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Skeleton preview of interview UI */}
      <motion.div
        className="w-full max-w-xl bg-card/80 backdrop-blur rounded-2xl shadow-lg p-6 space-y-5 border border-border"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        {/* Question skeleton */}
        <div className="space-y-2">
          <motion.div
            className="h-3 w-20 rounded bg-muted"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.div
            className="h-5 w-full rounded bg-muted/50"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }}
          />
          <motion.div
            className="h-5 w-2/3 rounded bg-muted/50"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
          />
        </div>

        {/* Waveform skeleton */}
        <div className="flex items-center justify-center gap-1 py-6">
          {Array.from({ length: 16 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-blue-200"
              animate={{
                height: [12, 28, 20, 36, 12],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.06,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Controls skeleton */}
        <div className="flex justify-center gap-5">
          <motion.div
            className="h-11 w-11 rounded-full bg-muted"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.div
            className="h-11 w-11 rounded-full bg-muted"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.15 }}
          />
          <motion.div
            className="h-11 w-11 rounded-full bg-muted"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

export default function NewVideoInterviewPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NewVideoInterviewContent />
    </Suspense>
  );
}
