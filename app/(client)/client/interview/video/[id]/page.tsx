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
  RotateCcw,
  CheckCircle,
  MessageSquare,
  Volume2,
  AudioLines,
  SkipForward,
  VolumeX,
  Send,
  Pause,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import HeyGenAvatar from "@/components/interview/heygen-avatar";
import { perfTracker } from "@/lib/utils/performance-tracker";

// Preload audio for a question (returns promise that resolves to audio URL)
async function preloadAudio(text: string, interviewId: string): Promise<string | null> {
  try {
    console.log("[TTS Preload] Starting for:", text.substring(0, 40) + "...");
    const res = await fetch("/api/avatar/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, interviewId }),
    });
    const data = await res.json();
    if (data.audioUrl) {
      console.log("[TTS Preload] Ready:", text.substring(0, 40) + "...");
      return data.audioUrl;
    }
    return null;
  } catch (error) {
    console.error("[TTS Preload] Failed:", error);
    return null;
  }
}

// Global audio ref for skip functionality
let currentAudioElement: HTMLAudioElement | null = null;

// Stop current audio playback
function stopCurrentAudio() {
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    currentAudioElement = null;
    console.log("[TTS] Audio stopped by user");
  }
}

// ElevenLabs TTS function - retries before any fallback
async function speakWithElevenLabs(
  text: string,
  interviewId: string,
  onStart?: () => void,
  onEnd?: () => void,
  preloadedAudioUrl?: string, // Pre-generated audio URL for instant playback
  preloadingMap?: Map<string, Promise<string | null>> // Map of preloading promises
): Promise<void> {
  if (typeof window === "undefined") return;

  console.log("[TTS] Starting for:", text.substring(0, 50) + "...");
  onStart?.();

  // Check for pre-generated audio first
  let audioUrl = preloadedAudioUrl;

  // If not preloaded, check if it's currently being preloaded
  if (!audioUrl && preloadingMap?.has(text)) {
    console.log("[TTS] Waiting for preloaded audio...");
    audioUrl = await preloadingMap.get(text) || undefined;
    preloadingMap.delete(text);
  }

  // Helper to play audio
  const playAudio = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      currentAudioElement = audio; // Store for skip functionality
      audio.onended = () => {
        console.log("[TTS] Audio finished");
        currentAudioElement = null;
        resolve();
      };
      audio.onerror = (e) => {
        console.error("[TTS] Audio playback error:", e);
        currentAudioElement = null;
        reject(e);
      };
      audio.onpause = () => {
        // If paused externally (skip), resolve
        if (audio.currentTime === 0) {
          resolve();
        }
      };
      audio.play().catch(reject);
    });
  };

  // If we have preloaded audio, play it
  if (audioUrl) {
    console.log("[TTS] Using preloaded audio - instant playback!");
    perfTracker.start("TTS: Audio Playback");
    try {
      await playAudio(audioUrl);
      perfTracker.end("TTS: Audio Playback");
      onEnd?.();
      return;
    } catch (e) {
      console.error("[TTS] Preloaded audio failed, fetching fresh...");
      // Fall through to fetch fresh audio
    }
  }

  // Fetch from ElevenLabs API with retry
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) console.log(`[TTS] Retry attempt ${attempt}...`);

      perfTracker.start("TTS: ElevenLabs API");
      const res = await fetch("/api/avatar/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, interviewId }),
      });

      const data = await res.json();
      perfTracker.end("TTS: ElevenLabs API");

      if (data.audioUrl) {
        console.log("[TTS] Got audio URL, playing...");
        perfTracker.start("TTS: Audio Playback");
        await playAudio(data.audioUrl);
        perfTracker.end("TTS: Audio Playback");
        onEnd?.();
        return;
      } else {
        console.warn("[TTS] No audio URL returned:", data.message || "unknown reason");
        // Continue to retry
      }
    } catch (error) {
      console.error("[TTS] API error:", error);
      // Continue to retry
    }
  }

  // All retries failed - NO browser TTS fallback (consistent voice is critical)
  console.error("[TTS] All ElevenLabs attempts failed - check ELEVENLABS_API_KEY in Railway");
  onEnd?.();
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
  const [isPausedRecording, setIsPausedRecording] = useState(false); // Muted during recording
  const [heygenFallback, setHeygenFallback] = useState(false); // Track if HeyGen fell back to static UI
  const [captureError, setCaptureError] = useState<string | null>(null); // Error when speech capture fails

  // Refs
  const processingResponseRef = useRef(false);
  const pendingQuestionToSpeak = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const preloadedAudioRef = useRef<string | null>(null); // Pre-generated audio URL
  const preloadingAudioRef = useRef<Map<string, Promise<string | null>>>(new Map()); // Audio being preloaded
  const audioStreamRef = useRef<MediaStream | null>(null); // Audio stream for mute/unmute

  // NOTE: Auto-scroll disabled - controls are at top, don't want to scroll users away from them

  // Initialize interview
  useEffect(() => {
    const initInterview = async () => {
      perfTracker.start("Interview Init");

      // Check for pre-generated audio in localStorage (for instant playback)
      const pregenAudioKey = `interview_audio_${interviewId}`;
      const pregenAudio = localStorage.getItem(pregenAudioKey);
      if (pregenAudio) {
        preloadedAudioRef.current = pregenAudio;
        localStorage.removeItem(pregenAudioKey); // Clean up after use
        console.log("[TTS] Found pre-generated audio, will use for first question");
      }

      perfTracker.start("Fetch Interview Data");
      try {
        const res = await fetch(`/api/interviews/${interviewId}`);
        perfTracker.end("Fetch Interview Data");
        if (!res.ok) throw new Error("Failed to load interview");

        const data = await res.json();
        perfTracker.mark("Interview data loaded", `Mode: ${audioOnly ? "audio-only" : "video"}, Questions: ${data.interview.sessionState?.questionIds?.length || 0}`);

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

  // Speak function - uses HeyGen for video mode, ElevenLabs for audio-only or HeyGen fallback
  const speak = useCallback((text: string) => {
    // Use ElevenLabs for audio-only mode OR when HeyGen failed (fallback mode)
    if (audioOnly || heygenFallback) {
      // Check if we have pre-generated audio for this question
      const preloadedUrl = preloadedAudioRef.current;
      if (preloadedUrl) {
        preloadedAudioRef.current = null; // Clear after use
      }
      speakWithElevenLabs(
        text,
        interviewId,
        () => setIsAvatarSpeaking(true),
        () => setIsAvatarSpeaking(false),
        preloadedUrl || undefined,
        preloadingAudioRef.current
      );
    } else {
      // Use HeyGen avatar TTS
      (window as any).heygenSpeak?.(text);
    }
  }, [audioOnly, heygenFallback, interviewId]);

  // Preload audio for a question in background
  const preloadQuestionAudio = useCallback((text: string) => {
    if (!audioOnly || !text) return;
    // Don't preload if already preloading this text
    if (preloadingAudioRef.current.has(text)) return;

    console.log("[Preload] Starting background audio generation...");
    const promise = preloadAudio(text, interviewId);
    preloadingAudioRef.current.set(text, promise);
  }, [audioOnly, interviewId]);

  // Handle avatar ready (or auto-ready for audio-only)
  const handleAvatarReady = useCallback(() => {
    setIsConnected(true);
    // If there's a pending question to speak (from resume), speak it now
    if (pendingQuestionToSpeak.current) {
      const questionToSpeak = pendingQuestionToSpeak.current;
      pendingQuestionToSpeak.current = null;
      // Reduced delay from 500ms to 100ms for faster startup
      setTimeout(() => {
        console.log("Avatar ready, speaking pending question:", questionToSpeak);
        speak(questionToSpeak);
      }, 100);
    }
  }, [speak]);

  // Auto-connect for audio-only mode
  useEffect(() => {
    if (audioOnly && !isConnected && !isLoading && currentQuestion) {
      // In audio-only mode, connect immediately and speak the first question
      setIsConnected(true);
      // Instant start - no delay
      speak(currentQuestion);
    }
  }, [audioOnly, isConnected, isLoading, currentQuestion, speak]);

  // When HeyGen falls back, speak the first question using ElevenLabs
  useEffect(() => {
    if (heygenFallback && isConnected && currentQuestion && shouldAutoSpeak && !isAvatarSpeaking) {
      console.log("[Fallback] HeyGen fell back, speaking first question with ElevenLabs");
      // Small delay to ensure state is settled
      const timer = setTimeout(() => {
        speak(currentQuestion);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [heygenFallback, isConnected, currentQuestion, shouldAutoSpeak, isAvatarSpeaking, speak]);

  // Handle user transcript from HeyGen's voice chat STT
  const handleTranscript = useCallback(
    async (text: string, isFinal: boolean, audioKey?: string) => {
      // Block if: not final, already processing, empty text, or avatar is speaking
      if (!isFinal || processingResponseRef.current || !text.trim() || isAvatarSpeaking) {
        if (isAvatarSpeaking) {
          console.log("[handleTranscript] Blocked - avatar is still speaking");
        }
        return;
      }

      const cleanText = text.trim();

      // IMPORTANT: Don't process if the text is similar to the current question (echo protection)
      if (currentQuestion && cleanText.toLowerCase().includes(currentQuestion.toLowerCase().substring(0, 30))) {
        console.log("Ignoring echo of current question");
        return;
      }

      // Handle short responses - ask for clarification instead of ignoring
      const pureFillerWords = ['oh', 'ah', 'um', 'uh', 'hmm', 'hm', 'er', 'erm'];
      const shortAnswerWords = ['yes', 'no', 'yeah', 'nah', 'okay', 'ok', 'sure', 'maybe', 'nope', 'yep'];

      if (pureFillerWords.includes(cleanText.toLowerCase())) {
        // Pure filler sounds - just ignore these
        console.log("Ignoring pure filler sound:", cleanText);
        return;
      }

      if (cleanText.length < 15 || shortAnswerWords.includes(cleanText.toLowerCase())) {
        // Short answer - ask for clarification
        console.log("Short response detected, asking for clarification:", cleanText);

        const clarificationPrompts = [
          "Could you tell me a bit more about that?",
          "I'd love to hear more details. Can you expand on that?",
          "That's interesting! What made you feel that way?",
          "Could you elaborate a little more?",
          "Would you like to share more, or should we move to the next question?",
        ];
        const clarification = clarificationPrompts[Math.floor(Math.random() * clarificationPrompts.length)];

        // Add the short response to messages
        setMessages((prev) => [
          ...prev,
          { role: "user", content: cleanText, timestamp: new Date() },
          { role: "interviewer", content: clarification, timestamp: new Date() },
        ]);

        // Speak the clarification
        speak(clarification);
        return;
      }

      processingResponseRef.current = true;
      perfTracker.start("Process Response");
      perfTracker.mark("User response received", `Length: ${cleanText.length} chars`);

      // Add user message
      setMessages((prev) => [
        ...prev,
        { role: "user", content: cleanText, timestamp: new Date() },
      ]);

      try {
        // Submit response to backend (follow-ups generated in background)
        perfTracker.start("API: Submit Response");
        const res = await fetch(`/api/interviews/${interviewId}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response: cleanText, audioKey }),
        });
        perfTracker.end("API: Submit Response");

        if (!res.ok) throw new Error("Failed to submit response");

        const data = await res.json();
        perfTracker.mark("Response data", `isFollowUp: ${data.isFollowUp}, completed: ${data.completed}`);

        if (data.completed) {
          setInterviewComplete(true);
          setShowCompleteDialog(true);

          const thankYou =
            "Thank you so much for sharing! Your insights are valuable. Take care!";
          setMessages((prev) => [
            ...prev,
            { role: "interviewer", content: thankYou, timestamp: new Date() },
          ]);
          perfTracker.start("TTS: Thank You");
          speak(thankYou);
        } else if (data.nextQuestion) {
          setCurrentQuestion(data.nextQuestion);
          setProgress(data.progress || progress);

          // Store pre-generated audio URL if available
          if (data.nextQuestionAudioUrl) {
            preloadedAudioRef.current = data.nextQuestionAudioUrl;
            console.log("[TTS] Got pre-generated audio from API");
          }

          // Add next question to messages
          setMessages((prev) => [
            ...prev,
            {
              role: "interviewer",
              content: data.nextQuestion,
              timestamp: new Date(),
            },
          ]);

          // Speak the next question immediately (reduced from 300ms)
          perfTracker.end("Process Response");
          perfTracker.start("TTS: Next Question");
          perfTracker.mark("Speaking question", `Length: ${data.nextQuestion.length} chars`);
          speak(data.nextQuestion);
        }
      } catch (error) {
        console.error("Error submitting response:", error);
        const errorMessage = "I couldn't process your response. Please tap the microphone and try again.";
        setCaptureError(errorMessage);

        // Speak the error using ElevenLabs (same voice as interview)
        speak(errorMessage);

        toast.error("Failed to process your response");
        perfTracker.mark("Error", String(error));
      } finally {
        processingResponseRef.current = false;
      }
    },
    [interviewId, progress, currentQuestion, speak, isAvatarSpeaking]
  );

  // Repeat current question (plays the question audio again)
  const repeatQuestion = useCallback(() => {
    if (currentQuestion && !isAvatarSpeaking) {
      speak(currentQuestion);
    }
  }, [currentQuestion, isAvatarSpeaking, speak]);

  // Retake answer - discard current recording and start fresh
  const retakeAnswer = useCallback(() => {
    // Stop any ongoing recording without submitting
    if (isRecordingAudio && mediaRecorderRef.current) {
      // Clear the ondataavailable handler to prevent processing
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      setIsPausedRecording(false);
    }
    // Stop the stream
    audioStreamRef.current?.getTracks().forEach(t => t.stop());
    audioStreamRef.current = null;
    // Clear audio chunks
    audioChunksRef.current = [];
    // Clear any error
    setCaptureError(null);
    // Re-speak the question so they can try again
    if (currentQuestion) {
      toast.success("Recording discarded. Try again!");
      speak(currentQuestion);
    }
  }, [isRecordingAudio, currentQuestion, speak]);

  // Skip current question (move to next without answering)
  const skipQuestion = useCallback(async () => {
    if (processingResponseRef.current) return;
    processingResponseRef.current = true;

    try {
      // Submit empty skip response
      const res = await fetch(`/api/interviews/${interviewId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: "[SKIPPED]", skipped: true }),
      });

      if (!res.ok) throw new Error("Failed to skip");

      const data = await res.json();

      if (data.completed) {
        setInterviewComplete(true);
        setShowCompleteDialog(true);
      } else if (data.allSkipped) {
        // User skipped all questions without answering any
        toast.error(data.message || "Please answer at least one question to complete the interview.");
        // Don't mark as complete - they need to answer something
      } else if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setProgress(data.progress || progress);

        if (data.nextQuestionAudioUrl) {
          preloadedAudioRef.current = data.nextQuestionAudioUrl;
        }

        setMessages((prev) => [
          ...prev,
          { role: "interviewer", content: data.nextQuestion, timestamp: new Date() },
        ]);

        speak(data.nextQuestion);
      }
    } catch (error) {
      console.error("Error skipping question:", error);
      toast.error("Failed to skip question");
    } finally {
      processingResponseRef.current = false;
    }
  }, [interviewId, progress, speak]);

  // Skip/stop the current audio playback, or skip question if not playing
  const skipAudio = useCallback(() => {
    if (isAvatarSpeaking) {
      // Stop audio if playing
      stopCurrentAudio();
      setIsAvatarSpeaking(false);
      toast.success("Audio skipped");
    } else {
      // Skip to next question
      skipQuestion();
    }
  }, [isAvatarSpeaking, skipQuestion]);

  // Start recording audio
  const startRecording = useCallback(() => {
    setCaptureError(null);
    setIsPausedRecording(false);

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
    }).catch((e) => {
      console.error("Mic access error:", e);
      toast.error("Could not access microphone");
    });
  }, []);

  // Toggle mute/unmute during recording (pause/resume audio capture)
  const toggleRecordingMute = useCallback(() => {
    if (!audioStreamRef.current) return;

    const tracks = audioStreamRef.current.getAudioTracks();
    tracks.forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsPausedRecording(!isPausedRecording);
  }, [isPausedRecording]);

  // Submit the recording
  const submitRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !isRecordingAudio) return;

    // Don't allow submitting while avatar is still speaking
    if (isAvatarSpeaking) {
      toast.error("Please wait for the question to finish");
      return;
    }

    // Stop the recorder
    mediaRecorderRef.current.stop();
    setIsRecordingAudio(false);
    setIsPausedRecording(false);

    // Wait for onstop to fire and process
    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;

      // Transcribe using API
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("interviewId", interviewId);

      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.text) {
          handleTranscript(data.text, true, data.audioKey);
        } else {
          const errorMessage = "I couldn't hear your response clearly. Please tap the microphone and try again, speaking a bit louder.";
          setCaptureError(errorMessage);
          speak(errorMessage);
        }
      } catch (e) {
        console.error("Transcription error:", e);
        const errorMessage = "I couldn't hear your response clearly. Please tap the microphone and try again.";
        setCaptureError(errorMessage);
        speak(errorMessage);
      }
    };
  }, [isRecordingAudio, interviewId, handleTranscript, speak, isAvatarSpeaking]);

  // Toggle mute for video mode (HeyGen)
  const toggleVideoMute = useCallback(() => {
    (window as any).heygenToggleMute?.();
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Keyboard listener for spacebar to toggle mute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle spacebar, and not when typing in inputs
      if (e.code !== "Space") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      e.preventDefault();

      if (audioOnly) {
        if (isRecordingAudio) {
          // Toggle mute during recording
          toggleRecordingMute();
        }
      } else {
        // Video mode - toggle HeyGen mute
        toggleVideoMute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [audioOnly, isRecordingAudio, toggleRecordingMute, toggleVideoMute]);

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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md bg-card border-border">
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            <span className="text-sm text-muted-foreground">
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
            className="text-muted-foreground hover:text-foreground"
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
            <div className="aspect-video bg-card rounded-lg flex flex-col items-center justify-center relative">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 transition-all ${
                isAvatarSpeaking ? "bg-blue-500/20 animate-pulse" : "bg-muted"
              }`}>
                <AudioLines className={`w-16 h-16 ${isAvatarSpeaking ? "text-blue-400" : "text-muted-foreground"}`} />
              </div>
              <p className="text-muted-foreground text-sm">
                {isAvatarSpeaking ? "Speaking..." : isRecordingAudio ? "Listening..." : "Tap mic to respond"}
              </p>
              {/* Current question display */}
              {currentQuestion && (
                <div className="absolute bottom-4 left-4 right-4 bg-muted/80 backdrop-blur rounded-lg p-3">
                  <p className="text-foreground text-sm">{currentQuestion}</p>
                </div>
              )}
            </div>
          ) : (
            /* Video mode - HeyGen avatar */
            <HeyGenAvatar
              onReady={handleAvatarReady}
              onError={(err) => console.error("Avatar error:", err)}
              onFallback={() => {
                console.log("[HeyGen] Falling back to ElevenLabs TTS");
                setHeygenFallback(true);
              }}
              onAvatarSpeaking={setIsAvatarSpeaking}
              onUserSpeaking={setIsUserSpeaking}
              onTranscript={handleTranscript}
              initialQuestion={shouldAutoSpeak ? currentQuestion || undefined : undefined}
              interviewId={interviewId}
            />
          )}

          {/* Capture Error - prominent with animation */}
          {captureError && (
            <div
              className="mx-4 mt-4 bg-red-900/50 border-2 border-red-500 rounded-lg p-4 animate-pulse"
              style={{ animation: "shake 0.5s ease-in-out, pulse 2s infinite" }}
            >
              <p className="text-red-200 font-semibold text-center">{captureError}</p>
              <p className="text-red-300 text-center text-sm mt-2">Tap the microphone below to try again</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-3 mt-4">
            {audioOnly ? (
              /* Audio-only mode controls */
              <>
                {!isRecordingAudio ? (
                  /* Not recording - show Record button */
                  <>
                    {/* Skip button - always visible, skips audio or skips question */}
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={skipAudio}
                        className={`rounded-full w-14 h-14 ${isAvatarSpeaking ? "border-orange-500 text-orange-500 hover:bg-orange-500/10" : "border-muted-foreground text-muted-foreground hover:bg-muted/50"}`}
                        title={isAvatarSpeaking ? "Skip audio" : "Skip question"}
                      >
                        <SkipForward className="w-5 h-5" />
                      </Button>
                      <span className={`text-xs ${isAvatarSpeaking ? "text-orange-400" : "text-muted-foreground"}`}>Skip</span>
                    </div>

                    {/* Record button */}
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        variant="default"
                        size="lg"
                        onClick={startRecording}
                        disabled={isAvatarSpeaking}
                        className="rounded-full w-16 h-16 bg-red-600 hover:bg-red-700"
                      >
                        <Mic className="w-7 h-7" />
                      </Button>
                      <span className="text-xs text-muted-foreground">Record</span>
                    </div>

                    {/* Repeat button - only when not speaking */}
                    {!isAvatarSpeaking && (
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={repeatQuestion}
                          disabled={!currentQuestion}
                          className="rounded-full w-14 h-14"
                          title="Repeat question"
                        >
                          <Volume2 className="w-5 h-5" />
                        </Button>
                        <span className="text-xs text-muted-foreground">Repeat</span>
                      </div>
                    )}
                  </>
                ) : (
                  /* Recording - show Mute, Submit, Retry buttons */
                  <>
                    {/* Mute/Unmute button */}
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={toggleRecordingMute}
                        className={`rounded-full w-14 h-14 ${isPausedRecording ? "border-yellow-500 text-yellow-500" : "border-green-500 text-green-500"}`}
                        title={isPausedRecording ? "Unmute (Space)" : "Mute (Space)"}
                      >
                        {isPausedRecording ? <VolumeX className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </Button>
                      <span className="text-xs text-muted-foreground">{isPausedRecording ? "Unmute" : "Mute"}</span>
                    </div>

                    {/* Submit button */}
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        variant="default"
                        size="lg"
                        onClick={submitRecording}
                        className="rounded-full w-16 h-16 bg-green-600 hover:bg-green-700"
                        title="Submit answer"
                      >
                        <Send className="w-6 h-6" />
                      </Button>
                      <span className="text-xs text-muted-foreground">Submit</span>
                    </div>

                    {/* Retry button */}
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={retakeAnswer}
                        className="rounded-full w-14 h-14 border-red-500 text-red-500 hover:bg-red-500/10"
                        title="Discard and retry"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </Button>
                      <span className="text-xs text-muted-foreground">Retry</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              /* Video mode controls */
              <>
                {/* Skip button - always visible */}
                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={skipAudio}
                    className={`rounded-full w-14 h-14 ${isAvatarSpeaking ? "border-orange-500 text-orange-500 hover:bg-orange-500/10" : "border-muted-foreground text-muted-foreground hover:bg-muted/50"}`}
                    title={isAvatarSpeaking ? "Skip audio" : "Skip question"}
                  >
                    <SkipForward className="w-5 h-5" />
                  </Button>
                  <span className={`text-xs ${isAvatarSpeaking ? "text-orange-400" : "text-muted-foreground"}`}>Skip</span>
                </div>

                {/* Mic button for HeyGen */}
                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant={!isMuted ? "secondary" : "destructive"}
                    size="lg"
                    onClick={toggleVideoMute}
                    className="rounded-full w-16 h-16"
                  >
                    {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                  </Button>
                  <span className="text-xs text-muted-foreground">{isMuted ? "Unmute" : "Mute"}</span>
                </div>

                {/* Repeat button - hidden when speaking */}
                {!isAvatarSpeaking && (
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={repeatQuestion}
                      disabled={!currentQuestion}
                      className="rounded-full w-14 h-14"
                      title="Repeat question"
                    >
                      <Volume2 className="w-5 h-5" />
                    </Button>
                    <span className="text-xs text-muted-foreground">Repeat</span>
                  </div>
                )}
              </>
            )}
          </div>

          <p className="text-center text-sm mt-3">
            {isAvatarSpeaking ? (
              <span className="text-blue-400 flex items-center justify-center gap-2">
                <AudioLines className="w-4 h-4 animate-pulse" />
                Interviewer speaking... tap Skip to continue
              </span>
            ) : isRecordingAudio ? (
              isPausedRecording ? (
                <span className="text-yellow-400 flex items-center justify-center gap-2">
                  <Pause className="w-4 h-4" />
                  Paused... press Space to unmute, or tap Submit
                </span>
              ) : (
                <span className="text-red-400 flex items-center justify-center gap-2">
                  <Mic className="w-4 h-4 animate-pulse" />
                  Recording... press Space to pause, or tap Submit
                </span>
              )
            ) : audioOnly ? (
              <span className="text-muted-foreground">Tap Record to respond</span>
            ) : isMuted ? (
              <span className="text-muted-foreground">Tap mic to respond (Space)</span>
            ) : isUserSpeaking ? (
              <span className="text-green-400">Listening to you...</span>
            ) : (
              <span className="text-muted-foreground">Speak naturally when ready</span>
            )}
          </p>
        </div>

        {/* Transcript section */}
        <div className="lg:w-1/2 flex flex-col bg-card rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Conversation</span>
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
                      ? "bg-blue-600 text-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.role === "user" ? "text-blue-200" : "text-muted-foreground"
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
          </div>

          {/* Current question highlight */}
          {currentQuestion && !interviewComplete && (
            <div className="px-4 py-3 border-t border-border bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Current Question</p>
              <p className="text-sm text-foreground">{currentQuestion}</p>
            </div>
          )}
        </div>
      </div>

      {/* End Interview Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">End Interview?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Your progress will be saved. You can return and continue the
              interview later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted text-foreground border-border">
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
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Interview Complete!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading interview...</p>
        </div>
      </div>
    }>
      <VideoInterviewContent />
    </Suspense>
  );
}
