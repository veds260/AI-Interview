"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mic,
  MicOff,
  Loader2,
  Phone,
  PhoneOff,
  RefreshCw,
  CheckCircle,
  MessageSquare,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import HeyGenAvatar from "@/components/interview/heygen-avatar";

interface Message {
  role: "interviewer" | "user";
  content: string;
  timestamp: Date;
}

export default function VideoInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted so avatar can speak first
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [shouldAutoSpeak, setShouldAutoSpeak] = useState(true); // Control auto-speak on resume
  const [messages, setMessages] = useState<Message[]>([]);
  const [progress, setProgress] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interviewComplete, setInterviewComplete] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processingResponseRef = useRef(false);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize interview
  useEffect(() => {
    const initInterview = async () => {
      try {
        const res = await fetch(`/api/interviews/${interviewId}`);
        if (!res.ok) throw new Error("Failed to load interview");

        const data = await res.json();

        if (data.interview.status === "completed") {
          router.push("/client/interviews");
          return;
        }

        // Load existing messages from previous session
        const existingMessages = (data.messages || []).map((m: any) => ({
          role: m.role === "client" ? "user" : "interviewer",
          content: m.content,
          timestamp: new Date(m.timestamp),
        }));

        const question = data.currentQuestion;
        setMessages(existingMessages);

        // Check if the current question was already answered
        // Find if this question exists in messages and has a response after it
        let questionAlreadyAnswered = false;
        let questionExistsInMessages = false;

        for (let i = existingMessages.length - 1; i >= 0; i--) {
          const msg = existingMessages[i];
          if (msg.role === "interviewer" && msg.content === question) {
            questionExistsInMessages = true;
            // Found the question - check if there's a user response after it
            const hasResponseAfter = existingMessages.slice(i + 1).some(
              (m: Message) => m.role === "user"
            );
            if (hasResponseAfter) {
              questionAlreadyAnswered = true;
            }
            break;
          }
        }

        // If question is NEW (not in messages), always speak it
        // If question exists but wasn't answered, speak it
        // If question was answered, we need to get the next question
        const shouldSpeak = question && !questionAlreadyAnswered;

        if (questionAlreadyAnswered) {
          console.log("Question already answered, fetching next question...");
          // The user already answered this - we need to get the next question
          setMessages(existingMessages);
          setCurrentQuestion(null);
          setShouldAutoSpeak(false);

          // Call continue endpoint to get the next question
          setTimeout(async () => {
            try {
              const res = await fetch(`/api/interviews/${interviewId}/continue`, {
                method: "POST",
              });
              const data = await res.json();
              if (data.nextQuestion) {
                setCurrentQuestion(data.nextQuestion);
                setMessages(prev => [...prev, {
                  role: "interviewer",
                  content: data.nextQuestion,
                  timestamp: new Date(),
                }]);
                setProgress(data.progress || 0);
                // Speak the new question after avatar is ready
                setTimeout(() => {
                  (window as any).heygenSpeak?.(data.nextQuestion);
                }, 1500);
              } else if (data.completed) {
                setInterviewComplete(true);
                setShowCompleteDialog(true);
              }
            } catch (err) {
              console.error("Error getting next question:", err);
            }
          }, 1000);
        } else if (question) {
          setCurrentQuestion(question);
          setShouldAutoSpeak(shouldSpeak);

          // Add question to messages if not there
          if (!questionExistsInMessages) {
            setMessages([...existingMessages, {
              role: "interviewer",
              content: question,
              timestamp: new Date(),
            }]);
          }
        } else {
          setCurrentQuestion(null);
          setShouldAutoSpeak(false);
        }

        const state = data.interview.sessionState;
        if (state?.questionIds) {
          setProgress(((state.currentIndex || 0) / state.questionIds.length) * 100);
        }
      } catch (error) {
        console.error("Failed to load interview:", error);
        setError("Failed to load interview. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    initInterview();
  }, [interviewId, router]);

  // Handle avatar ready
  const handleAvatarReady = useCallback(() => {
    setIsConnected(true);
  }, []);

  // Handle user transcript from HeyGen's voice chat STT
  const handleTranscript = useCallback(
    async (text: string, isFinal: boolean) => {
      if (!isFinal || processingResponseRef.current || !text.trim()) return;

      // Filter out short filler words/sounds (less than 15 chars or common fillers)
      const cleanText = text.trim();
      const fillerWords = ['oh', 'ah', 'um', 'uh', 'hmm', 'hm', 'er', 'erm', 'like', 'yeah', 'yes', 'no', 'okay', 'ok'];
      if (cleanText.length < 15 || fillerWords.includes(cleanText.toLowerCase())) {
        console.log("Ignoring filler/short response:", cleanText);
        return;
      }

      // IMPORTANT: Don't process if the text is similar to the current question (echo protection)
      if (currentQuestion && cleanText.toLowerCase().includes(currentQuestion.toLowerCase().substring(0, 30))) {
        console.log("Ignoring echo of current question");
        return;
      }

      processingResponseRef.current = true;

      // Add user message
      setMessages((prev) => [
        ...prev,
        { role: "user", content: cleanText, timestamp: new Date() },
      ]);

      try {
        // Submit response to backend
        const res = await fetch(`/api/interviews/${interviewId}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response: cleanText }), // Use cleanText, not text
        });

        if (!res.ok) throw new Error("Failed to submit response");

        const data = await res.json();

        if (data.completed) {
          setInterviewComplete(true);
          setShowCompleteDialog(true);

          // Thank the user
          const thankYou =
            "Thank you so much for sharing your story with me today. Your insights are incredibly valuable, and I really appreciate your time. Take care!";
          setMessages((prev) => [
            ...prev,
            { role: "interviewer", content: thankYou, timestamp: new Date() },
          ]);
          (window as any).heygenSpeak?.(thankYou);
        } else if (data.nextQuestion) {
          setCurrentQuestion(data.nextQuestion);
          setProgress(data.progress || progress);

          // Add next question to messages
          setMessages((prev) => [
            ...prev,
            {
              role: "interviewer",
              content: data.nextQuestion,
              timestamp: new Date(),
            },
          ]);

          // Speak the next question
          setTimeout(() => {
            (window as any).heygenSpeak?.(data.nextQuestion);
          }, 500);
        }
      } catch (error) {
        console.error("Error submitting response:", error);
        toast.error("Failed to process your response");
      } finally {
        processingResponseRef.current = false;
      }
    },
    [interviewId, progress, currentQuestion]
  );

  // Repeat current question
  const repeatQuestion = useCallback(() => {
    if (currentQuestion && !isAvatarSpeaking) {
      (window as any).heygenSpeak?.(currentQuestion);
    }
  }, [currentQuestion, isAvatarSpeaking]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    (window as any).heygenToggleMute?.();
    setIsMuted(!isMuted);
  }, [isMuted]);

  // End interview
  const handleEndInterview = async () => {
    try {
      await fetch(`/api/interviews/${interviewId}/pause`, { method: "POST" });
      toast.success("Interview saved");
      router.push("/client/interviews");
    } catch (error) {
      toast.error("Failed to save interview");
    }
  };

  // Complete interview
  const handleCompleteInterview = async () => {
    try {
      await fetch(`/api/interviews/${interviewId}/complete`, { method: "POST" });
      router.push("/client/interviews");
    } catch (error) {
      toast.error("Failed to complete interview");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-gray-400">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <Card className="max-w-md bg-gray-900 border-gray-800">
          <CardContent className="pt-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={() => router.push("/client")} variant="secondary">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            <span className="text-sm text-gray-400">
              {isConnected ? "Connected" : "Connecting..."}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {Math.round(progress)}% complete
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEndDialog(true)}
            className="text-gray-400 hover:text-white"
          >
            <PhoneOff className="w-4 h-4 mr-1" />
            End
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-1 rounded-none" />

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        {/* Avatar section */}
        <div className="lg:w-1/2 flex flex-col">
          <HeyGenAvatar
            onReady={handleAvatarReady}
            onError={(err) => console.error("Avatar error:", err)}
            onAvatarSpeaking={setIsAvatarSpeaking}
            onUserSpeaking={setIsUserSpeaking}
            onTranscript={handleTranscript}
            initialQuestion={shouldAutoSpeak ? currentQuestion || undefined : undefined}
          />

          {/* Controls */}
          <div className="flex justify-center gap-3 mt-4">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="lg"
              onClick={toggleMute}
              className="rounded-full w-14 h-14"
            >
              {isMuted ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={repeatQuestion}
              disabled={isAvatarSpeaking || !currentQuestion}
              className="rounded-full w-14 h-14"
              title="Repeat question"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-3">
            {isMuted
              ? "Tap to unmute and speak"
              : isAvatarSpeaking
              ? "Listening to interviewer..."
              : isUserSpeaking
              ? "Listening to you..."
              : "Speak naturally when ready"}
          </p>
        </div>

        {/* Transcript section */}
        <div className="lg:w-1/2 flex flex-col bg-gray-900 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Conversation</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-100"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.role === "user" ? "text-blue-200" : "text-gray-500"
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Current question highlight */}
          {currentQuestion && !interviewComplete && (
            <div className="px-4 py-3 border-t border-gray-800 bg-gray-800/50">
              <p className="text-xs text-gray-400 mb-1">Current Question</p>
              <p className="text-sm text-gray-200">{currentQuestion}</p>
            </div>
          )}
        </div>
      </div>

      {/* End Interview Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">End Interview?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Your progress will be saved. You can return and continue the
              interview later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white border-gray-700">
              Continue
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndInterview}
              className="bg-red-600 hover:bg-red-700"
            >
              End & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Interview Complete!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Thank you for sharing your story. Your responses have been saved
              and will be processed to create amazing content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleCompleteInterview}
              className="bg-green-600 hover:bg-green-700"
            >
              Finish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
