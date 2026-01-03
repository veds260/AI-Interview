"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Pause,
  CheckCircle,
  Video,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import SimliAvatar from "@/components/interview/simli-avatar";

interface InterviewState {
  questionIds: string[];
  currentIndex: number;
}

export default function LiveInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [displayedQuestion, setDisplayedQuestion] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [progress, setProgress] = useState(0);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);
  const lastSpokenQuestionRef = useRef<string | null>(null);
  const avatarReadyRef = useRef(false);

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

        const question = data.currentQuestion;
        setCurrentQuestion(question);
        setDisplayedQuestion(question);

        const state = data.interview.sessionState as InterviewState;
        if (state?.questionIds) {
          setProgress(
            ((state.currentIndex || 0) / state.questionIds.length) * 100
          );
        }
      } catch (error) {
        console.error("Failed to load interview:", error);
        setError("Failed to load interview. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    initInterview();

    return () => {
      // Cleanup
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [interviewId, router]);

  // Helper to stop speaking state
  const stopSpeaking = useCallback(() => {
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Speak question when avatar is ready or question changes
  const speakQuestion = useCallback(async (questionText: string) => {
    if (!questionText) return;

    // Prevent multiple simultaneous speech calls or duplicate questions
    if (isSpeakingRef.current) {
      console.log("Already speaking, skipping duplicate call");
      return;
    }

    if (lastSpokenQuestionRef.current === questionText) {
      console.log("Question already spoken, skipping");
      return;
    }

    console.log("Speaking question:", questionText.substring(0, 50) + "...");
    isSpeakingRef.current = true;
    lastSpokenQuestionRef.current = questionText;
    setIsSpeaking(true);
    setDisplayedQuestion(questionText);

    // Check if Simli is connected for lip-sync
    const simliConnected = typeof window !== "undefined" && (window as any).simliIsConnected?.();

    // Try ElevenLabs TTS
    try {
      const res = await fetch("/api/avatar/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: questionText,
          forSimli: simliConnected, // Request PCM if Simli is connected
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // If Simli is connected and we have PCM data, send it for lip-sync
        if (simliConnected && data.pcmData) {
          console.log("Sending PCM to Simli for lip-sync");
          // Decode base64 PCM data
          const binaryString = atob(data.pcmData);
          const pcmArray = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            pcmArray[i] = binaryString.charCodeAt(i);
          }

          // Send to Simli for lip-sync - Simli handles audio playback via its audioRef
          (window as any).simliSendAudio?.(pcmArray);

          // Estimate duration based on PCM length (16kHz, 16-bit = 32000 bytes/sec)
          const durationMs = (pcmArray.length / 32000) * 1000;
          setTimeout(stopSpeaking, durationMs + 500);
          return;
        }

        // Fallback: Just play MP3 without lip-sync
        if (data.audioUrl) {
          const audio = new Audio(data.audioUrl);
          audio.onended = stopSpeaking;
          await audio.play();
          return;
        }
      }
    } catch (error) {
      console.error("TTS error:", error);
    }

    // Fallback: Browser speech synthesis
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(questionText);
      utterance.rate = 0.9;
      utterance.onend = stopSpeaking;
      speechSynthesis.speak(utterance);
    } else {
      setTimeout(stopSpeaking, 2000);
    }
  }, [stopSpeaking]);

  // Avatar ready handler - only speak once when first ready
  const handleAvatarReady = useCallback(() => {
    if (avatarReadyRef.current) {
      console.log("Avatar already ready, skipping duplicate call");
      return;
    }
    console.log("Avatar ready, will speak initial question");
    avatarReadyRef.current = true;
    setAvatarReady(true);
    if (currentQuestion) {
      setTimeout(() => speakQuestion(currentQuestion), 500);
    }
  }, [currentQuestion, speakQuestion]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        processAudio(audioBlob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setTranscript("");

      // Set up speech recognition for live transcript
      const SpeechRecognitionAPI = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setTranscript((prev) => prev + " " + finalTranscript);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    let transcribedText = "";
    let audioKey: string | null = null;

    // Try ElevenLabs STT (also uploads audio to R2 in background)
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("language_code", "en");
      formData.append("interviewId", interviewId);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim()) {
          transcribedText = data.text.trim();
          audioKey = data.audioKey || null;
        }
      }
    } catch (error) {
      console.error("ElevenLabs STT error:", error);
    }

    const finalText = transcribedText || transcript.trim();

    if (finalText) {
      await submitResponse(finalText, audioKey);
    } else {
      toast.error("Could not capture your response. Please try again and speak clearly.");
    }

    setIsProcessing(false);
  };

  const submitResponse = async (response: string, audioKey?: string | null) => {
    try {
      const res = await fetch(`/api/interviews/${interviewId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, audioKey }),
      });

      if (!res.ok) throw new Error("Failed to submit response");

      const data = await res.json();
      setTranscript("");

      if (data.completed) {
        setShowCompleteDialog(true);
      } else if (data.nextQuestion) {
        // Reset the last spoken question so the new one can be spoken
        lastSpokenQuestionRef.current = null;
        setCurrentQuestion(data.nextQuestion);
        setProgress(data.progress || progress);

        // Speak the next question
        setTimeout(() => {
          speakQuestion(data.nextQuestion);
        }, 500);
      }
    } catch (error) {
      toast.error("Failed to submit response");
    }
  };

  const handlePauseInterview = async () => {
    stopRecording();
    try {
      await fetch(`/api/interviews/${interviewId}/pause`, { method: "POST" });
      toast.success("Interview paused");
      router.push("/client/interviews");
    } catch (error) {
      toast.error("Failed to pause interview");
    }
  };

  const handleCompleteInterview = async () => {
    try {
      await fetch(`/api/interviews/${interviewId}/complete`, { method: "POST" });
      toast.success("Interview completed!");
      router.push("/client/interviews");
    } catch (error) {
      toast.error("Failed to complete interview");
    }
  };

  const toggleMic = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => router.push("/client")}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Interview</h1>
          <p className="text-sm text-gray-500">
            Speak naturally with the AI interviewer
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPauseDialog(true)}
        >
          <Pause className="mr-1 h-4 w-4" />
          Pause
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Main Interview Area */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Avatar Video */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <SimliAvatar
              onReady={handleAvatarReady}
              onError={(err) => console.error("Avatar error:", err)}
            />
            {isSpeaking && (
              <div className="p-2 bg-gray-100 flex items-center justify-center gap-2">
                <Volume2 className="w-4 h-4 text-green-600 animate-pulse" />
                <span className="text-sm text-green-600">Speaking...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Question & Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Question</CardTitle>
            <CardDescription>Listen and respond when ready</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 min-h-[100px]">
              {displayedQuestion ? (
                <p className="text-gray-900">{displayedQuestion}</p>
              ) : (
                <p className="text-gray-400">Loading question...</p>
              )}
            </div>

            {/* Live Transcript */}
            {transcript && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Your response:</p>
                <p className="text-gray-900">{transcript}</p>
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-center gap-4 pt-4">
              <Button
                size="lg"
                variant={isRecording ? "destructive" : "default"}
                className="rounded-full w-16 h-16"
                onClick={toggleMic}
                disabled={isSpeaking || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="h-6 w-6" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </Button>
            </div>

            <p className="text-center text-sm text-gray-500">
              {isProcessing
                ? "Processing your response..."
                : isRecording
                ? "Listening... Click to stop and submit"
                : isSpeaking
                ? "Wait for the question to finish..."
                : "Click to start speaking"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Indicators */}
      <div className="flex justify-center gap-4">
        <Badge variant={avatarReady ? "default" : "secondary"}>
          {avatarReady ? "Avatar Ready" : "Connecting..."}
        </Badge>
        <Badge variant={isRecording ? "default" : isProcessing ? "outline" : "secondary"}>
          {isProcessing ? "Transcribing..." : isRecording ? "Recording" : "Not Recording"}
        </Badge>
        <Badge variant={isSpeaking ? "default" : "secondary"}>
          {isSpeaking ? "AI Speaking" : "AI Silent"}
        </Badge>
      </div>

      {/* Pause Dialog */}
      <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause Interview?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress will be saved. You can return and continue the
              interview at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue</AlertDialogCancel>
            <AlertDialogAction onClick={handlePauseInterview}>
              Pause and Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Interview Complete!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Thank you for sharing your story. Your responses have been saved
              and will be processed to extract valuable content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleCompleteInterview}>
              Finish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
