"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  Video,
  Volume2,
  VolumeX,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeyGenAvatarProps {
  onReady?: () => void;
  onError?: (error: string) => void;
  onUserSpeaking?: (isSpeaking: boolean) => void;
  onAvatarSpeaking?: (isSpeaking: boolean) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  initialQuestion?: string;
  knowledgeBase?: string;
  tokenEndpoint?: string;
}

export default function HeyGenAvatar({
  onReady,
  onError,
  onUserSpeaking,
  onAvatarSpeaking,
  onTranscript,
  initialQuestion,
  knowledgeBase,
  tokenEndpoint = "/api/avatar/heygen-token",
}: HeyGenAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamingAvatarRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);
  const taskTypeRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  // Keep refs updated
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [useFallback, setUseFallback] = useState(false);

  // Initialize HeyGen - video avatar + TTS only
  useEffect(() => {
    let mounted = true;

    const initHeyGen = async () => {
      try {
        setStatusMessage("Getting access token...");

        const tokenRes = await fetch(tokenEndpoint, {
          method: "POST",
        });
        const tokenData = await tokenRes.json();

        if (!tokenData.configured || !tokenData.token) {
          console.log("HeyGen not configured, using fallback");
          setUseFallback(true);
          setIsLoading(false);
          onReady?.();
          return;
        }

        setStatusMessage("Loading avatar SDK...");

        const { default: StreamingAvatar, StreamingEvents, AvatarQuality, TaskType } =
          await import("@heygen/streaming-avatar");

        if (!mounted) return;

        taskTypeRef.current = TaskType;

        const avatar = new StreamingAvatar({ token: tokenData.token });
        streamingAvatarRef.current = avatar;

        avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
          console.log("Stream ready:", event);
          if (!mounted) return;

          if (event.detail && videoRef.current) {
            videoRef.current.srcObject = event.detail;
            videoRef.current.play().catch(console.error);
          }

          setIsConnected(true);
          setIsLoading(false);
          setStatusMessage("Connected");
          onReady?.();
        });

        avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
          console.log("Avatar started talking");
          if (!mounted) return;
          setIsAvatarSpeaking(true);
          onAvatarSpeaking?.(true);
        });

        avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
          console.log("Avatar stopped talking");
          if (!mounted) return;
          setIsAvatarSpeaking(false);
          onAvatarSpeaking?.(false);
        });

        avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
          console.log("Stream disconnected");
          if (!mounted) return;
          setIsConnected(false);
          setStatusMessage("Disconnected");
        });

        setStatusMessage("Starting avatar session...");

        const avatarId = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID || "Wayne_20240711";
        console.log("Creating avatar session with:", { avatarId });

        let sessionInfo;
        try {
          sessionInfo = await avatar.createStartAvatar({
            avatarName: avatarId,
            quality: AvatarQuality.Medium,
            language: "en",
            disableIdleTimeout: false,
          });
          console.log("Avatar session created:", sessionInfo?.session_id);
        } catch (createError: any) {
          console.error("createStartAvatar failed:", createError?.message);
          try {
            sessionInfo = await avatar.createStartAvatar({
              avatarName: "Pedro_ProfessionalLook_public",
              quality: AvatarQuality.Low,
            });
          } catch (fallbackError: any) {
            throw createError;
          }
        }

        if (!mounted) return;

        sessionIdRef.current = sessionInfo.session_id;
        console.log("Avatar ready - using MediaRecorder for STT, HeyGen for TTS");

        // Speak initial question
        if (initialQuestion && avatar) {
          setTimeout(async () => {
            try {
              console.log("Speaking initial question:", initialQuestion);
              await avatar.speak({
                text: initialQuestion,
                taskType: TaskType.REPEAT,
              });
            } catch (err) {
              console.error("Error speaking initial question:", err);
            }
          }, 1000);
        }
      } catch (error) {
        console.error("Failed to initialize HeyGen:", error);
        if (!mounted) return;
        setUseFallback(true);
        setIsLoading(false);
        onError?.(error instanceof Error ? error.message : "Unknown error");
        onReady?.();
      }
    };

    initHeyGen();

    return () => {
      mounted = false;
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      // Stop media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      // Stop avatar
      if (streamingAvatarRef.current) {
        try {
          streamingAvatarRef.current.stopAvatar();
        } catch (e) {
          console.error("Error stopping avatar:", e);
        }
      }
    };
  }, [tokenEndpoint]);

  // Speak text using the avatar
  const speakText = useCallback(async (text: string) => {
    if (!streamingAvatarRef.current || !isConnected) {
      console.log("Avatar not ready for speaking");
      return;
    }

    try {
      await streamingAvatarRef.current.speak({
        text,
        taskType: taskTypeRef.current?.REPEAT,
      });
    } catch (error) {
      console.error("Error speaking:", error);
    }
  }, [isConnected]);

  // Interrupt avatar speech
  const interruptSpeech = useCallback(async () => {
    if (!streamingAvatarRef.current) return;

    try {
      await streamingAvatarRef.current.interrupt();
    } catch (error) {
      console.error("Error interrupting:", error);
    }
  }, []);

  // Start recording audio
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsUserSpeaking(true);
      onUserSpeaking?.(true);
      console.log("Recording started");
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, [onUserSpeaking]);

  // Stop recording and transcribe using browser Web Speech API (free)
  const stopRecordingAndTranscribe = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }

    setIsTranscribing(true);
    setIsUserSpeaking(false);
    onUserSpeaking?.(false);

    // Stop media recorder
    mediaRecorderRef.current.stop();

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
    setIsTranscribing(false);
  }, [onUserSpeaking]);

  // Use browser's Web Speech API for real-time transcription
  const speechRecognitionRef = useRef<any>(null);

  const startRecordingWithSpeechRecognition = useCallback(async () => {
    // Check if Web Speech API is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("Web Speech API not supported in this browser");
      // Fallback to regular recording
      await startRecording();
      return;
    }

    try {
      // Also start audio recording for visual feedback
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      // Start speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = '';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Show interim results for feedback
        if (interimTranscript) {
          console.log("Interim:", interimTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
      };

      recognition.onend = () => {
        console.log("Speech recognition ended, final transcript:", finalTranscript);
        if (finalTranscript.trim()) {
          onTranscriptRef.current?.(finalTranscript.trim(), true);
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;

      setIsRecording(true);
      setIsUserSpeaking(true);
      onUserSpeaking?.(true);
      console.log("Recording started with Web Speech API");
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, [onUserSpeaking, startRecording]);

  const stopRecordingWithSpeechRecognition = useCallback(() => {
    // Stop speech recognition
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
    setIsUserSpeaking(false);
    onUserSpeaking?.(false);
    setIsTranscribing(false);
  }, [onUserSpeaking]);

  // Toggle recording - use Web Speech API for free transcription
  const toggleMute = useCallback(async () => {
    if (isMuted) {
      await startRecordingWithSpeechRecognition();
      setIsMuted(false);
    } else {
      stopRecordingWithSpeechRecognition();
      setIsMuted(true);
    }
  }, [isMuted, startRecordingWithSpeechRecognition, stopRecordingWithSpeechRecognition]);

  // Submit recording (stop and transcribe)
  const submitRecording = useCallback(async () => {
    if (isRecording) {
      stopRecordingWithSpeechRecognition();
      setIsMuted(true);
    }
  }, [isRecording, stopRecordingWithSpeechRecognition]);

  // Expose methods globally
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).heygenSpeak = speakText;
      (window as any).heygenInterrupt = interruptSpeech;
      (window as any).heygenToggleMute = toggleMute;
      (window as any).heygenIsConnected = () => isConnected;
    }
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).heygenSpeak;
        delete (window as any).heygenInterrupt;
        delete (window as any).heygenToggleMute;
        delete (window as any).heygenIsConnected;
      }
    };
  }, [speakText, interruptSpeech, toggleMute, isConnected]);

  // Fallback UI
  if (useFallback) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-3">
              <Video className="w-10 h-10 text-white" />
            </div>
            <p className="text-white text-sm font-medium">AI Interviewer</p>
            <p className="text-gray-400 text-xs mt-1">Voice mode</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Video container */}
      <div className="aspect-video bg-gray-900 rounded-lg relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-contain ${isLoading ? "hidden" : ""}`}
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-2" />
              <p className="text-white text-sm">{statusMessage}</p>
            </div>
          </div>
        )}

        {/* Speaking indicators */}
        {isConnected && (
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
            {isAvatarSpeaking && (
              <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full">
                <Volume2 className="w-3.5 h-3.5 text-green-400 animate-pulse" />
                <span className="text-green-400 text-xs">Speaking</span>
              </div>
            )}

            {isRecording && !isMuted && (
              <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full ml-auto">
                <Mic className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span className="text-red-400 text-xs">Recording</span>
              </div>
            )}

            {isTranscribing && (
              <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full ml-auto">
                <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                <span className="text-blue-400 text-xs">Processing</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {isConnected && (
        <div className="flex justify-center gap-2 mt-3">
          {isMuted ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={toggleMute}
              disabled={isTranscribing || isAvatarSpeaking}
              className="gap-1.5"
            >
              <MicOff className="w-4 h-4" />
              Start Recording
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={submitRecording}
              disabled={isTranscribing}
              className="gap-1.5 bg-green-600 hover:bg-green-700"
            >
              <Send className="w-4 h-4" />
              {isTranscribing ? "Processing..." : "Submit Answer"}
            </Button>
          )}

          {isAvatarSpeaking && (
            <Button
              variant="outline"
              size="sm"
              onClick={interruptSpeech}
              className="gap-1.5"
            >
              <VolumeX className="w-4 h-4" />
              Stop
            </Button>
          )}
        </div>
      )}

      {/* Recording hint */}
      {isConnected && (
        <p className="text-center text-xs text-gray-500 mt-2">
          {isMuted
            ? isAvatarSpeaking
              ? "Wait for the question to finish, then click to record"
              : "Click to start recording your answer"
            : "Speak your answer, then click Submit"}
        </p>
      )}
    </div>
  );
}
