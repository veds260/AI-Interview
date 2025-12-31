"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Video, MessageSquare, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function InterviewStartContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedMode = searchParams.get("mode");

  const [selectedMode, setSelectedMode] = useState<
    "live_video" | "text_chat" | null
  >(preselectedMode as "live_video" | "text_chat" | null);
  const [isCreating, setIsCreating] = useState(false);

  const handleStartInterview = async () => {
    if (!selectedMode) {
      toast.error("Please select an interview mode");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create interview");
      }

      const interview = await res.json();

      if (selectedMode === "text_chat") {
        router.push(`/client/interview/text/${interview.id}`);
      } else {
        // Use new video chat experience
        router.push(`/client/interview/video/${interview.id}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start interview"
      );
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/client">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Start Interview</h1>
          <p className="text-gray-500 mt-1">
            Choose how you want to be interviewed
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className={`cursor-pointer transition-all ${
            selectedMode === "live_video"
              ? "border-2 border-blue-500 bg-blue-50"
              : "hover:border-gray-300"
          }`}
          onClick={() => setSelectedMode("live_video")}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <Video
                className={`h-8 w-8 ${
                  selectedMode === "live_video"
                    ? "text-blue-600"
                    : "text-gray-400"
                }`}
              />
              {selectedMode === "live_video" && (
                <div className="w-4 h-4 rounded-full bg-blue-600" />
              )}
            </div>
            <CardTitle className="mt-4">Video Interview</CardTitle>
            <CardDescription>
              Have a live conversation with our AI avatar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>- Real-time video conversation</li>
              <li>- Natural speaking experience</li>
              <li>- AI adapts to your responses</li>
              <li>- Recording saved for reference</li>
            </ul>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            selectedMode === "text_chat"
              ? "border-2 border-green-500 bg-green-50"
              : "hover:border-gray-300"
          }`}
          onClick={() => setSelectedMode("text_chat")}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <MessageSquare
                className={`h-8 w-8 ${
                  selectedMode === "text_chat"
                    ? "text-green-600"
                    : "text-gray-400"
                }`}
              />
              {selectedMode === "text_chat" && (
                <div className="w-4 h-4 rounded-full bg-green-600" />
              )}
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
      </div>

      <div className="flex justify-end gap-4 pt-4">
        <Link href="/client">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          onClick={handleStartInterview}
          disabled={!selectedMode || isCreating}
          size="lg"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            "Start Interview"
          )}
        </Button>
      </div>
    </div>
  );
}

export default function InterviewStartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <InterviewStartContent />
    </Suspense>
  );
}
