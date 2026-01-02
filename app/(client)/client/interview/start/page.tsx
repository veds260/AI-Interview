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
import { Video, MessageSquare, Loader2, ArrowLeft, Mic, Zap, CheckCircle } from "lucide-react";
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
  // Default to audio-only for faster startup (HeyGen video takes 5-10s to connect)
  const [audioOnly, setAudioOnly] = useState(true);

  const handleStartInterview = async () => {
    if (!selectedMode) {
      toast.error("Please select an interview mode");
      return;
    }

    setIsCreating(true);

    // Navigate IMMEDIATELY - interview will be created on the interview page
    // This gives instant feedback to the user
    if (selectedMode === "text_chat") {
      router.push(`/client/interview/text/new`);
    } else {
      const audioParam = audioOnly ? "?audioOnly=true" : "";
      router.push(`/client/interview/video/new${audioParam}`);
    }
  };

  return (
    <motion.div
      className="max-w-2xl mx-auto space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-4">
        <Link href="/client">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </motion.div>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Start Interview</h1>
          <p className="text-gray-500 mt-1">
            Choose how you want to be interviewed
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Card
            className={`cursor-pointer transition-all h-full ${
              selectedMode === "live_video"
                ? "border-2 border-blue-500 bg-blue-50 shadow-lg shadow-blue-100"
                : "hover:border-gray-300 hover:shadow-md"
            }`}
            onClick={() => setSelectedMode("live_video")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <motion.div
                  animate={{
                    scale: selectedMode === "live_video" ? [1, 1.1, 1] : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {audioOnly ? (
                    <Mic
                      className={`h-8 w-8 ${
                        selectedMode === "live_video"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                    />
                  ) : (
                    <Video
                      className={`h-8 w-8 ${
                        selectedMode === "live_video"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                    />
                  )}
                </motion.div>
                <AnimatePresence>
                  {selectedMode === "live_video" && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <CardTitle className="mt-4">{audioOnly ? "Audio Interview" : "Video Interview"}</CardTitle>
              <CardDescription>
                {audioOnly ? "Voice-only conversation - faster & lighter" : "Have a live conversation with our AI avatar"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                {audioOnly ? (
                  <>
                    <li className="flex items-center gap-1"><Zap className="h-3 w-3 text-yellow-500" /> Faster response times</li>
                    <li>- Voice conversation only</li>
                    <li>- Works better on slow connections</li>
                    <li>- Lower data usage</li>
                  </>
                ) : (
                  <>
                    <li>- Real-time video conversation</li>
                    <li>- Natural speaking experience</li>
                    <li>- AI adapts to your responses</li>
                    <li>- Recording saved for reference</li>
                  </>
                )}
              </ul>
              <AnimatePresence>
                {selectedMode === "live_video" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 pt-4 border-t flex items-center justify-between"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Label htmlFor="audio-only" className="text-sm cursor-pointer">
                      <span className="font-medium flex items-center gap-1">
                        {audioOnly ? "Audio mode" : "Video avatar mode"}
                        {audioOnly && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Recommended</span>}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {audioOnly ? "Instant start, high-quality voice" : "Takes 5-10s to connect, has watermark"}
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

        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Card
            className={`cursor-pointer transition-all h-full ${
              selectedMode === "text_chat"
                ? "border-2 border-green-500 bg-green-50 shadow-lg shadow-green-100"
                : "hover:border-gray-300 hover:shadow-md"
            }`}
            onClick={() => setSelectedMode("text_chat")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <motion.div
                  animate={{
                    scale: selectedMode === "text_chat" ? [1, 1.1, 1] : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <MessageSquare
                    className={`h-8 w-8 ${
                      selectedMode === "text_chat"
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}
                  />
                </motion.div>
                <AnimatePresence>
                  {selectedMode === "text_chat" && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <CardTitle className="mt-4">Text Interview</CardTitle>
              <CardDescription>
                Answer questions at your own pace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>- Type your responses</li>
                <li>- Pause and resume anytime</li>
                <li>- Perfect for busy schedules</li>
                <li>- Edit before submitting</li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        className="flex justify-end gap-4 pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Link href="/client">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button variant="outline">Cancel</Button>
          </motion.div>
        </Link>
        <motion.div
          whileHover={{ scale: selectedMode && !isCreating ? 1.03 : 1 }}
          whileTap={{ scale: selectedMode && !isCreating ? 0.97 : 1 }}
        >
          <Button
            onClick={handleStartInterview}
            disabled={!selectedMode || isCreating}
            size="lg"
            className="min-w-[140px]"
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
                >
                  Start Interview
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function LoadingFallback() {
  return (
    <motion.div
      className="max-w-2xl mx-auto space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <div className="flex justify-end gap-4 pt-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
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
