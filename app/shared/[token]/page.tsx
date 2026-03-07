"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Mic,
  MicOff,
  MessageSquare,
  AlertCircle,
  Send,
  CheckCircle2,
  Volume2,
  Pause,
} from "lucide-react";
import { toast } from "sonner";

type InterviewMode = "text" | "audio";
type PageState = "loading" | "error" | "name_entry" | "mode_select" | "interview" | "paused" | "completed";

interface InterviewData {
  id: string;
  title: string | null;
  mode: string;
  status: string;
  questionsCount: number | null;
  completedAt: string | null;
  guestName: string | null;
}

export default function SharedInterviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [guestName, setGuestName] = useState("");
  const [interviewMode, setInterviewMode] = useState<InterviewMode>("text");
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [progress, setProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // Fetch interview data
  const { error: fetchError } = useQuery({
    queryKey: ["shared-interview", token],
    queryFn: async () => {
      const res = await fetch(`/api/interviews/share/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch");
      }
      const data = await res.json();

      setInterviewData(data.interview);
      setCurrentQuestion(data.currentQuestion);
      setProgress(data.progress || 0);
      if (data.client) setClientName(data.client.name);

      if (data.interview.status === "completed") {
        setPageState("completed");
      } else if (data.interview.status === "paused") {
        setGuestName(data.interview.guestName || "");
        setPageState("paused");
      } else if (data.interview.guestName) {
        setPageState("mode_select");
      } else {
        setPageState("name_entry");
      }

      return data;
    },
  });

  useEffect(() => {
    if (fetchError) setPageState("error");
  }, [fetchError]);

  // Submit guest name (also resumes paused interviews)
  const submitName = async () => {
    if (!guestName.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/interviews/share/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName: guestName.trim() }),
      });

      if (!res.ok) throw new Error("Failed");
      setPageState("mode_select");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resume from paused state
  const resumeInterview = async () => {
    setIsSubmitting(true);
    try {
      // PATCH re-sets status to in_progress
      const res = await fetch(`/api/interviews/share/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName: guestName || interviewData?.guestName }),
      });
      if (!res.ok) throw new Error("Failed");

      // Re-fetch to get current question
      const dataRes = await fetch(`/api/interviews/share/${token}`);
      if (dataRes.ok) {
        const data = await dataRes.json();
        setCurrentQuestion(data.currentQuestion);
        setProgress(data.progress || 0);
      }

      setPageState("mode_select");
    } catch {
      toast.error("Failed to resume interview.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pause interview
  const pauseInterview = async () => {
    stopListening();
    try {
      const res = await fetch(`/api/interviews/share/${token}/pause`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      setPageState("paused");
      toast.success("Interview paused. You can come back anytime.");
    } catch {
      toast.error("Failed to pause.");
    }
  };

  const selectMode = (mode: InterviewMode) => {
    if (mode === "audio" && !speechSupported) {
      toast.error("Your browser doesn't support speech recognition. Using text mode.");
      mode = "text";
    }
    setInterviewMode(mode);
    setPageState("interview");

    if (mode === "audio" && currentQuestion) {
      speakQuestion(currentQuestion);
    }
  };

  const speakQuestion = async (text: string) => {
    setIsPlaying(true);
    try {
      const res = await fetch(`/api/interviews/share/${token}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        setIsPlaying(false);
        return;
      }

      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(data.audio);
        audioRef.current = audio;
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
        audio.play();
      } else {
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(false);
    }
  };

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = response;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? " " : "") + transcript;
          setResponse(finalTranscript);
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [response]);

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const submitResponse = async () => {
    if (!response.trim()) {
      toast.error("Please provide an answer before continuing.");
      return;
    }

    stopListening();
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/interviews/share/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: response.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      const data = await res.json();
      setResponse("");

      if (data.completed) {
        setPageState("completed");
      } else {
        setCurrentQuestion(data.nextQuestion);
        setProgress(data.progress || 0);
        setQuestionNumber((n) => n + 1);

        if (interviewMode === "audio" && data.nextQuestion) {
          speakQuestion(data.nextQuestion);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================
  // RENDER
  // ==================

  if (pageState === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="mt-3 text-gray-500">Loading interview...</p>
        </div>
      </Shell>
    );
  }

  if (pageState === "error") {
    return (
      <Shell>
        <Card className="max-w-md mx-auto mt-16">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Interview Not Found</CardTitle>
            </div>
            <CardDescription>
              This link may have expired or is no longer valid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Please contact the person who shared this link for a new one.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (pageState === "name_entry") {
    return (
      <Shell>
        <Card className="max-w-md mx-auto mt-16">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome to Your Interview</CardTitle>
            <CardDescription>
              {clientName
                ? `Interview for ${clientName}`
                : "Let's get started with a few questions"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Your name
              </label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your name"
                onKeyDown={(e) => e.key === "Enter" && submitName()}
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              onClick={submitName}
              disabled={!guestName.trim() || isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Continue
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (pageState === "paused") {
    return (
      <Shell>
        <Card className="max-w-md mx-auto mt-16">
          <CardHeader className="text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-yellow-100 flex items-center justify-center mb-3">
              <Pause className="h-7 w-7 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl">Interview Paused</CardTitle>
            <CardDescription>
              Welcome back{interviewData?.guestName ? `, ${interviewData.guestName}` : ""}! Pick up where you left off.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground text-center mb-2">
              {Math.round(progress)}% completed
            </div>
            <Progress value={progress} className="h-2 mb-4" />
            <Button
              className="w-full"
              onClick={resumeInterview}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Resume Interview
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (pageState === "mode_select") {
    return (
      <Shell>
        <Card className="max-w-lg mx-auto mt-16">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">How would you like to answer?</CardTitle>
            <CardDescription>
              Choose your preferred interview mode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-20 flex items-center gap-4 justify-start px-6"
              onClick={() => selectMode("text")}
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-base">Text</p>
                <p className="text-sm text-muted-foreground">Type your answers at your own pace</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full h-20 flex items-center gap-4 justify-start px-6"
              onClick={() => selectMode("audio")}
              disabled={!speechSupported}
            >
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                <Mic className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-base">Audio</p>
                <p className="text-sm text-muted-foreground">
                  {speechSupported
                    ? "Listen to questions and speak your answers"
                    : "Not supported in this browser"}
                </p>
              </div>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (pageState === "completed") {
    return (
      <Shell>
        <div className="max-w-lg mx-auto text-center mt-16">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Interview Complete</h1>
          <p className="text-gray-500 mb-6">
            Thank you for your time! Your responses have been recorded.
          </p>
          <p className="text-sm text-gray-400">
            You can close this page now.
          </p>
        </div>
      </Shell>
    );
  }

  // ==================
  // INTERVIEW IN PROGRESS
  // ==================
  return (
    <Shell>
      <div className="max-w-2xl mx-auto mt-4">
        {/* Progress + Pause */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Question {questionNumber}</span>
            <div className="flex items-center gap-3">
              <span>{Math.round(progress)}% complete</span>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground h-7 px-2"
                onClick={pauseInterview}
              >
                <Pause className="h-3.5 w-3.5 mr-1" />
                Pause
              </Button>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-lg font-medium leading-relaxed">
              {currentQuestion || "Loading question..."}
            </p>
            {interviewMode === "audio" && currentQuestion && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-3 text-muted-foreground"
                onClick={() => speakQuestion(currentQuestion)}
                disabled={isPlaying}
              >
                {isPlaying ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Volume2 className="h-4 w-4 mr-1" />
                )}
                {isPlaying ? "Speaking..." : "Listen again"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Answer area */}
        <Card>
          <CardContent className="pt-6">
            {interviewMode === "audio" ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={isPlaying}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                      isListening
                        ? "bg-red-500 hover:bg-red-600 animate-pulse"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="h-8 w-8 text-white" />
                    ) : (
                      <Mic className="h-8 w-8 text-gray-600" />
                    )}
                  </button>
                  <p className="text-sm text-muted-foreground">
                    {isPlaying
                      ? "Listening to question..."
                      : isListening
                      ? "Listening... tap to stop"
                      : "Tap to start speaking"}
                  </p>
                </div>

                {response && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">
                      Your answer (you can edit this):
                    </label>
                    <Textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                )}
              </div>
            ) : (
              <Textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Type your answer here..."
                rows={6}
                className="resize-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    submitResponse();
                  }
                }}
              />
            )}

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {interviewMode === "text" ? "Ctrl+Enter to submit" : ""}
              </p>
              <Button
                onClick={submitResponse}
                disabled={!response.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit Answer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 py-4 px-4">
        <div className="max-w-3xl mx-auto">
          <Image
            src="/logo.svg"
            alt="Compound"
            width={140}
            height={32}
            className="h-7 w-auto"
          />
        </div>
      </div>
      <div className="px-4 pb-12">{children}</div>
    </div>
  );
}
