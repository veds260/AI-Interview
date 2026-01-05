"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageSquare, Loader2, ArrowLeft, Mic, Zap, Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

function InterviewStartContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedMode = searchParams.get("mode");

  const [selectedMode, setSelectedMode] = useState<
    "live_video" | "text_chat" | null
  >(preselectedMode as "live_video" | "text_chat" | null);
  const [isCreating, setIsCreating] = useState(false);
  const [audioOnly, setAudioOnly] = useState(true);

  const handleStartInterview = async () => {
    if (!selectedMode) {
      toast.error("Please select an interview mode");
      return;
    }

    setIsCreating(true);

    if (selectedMode === "text_chat") {
      router.push(`/client/interview/text/new`);
    } else {
      const audioParam = audioOnly ? "?audioOnly=true" : "";
      router.push(`/client/interview/video/new${audioParam}`);
    }
  };

  return (
    <motion.div
      className="max-w-2xl mx-auto space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/client">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </motion.div>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Choose Your Style</h1>
          <p className="text-muted-foreground mt-1">
            Voice or text. Both work great.
          </p>
        </div>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Voice Interview Card */}
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Card
            className={`cursor-pointer transition-all duration-300 h-full ${
              selectedMode === "live_video"
                ? "border-2 border-red-500 bg-red-500/5 shadow-[0_0_30px_-10px_rgba(255,0,0,0.3)]"
                : "border-2 border-transparent hover:border-gray-700 hover:shadow-xl bg-gray-900/30"
            }`}
            onClick={() => setSelectedMode("live_video")}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                  selectedMode === "live_video" ? "bg-red-500/20" : "bg-gray-800"
                }`}>
                  <Mic className={`h-6 w-6 ${selectedMode === "live_video" ? "text-red-500" : "text-gray-400"}`} />
                </div>
                <AnimatePresence>
                  {selectedMode === "live_video" && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <CardTitle className="mt-4 text-xl">Voice Interview</CardTitle>
              <CardDescription className="text-gray-400">
                Speak naturally. We'll listen and ask follow-ups.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-500 space-y-2">
                <li className="flex items-center gap-2">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span>Instant response times</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 flex items-center justify-center text-gray-600">-</span>
                  <span>Natural conversation flow</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 flex items-center justify-center text-gray-600">-</span>
                  <span>AI adapts to your answers</span>
                </li>
              </ul>
              <AnimatePresence>
                {selectedMode === "live_video" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Label htmlFor="audio-only" className="text-sm cursor-pointer">
                      <span className="font-medium flex items-center gap-2">
                        {audioOnly ? "Audio mode" : "Video avatar"}
                        {audioOnly && (
                          <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {audioOnly ? "Fast start, high-quality voice" : "5-10s to connect"}
                      </span>
                    </Label>
                    <Switch
                      id="audio-only"
                      checked={audioOnly}
                      onCheckedChange={setAudioOnly}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Text Interview Card */}
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Card
            className={`cursor-pointer transition-all duration-300 h-full ${
              selectedMode === "text_chat"
                ? "border-2 border-emerald-500 bg-emerald-500/5 shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)]"
                : "border-2 border-transparent hover:border-gray-700 hover:shadow-xl bg-gray-900/30"
            }`}
            onClick={() => setSelectedMode("text_chat")}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                  selectedMode === "text_chat" ? "bg-emerald-500/20" : "bg-gray-800"
                }`}>
                  <MessageSquare className={`h-6 w-6 ${selectedMode === "text_chat" ? "text-emerald-500" : "text-gray-400"}`} />
                </div>
                <AnimatePresence>
                  {selectedMode === "text_chat" && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <CardTitle className="mt-4 text-xl">Written Interview</CardTitle>
              <CardDescription className="text-gray-400">
                Type at your own pace. Edit before sending.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-500 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 flex items-center justify-center text-gray-600">-</span>
                  <span>Type your responses</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 flex items-center justify-center text-gray-600">-</span>
                  <span>Pause and resume anytime</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 flex items-center justify-center text-gray-600">-</span>
                  <span>Review before submitting</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <motion.div
        className="flex justify-end gap-4 pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Link href="/client">
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            Cancel
          </Button>
        </Link>
        <Button
          onClick={handleStartInterview}
          disabled={!selectedMode || isCreating}
          variant={selectedMode === "live_video" ? "premium" : "default"}
          size="lg"
          className={`min-w-[160px] ${
            selectedMode === "text_chat"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)]"
              : ""
          }`}
        >
          <AnimatePresence mode="wait">
            {isCreating ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </motion.div>
            ) : (
              <motion.span
                key="start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center"
              >
                Begin Interview
                <ArrowRight className="ml-2 h-4 w-4" />
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>
    </motion.div>
  );
}

function LoadingFallback() {
  return (
    <motion.div
      className="max-w-2xl mx-auto space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="flex justify-end gap-4 pt-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-40" />
      </div>
    </motion.div>
  );
}

export default function InterviewStartPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <InterviewStartContent />
    </Suspense>
  );
}
