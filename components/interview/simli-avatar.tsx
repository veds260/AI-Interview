"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Video, Volume2 } from "lucide-react";

interface SimliAvatarProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

export default function SimliAvatar({ onReady, onError }: SimliAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const simliClientRef = useRef<any>(null);
  const initAttempted = useRef(false);
  const connectedRef = useRef(false);
  const loadingRef = useRef(true);
  const isMountedRef = useRef(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [useMock, setUseMock] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Initializing...");

  // Initialize after component mounts and refs are available
  useEffect(() => {
    // Reset mounted ref on mount
    isMountedRef.current = true;

    // Small delay to ensure refs are set
    const timer = setTimeout(() => {
      if (initAttempted.current) return;
      initAttempted.current = true;

      const initializeSimli = async () => {
        try {
          setStatusMessage("Fetching credentials...");
          // Get credentials from API
          const res = await fetch("/api/avatar/init", { method: "POST" });
          const data = await res.json();

          console.log("Avatar init response:", data);

          if (data.mock || !data.apiKey) {
            console.log("Using mock avatar mode - reason:", data.mock ? "mock flag" : "no apiKey");
            setStatusMessage("Using mock avatar");
            setUseMock(true);
            setIsLoading(false);
            loadingRef.current = false;
            onReady?.();
            return;
          }

          setStatusMessage("Got credentials, preparing...");
          console.log("Attempting Simli connection with faceId:", data.faceId);
          console.log("Video ref available:", !!videoRef.current);
          console.log("Audio ref available:", !!audioRef.current);

          // Check refs are available
          if (!videoRef.current || !audioRef.current) {
            console.error("Video/Audio refs not available");
            setStatusMessage("Media elements not ready");
            setUseMock(true);
            setIsLoading(false);
            loadingRef.current = false;
            onReady?.();
            return;
          }

          // Dynamically import SimliClient to avoid SSR issues
          setStatusMessage("Loading SDK...");
          console.log("Importing SimliClient...");
          const { SimliClient } = await import("simli-client");
          console.log("SimliClient imported successfully");

          const simliClient = new SimliClient();
          console.log("SimliClient instance created");

          const config = {
            apiKey: data.apiKey,
            faceID: data.faceId,
            handleSilence: true,
            maxSessionLength: 3600,
            maxIdleTime: 600,
            videoRef: videoRef.current,
            audioRef: audioRef.current,
            enableConsoleLogs: true,
          };
          console.log("Initializing SimliClient with config:", { ...config, apiKey: "[HIDDEN]" });

          setStatusMessage("Initializing SDK...");
          // @ts-ignore - Simli SDK types may be outdated, this component is deprecated in favor of HeyGen
          simliClient.Initialize(config);
          console.log("SimliClient initialized");

          simliClient.on("connected", () => {
            console.log("Simli connected event fired");
            if (!isMountedRef.current) return;
            setStatusMessage("Connected!");
            connectedRef.current = true;
            setIsConnected(true);
            setIsLoading(false);
            loadingRef.current = false;
            onReady?.();
          });

          simliClient.on("disconnected", () => {
            console.log("Simli disconnected event fired");
            if (!isMountedRef.current) return;
            setStatusMessage("Disconnected");
            connectedRef.current = false;
            setIsConnected(false);
          });

          simliClient.on("failed", (error: any) => {
            console.error("Simli connection failed event fired:", error);
            if (!isMountedRef.current) return;
            setStatusMessage(`Connection failed: ${error}`);
            setUseMock(true);
            setIsLoading(false);
            loadingRef.current = false;
            onError?.("Failed to connect to avatar");
          });

          setStatusMessage("Starting WebRTC connection...");
          console.log("Starting SimliClient...");
          try {
            await simliClient.start();
            console.log("SimliClient start() completed");
            setStatusMessage("Waiting for connection...");
          } catch (startError) {
            console.error("SimliClient start() error:", startError);
            setStatusMessage(`Start error: ${startError}`);
            throw startError;
          }

          simliClientRef.current = simliClient;

          // Set timeout to fall back to mock if not connected within 20s
          setTimeout(() => {
            if (!isMountedRef.current) return;
            if (!connectedRef.current && loadingRef.current) {
              console.log("Simli connection timeout (20s), falling back to mock");
              setStatusMessage("Connection timeout, using mock");
              setUseMock(true);
              setIsLoading(false);
              loadingRef.current = false;
              onReady?.();
            }
          }, 20000);
        } catch (error) {
          console.error("Failed to initialize Simli:", error);
          if (!isMountedRef.current) return;
          setStatusMessage(`Error: ${error}`);
          setUseMock(true);
          setIsLoading(false);
          loadingRef.current = false;
          onReady?.();
        }
      };

      initializeSimli();
    }, 100);

    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
      // Only close if we're actually unmounting (not just React Strict Mode re-render)
      // Delay the close to allow React Strict Mode to re-mount
      setTimeout(() => {
        if (!isMountedRef.current && simliClientRef.current) {
          console.log("Component unmounted, closing Simli connection");
          try {
            simliClientRef.current.close();
          } catch (e) {
            // Ignore close errors
          }
        }
      }, 100);
    };
  }, []);

  // Function to send PCM audio to avatar for lip-sync
  // PCM should be 16-bit at 16kHz sample rate
  const sendAudioToSimli = useCallback((pcmData: Uint8Array) => {
    if (simliClientRef.current && connectedRef.current) {
      console.log("Sending audio to Simli for lip-sync, bytes:", pcmData.length);
      setIsSpeaking(true);

      // Send audio in chunks for smoother lip-sync
      const chunkSize = 6400; // 200ms of audio at 16kHz 16-bit
      let offset = 0;

      const sendChunk = () => {
        if (offset >= pcmData.length) {
          // Done sending, estimate remaining duration
          setTimeout(() => setIsSpeaking(false), 500);
          return;
        }

        const chunk = pcmData.slice(offset, offset + chunkSize);
        simliClientRef.current.sendAudioData(chunk);
        offset += chunkSize;

        // Send next chunk after 200ms
        setTimeout(sendChunk, 200);
      };

      sendChunk();
    } else {
      console.log("Simli not connected, cannot send audio");
    }
  }, []);

  // Expose methods globally for the interview page
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).simliSendAudio = sendAudioToSimli;
      (window as any).simliIsConnected = () => connectedRef.current;
    }
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).simliSendAudio;
        delete (window as any).simliIsConnected;
      }
    };
  }, [sendAudioToSimli]);

  return (
    <div className="aspect-video bg-gray-900 rounded-lg relative overflow-hidden">
      {/* Always render video/audio elements so refs are available */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className={`w-full h-full object-cover ${useMock || isLoading ? "hidden" : ""}`}
      />
      <audio ref={audioRef} autoPlay />

      {/* Loading state overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-2" />
            <p className="text-white text-sm">{statusMessage}</p>
          </div>
        </div>
      )}

      {/* Mock avatar overlay */}
      {useMock && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Video className="w-12 h-12 text-white" />
            </div>
            <p className="text-white text-sm">AI Interviewer</p>
            <p className="text-gray-400 text-xs mt-1">(Mock mode: {statusMessage})</p>
            {isSpeaking && (
              <div className="flex items-center justify-center gap-1 mt-2">
                <Volume2 className="w-4 h-4 text-green-400 animate-pulse" />
                <span className="text-green-400 text-sm">Speaking...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connected avatar speaking indicator */}
      {isConnected && !useMock && isSpeaking && (
        <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
          <Volume2 className="w-4 h-4 text-green-400 animate-pulse" />
          <span className="text-green-400 text-sm">Speaking</span>
        </div>
      )}
    </div>
  );
}
