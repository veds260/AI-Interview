"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mic, Video } from "lucide-react";
import { toast } from "sonner";

function NewVideoInterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const audioOnly = searchParams.get("audioOnly") === "true";

  const [status, setStatus] = useState("Preparing your interview...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createInterview = async () => {
      try {
        setStatus("Setting up questions...");

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
        setStatus("Starting interview...");

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-red-500 text-lg">{error}</div>
        <button
          onClick={() => router.push("/client/interview/start")}
          className="text-blue-500 hover:underline"
        >
          Go back and try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
          {audioOnly ? (
            <Mic className="w-12 h-12 text-white" />
          ) : (
            <Video className="w-12 h-12 text-white" />
          )}
        </div>
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">
          {audioOnly ? "Audio Interview" : "Video Interview"}
        </h2>
        <p className="text-gray-500">{status}</p>
      </div>

      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      <p className="text-gray-500">Loading...</p>
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
