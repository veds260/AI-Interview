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
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Preload the HeyGen SDK module (starts downloading immediately)
let sdkPromise: Promise<any> | null = null;
function preloadHeyGenSDK() {
  if (!sdkPromise) {
    sdkPromise = import("@heygen/streaming-avatar");
  }
  return sdkPromise;
}

// Start preloading immediately when this module loads
if (typeof window !== "undefined") {
  preloadHeyGenSDK();
}

interface HeyGenAvatarProps {
  onReady?: () => void;
  onError?: (error: string) => void;
  onUserSpeaking?: (isSpeaking: boolean) => void;
  onAvatarSpeaking?: (isSpeaking: boolean) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  initialQuestion?: string;
  knowledgeBase?: string;
  tokenEndpoint?: string;
  interviewId?: string;
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
  interviewId,
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
  const [useTextInput, setUseTextInput] = useState(false);
  const [textResponse, setTextResponse] = useState("");

  // Initialize HeyGen - video avatar + TTS only
  useEffect(() => {
    let mounted = true;

    const initHeyGen = async () => {
      try {
        setStatusMessage("Connecting to avatar...");

        // Parallel fetch: token + SDK at the same time for faster startup
        const [tokenData, sdk] = await Promise.all([
          fetch(tokenEndpoint, { method: "POST" }).then(res => res.json()),
          preloadHeyGenSDK(),
        ]);

        if (!tokenData.configured || !tokenData.token) {
          console.log("HeyGen not configured, using fallback");
          setUseFallback(true);
          setIsLoading(false);
          onReady?.();
          return;
        }

        if (!mounted) return;

        const { default: StreamingAvatar, StreamingEvents, AvatarQuality, TaskType } = sdk;
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
          // Use Low quality for faster startup (3-5s vs 8-10s for Medium/High)
          sessionInfo = await avatar.createStartAvatar({
            avatarName: avatarId,
            quality: AvatarQuality.Low,
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

        // Speak initial question immediately (reduced from 1000ms)
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
          }, 100);
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

  // Video recording ref for user's camera
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);

  // Attach user video stream when the video element becomes available
  useEffect(() => {
    if (userVideoRef.current && userStream) {
      userVideoRef.current.srcObject = userStream;
      userVideoRef.current.play().catch(console.error);
    }
  }, [userStream, isRecording]);

  // Start recording with video + audio (server-side transcription)
  const startVideoRecording = useCallback(async () => {
    try {
      // Request both video and audio
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      mediaStreamRef.current = stream;
      setUserStream(stream); // Trigger useEffect to attach to video element

      // Set up video recorder for the full stream (video + audio)
      const videoMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const videoRecorder = new MediaRecorder(stream, { mimeType: videoMimeType });
      videoRecorderRef.current = videoRecorder;
      videoChunksRef.current = [];

      videoRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      videoRecorder.start(1000); // Collect data every second

      // Also set up audio-only recorder for transcription
      const audioStream = new MediaStream(stream.getAudioTracks());
      const audioMimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const audioRecorder = new MediaRecorder(audioStream, { mimeType: audioMimeType });
      mediaRecorderRef.current = audioRecorder;
      audioChunksRef.current = [];

      audioRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      audioRecorder.start(1000);

      setIsRecording(true);
      setIsUserSpeaking(true);
      onUserSpeaking?.(true);
      console.log("Recording started with video + audio");
    } catch (error) {
      console.error("Failed to start video recording:", error);
      // Fallback to audio-only if video fails
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = audioStream;

        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const recorder = new MediaRecorder(audioStream, { mimeType });
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.start(1000);
        setIsRecording(true);
        setIsUserSpeaking(true);
        onUserSpeaking?.(true);
        console.log("Recording started with audio only (video unavailable)");
      } catch (audioError) {
        console.error("Failed to start any recording:", audioError);
        setUseTextInput(true);
      }
    }
  }, [onUserSpeaking]);

  // Stop recording and transcribe using server-side Whisper
  const stopVideoRecordingAndTranscribe = useCallback(async () => {
    setIsTranscribing(true);
    setIsUserSpeaking(false);
    onUserSpeaking?.(false);

    // Stop video recorder
    if (videoRecorderRef.current && videoRecorderRef.current.state !== "inactive") {
      videoRecorderRef.current.stop();
    }

    // Stop audio recorder and wait for it to finish
    return new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
        setIsRecording(false);
        setIsTranscribing(false);
        resolve();
        return;
      }

      const audioRecorder = mediaRecorderRef.current;

      audioRecorder.onstop = async () => {
        console.log("Recording stopped, sending to server for transcription...");

        // Stop user video preview
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = null;
        }
        setUserStream(null);

        // Stop all tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }

        // Create audio blob for transcription
        const audioBlob = new Blob(audioChunksRef.current, { type: audioRecorder.mimeType });
        audioChunksRef.current = [];

        // Create video blob for storage and upload IN BACKGROUND (don't block UX)
        if (videoChunksRef.current.length > 0) {
          const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
          videoChunksRef.current = [];
          console.log("Video recorded:", videoBlob.size, "bytes");

          // Upload video in background - don't await, don't block transcription
          const videoFormData = new FormData();
          videoFormData.append("video", videoBlob, `clip-${Date.now()}.webm`);
          if (interviewId) {
            videoFormData.append("interviewId", interviewId);
          }

          fetch("/api/clips/upload", {
            method: "POST",
            body: videoFormData,
          })
            .then((res) => res.json())
            .then((result) => {
              if (result.url) {
                console.log("Video uploaded in background:", result.url);
              } else if (result.error) {
                console.log("Video upload skipped:", result.hint || result.error);
              }
            })
            .catch((err) => console.error("Background video upload error:", err));
        }

        // Skip if audio too short
        if (audioBlob.size < 5000) {
          console.log("Audio too short, skipping transcription");
          setIsTranscribing(false);
          setIsRecording(false);
          resolve();
          return;
        }

        // Send to server for transcription
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const result = await response.json();

          if (result.text && result.text.trim()) {
            console.log("Server transcription result:", result.text);
            onTranscriptRef.current?.(result.text, true);
          } else if (result.error) {
            console.error("Transcription error:", result.error, result.hint);
            // Show text input as fallback
            setUseTextInput(true);
          }
        } catch (error) {
          console.error("Transcription request failed:", error);
          setUseTextInput(true);
        }

        setIsTranscribing(false);
        setIsRecording(false);
        resolve();
      };

      audioRecorder.stop();
    });
  }, [onUserSpeaking]);

  // Toggle recording - use video + audio with server transcription
  const toggleMute = useCallback(async () => {
    if (isMuted) {
      await startVideoRecording();
      setIsMuted(false);
    } else {
      await stopVideoRecordingAndTranscribe();
      setIsMuted(true);
    }
  }, [isMuted, startVideoRecording, stopVideoRecordingAndTranscribe]);

  // Submit recording (stop and transcribe)
  const submitRecording = useCallback(async () => {
    if (isRecording) {
      await stopVideoRecordingAndTranscribe();
      setIsMuted(true);
    }
  }, [isRecording, stopVideoRecordingAndTranscribe]);

  // Submit text response (fallback when speech recognition fails)
  const submitTextResponse = useCallback(() => {
    if (textResponse.trim()) {
      onTranscriptRef.current?.(textResponse.trim(), true);
      setTextResponse("");
    }
  }, [textResponse]);

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

        {/* User video preview (picture-in-picture) */}
        {isRecording && (
          <div className="absolute top-3 right-3 w-32 h-24 rounded-lg overflow-hidden border-2 border-red-500 shadow-lg">
            <video
              ref={userVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-red-600/80 px-1.5 py-0.5 rounded text-white text-xs">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              REC
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
        <div className="mt-3">
          {useTextInput ? (
            /* Text input fallback when speech recognition fails */
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-yellow-500 text-xs justify-center">
                <MessageSquare className="w-3 h-3" />
                <span>Voice unavailable - type your response instead</span>
              </div>
              <Textarea
                placeholder="Type your response here..."
                value={textResponse}
                onChange={(e) => setTextResponse(e.target.value)}
                rows={3}
                className="resize-none text-sm"
                disabled={isAvatarSpeaking}
              />
              <div className="flex justify-between items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUseTextInput(false);
                    setIsMuted(true);
                  }}
                  className="text-xs"
                >
                  <Mic className="w-3 h-3 mr-1" />
                  Try voice again
                </Button>
                <Button
                  size="sm"
                  onClick={submitTextResponse}
                  disabled={!textResponse.trim() || isAvatarSpeaking}
                  className="gap-1.5 bg-green-600 hover:bg-green-700"
                >
                  <Send className="w-4 h-4" />
                  Submit
                </Button>
              </div>
            </div>
          ) : (
            /* Voice controls */
            <div className="flex justify-center gap-2">
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
        </div>
      )}

      {/* Recording hint */}
      {isConnected && !useTextInput && (
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
