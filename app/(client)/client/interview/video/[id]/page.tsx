"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  AudioLines,
} from "lucide-react";
import { toast } from "sonner";
import HeyGenAvatar from "@/components/interview/heygen-avatar";

// Simple TTS function using Web Speech API
function speakText(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to use a good voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v =>
    v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel")
  );
  if (preferredVoice) utterance.voice = preferredVoice;

  if (onEnd) utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
}

interface Message {
  role: "interviewer" | "user";
  content: string;
  timestamp: Date;
}

function VideoInterviewContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const interviewId = params.id as string;
  const audioOnly = searchParams.get("audioOnly") === "true";

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
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processingResponseRef = useRef(false);
  const pendingQuestionToSpeak = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
              const continueData = await res.json();
              if (continueData.nextQuestion) {
                setCurrentQuestion(continueData.nextQuestion);
                setMessages(prev => [...prev, {
                  role: "interviewer",
                  content: continueData.nextQuestion,
                  timestamp: new Date(),
                }]);
                setProgress(continueData.progress || 0);

                // Store the question to speak - will be spoken when ready
                pendingQuestionToSpeak.current = continueData.nextQuestion;
              } else if (continueData.completed) {
                setInterviewComplete(true);
                setShowCompleteDialog(true);
              }
            } catch (err) {
              console.error("Error getting next question:", err);
            }
          }, 500);
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

  // Speak function - uses HeyGen for video mode, Web Speech API for audio-only
  const speak = useCallback((text: string) => {
    if (audioOnly) {
      setIsAvatarSpeaking(true);
      speakText(text, () => setIsAvatarSpeaking(false));
    } else {
      (window as any).heygenSpeak?.(text);
    }
  }, [audioOnly]);

  // Handle avatar ready (or auto-ready for audio-only)
  const handleAvatarReady = useCallback(() => {
    setIsConnected(true);
    // If there's a pending question to speak (from resume), speak it now
    if (pendingQuestionToSpeak.current) {
      const questionToSpeak = pendingQuestionToSpeak.current;
      pendingQuestionToSpeak.current = null;
      setTimeout(() => {
        console.log("Avatar ready, speaking pending question:", questionToSpeak);
        speak(questionToSpeak);
      }, 500);
    }
  }, [speak]);

  // Auto-connect for audio-only mode
  useEffect(() => {
    if (audioOnly && !isConnected && !isLoading && currentQuestion) {
      // In audio-only mode, connect immediately and speak the first question
      setIsConnected(true);
      setTimeout(() => {
        speak(currentQuestion);
      }, 500);
    }
  }, [audioOnly, isConnected, isLoading, currentQuestion, speak]);

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
            "Thank you so much for sharing! Your insights are valuable. Take care!";
          setMessages((prev) => [
            ...prev,
            { role: "interviewer", content: thankYou, timestamp: new Date() },
          ]);
          speak(thankYou);
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
            speak(data.nextQuestion);
          }, 500);
        }
      } catch (error) {
        console.error("Error submitting response:", error);
        toast.error("Failed to process your response");
      } finally {
        processingResponseRef.current = false;
      }
    },
    [interviewId, progress, currentQuestion, speak]
  );

  // Repeat current question
  const repeatQuestion = useCallback(() => {
    if (currentQuestion && !isAvatarSpeaking) {
      speak(currentQuestion);
    }
  }, [currentQuestion, isAvatarSpeaking, speak]);

  // Toggle mute (for video mode) or start/stop recording (for audio mode)
  const toggleMute = useCallback(() => {
    if (audioOnly) {
      // For audio-only, handle mic recording
      if (isRecordingAudio) {
        // Stop recording
        mediaRecorderRef.current?.stop();
        setIsRecordingAudio(false);
      } else {
        // Start recording
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (e) => {
            audioChunksRef.current.push(e.data);
          };

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            stream.getTracks().forEach(t => t.stop());

            // Transcribe using API
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");

            try {
              const res = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
              });
              const data = await res.json();
              if (data.text) {
                handleTranscript(data.text, true);
              }
            } catch (e) {
              console.error("Transcription error:", e);
            }
          };

          mediaRecorder.start();
          setIsRecordingAudio(true);
        }).catch((e) => {
          console.error("Mic access error:", e);
          toast.error("Could not access microphone");
        });
      }
    } else {
      // For video mode, use HeyGen's mute toggle
      (window as any).heygenToggleMute?.();
      setIsMuted(!isMuted);
    }
  }, [audioOnly, isMuted, isRecordingAudio, handleTranscript]);

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
        {/* Avatar/Audio section */}
        <div className="lg:w-1/2 flex flex-col">
          {audioOnly ? (
            /* Audio-only mode - simple UI */
            <div className="aspect-video bg-gray-900 rounded-lg flex flex-col items-center justify-center relative">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 transition-all ${
                isAvatarSpeaking ? "bg-blue-500/20 animate-pulse" : "bg-gray-800"
              }`}>
                <AudioLines className={`w-16 h-16 ${isAvatarSpeaking ? "text-blue-400" : "text-gray-500"}`} />
              </div>
              <p className="text-gray-400 text-sm">
                {isAvatarSpeaking ? "Speaking..." : isRecordingAudio ? "Listening..." : "Tap mic to respond"}
              </p>
              {/* Current question display */}
              {currentQuestion && (
                <div className="absolute bottom-4 left-4 right-4 bg-gray-800/80 backdrop-blur rounded-lg p-3">
                  <p className="text-white text-sm">{currentQuestion}</p>
                </div>
              )}
            </div>
          ) : (
            /* Video mode - HeyGen avatar */
            <HeyGenAvatar
              onReady={handleAvatarReady}
              onError={(err) => console.error("Avatar error:", err)}
              onAvatarSpeaking={setIsAvatarSpeaking}
              onUserSpeaking={setIsUserSpeaking}
              onTranscript={handleTranscript}
              initialQuestion={shouldAutoSpeak ? currentQuestion || undefined : undefined}
              interviewId={interviewId}
            />
          )}

          {/* Controls */}
          <div className="flex justify-center gap-3 mt-4">
            <Button
              variant={(audioOnly ? isRecordingAudio : !isMuted) ? "secondary" : "destructive"}
              size="lg"
              onClick={toggleMute}
              className="rounded-full w-14 h-14"
            >
              {(audioOnly ? !isRecordingAudio : isMuted) ? (
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

// Export with Suspense boundary for useSearchParams
export default function VideoInterviewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading interview...</p>
        </div>
      </div>
    }>
      <VideoInterviewContent />
    </Suspense>
  );
}
