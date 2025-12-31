"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Send,
  Loader2,
  CheckCircle,
  MessageSquare,
  Mic,
  MicOff,
  RefreshCw,
  Video,
  PhoneOff,
  User,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "interviewer" | "user";
  content: string;
  timestamp: Date;
}

interface InterviewData {
  id: string;
  mode: "live_video" | "text_chat";
  status: string;
  title: string | null;
  guestName: string | null;
  questionsCount: number;
  sessionState: {
    questionIds?: string[];
    currentIndex?: number;
  };
}

export default function PublicInterviewPage() {
  const params = useParams();
  const token = params.token as string;

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [clientInfo, setClientInfo] = useState<{ name?: string; brandName?: string } | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Name entry state
  const [showNameEntry, setShowNameEntry] = useState(true);
  const [guestName, setGuestName] = useState("");
  const [isSubmittingName, setIsSubmittingName] = useState(false);

  // Text interview state
  const [messages, setMessages] = useState<Message[]>([]);
  const [response, setResponse] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Video interview state
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted so avatar can speak first
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const processingResponseRef = useRef(false);

  // Complete dialog
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load interview data
  useEffect(() => {
    const loadInterview = async () => {
      try {
        const res = await fetch(`/api/interviews/share/${token}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Interview not found");
        }

        const data = await res.json();
        setInterview(data.interview);
        setClientInfo(data.client);
        setCurrentQuestion(data.currentQuestion);
        setProgress(data.progress || 0);
        setIsVideoMode(data.interview.mode === "live_video");

        // If guest name already set, skip name entry
        if (data.interview.guestName) {
          setGuestName(data.interview.guestName);
          setShowNameEntry(false);
        }

        // If interview already completed, show dialog
        if (data.interview.status === "completed") {
          setInterviewComplete(true);
          setShowCompleteDialog(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load interview");
      } finally {
        setIsLoading(false);
      }
    };

    loadInterview();
  }, [token]);

  // Submit guest name
  const handleSubmitName = async () => {
    if (!guestName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsSubmittingName(true);
    try {
      const res = await fetch(`/api/interviews/share/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName: guestName.trim() }),
      });

      if (!res.ok) throw new Error("Failed to save name");

      setShowNameEntry(false);

      // Add first question to messages for text mode
      if (!isVideoMode && currentQuestion) {
        setMessages([
          {
            id: `q-${Date.now()}`,
            role: "interviewer",
            content: currentQuestion,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      toast.error("Failed to start interview");
    } finally {
      setIsSubmittingName(false);
    }
  };

  // Text mode: Submit response
  const handleSubmitResponse = async () => {
    if (!response.trim()) {
      toast.error("Please enter a response");
      return;
    }

    setIsSending(true);

    // Add user response to messages immediately
    const userMessage: Message = {
      id: `r-${Date.now()}`,
      role: "user",
      content: response,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const submittedResponse = response;
    setResponse("");

    try {
      const res = await fetch(`/api/interviews/share/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: submittedResponse }),
      });

      if (!res.ok) throw new Error("Failed to submit response");

      const data = await res.json();

      if (data.completed) {
        setInterviewComplete(true);
        setShowCompleteDialog(true);
      } else if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setMessages((prev) => [
          ...prev,
          {
            id: `q-${Date.now()}`,
            role: "interviewer",
            content: data.nextQuestion,
            timestamp: new Date(),
          },
        ]);
        setProgress(data.progress || progress);
      }
    } catch (err) {
      toast.error("Failed to submit response");
      // Remove the failed message
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setResponse(submittedResponse);
    } finally {
      setIsSending(false);
    }
  };

  // Video mode: Handle avatar ready
  const handleAvatarReady = useCallback(() => {
    setIsConnected(true);
  }, []);

  // Video mode: Handle user transcript from HeyGen's voice chat STT
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
        { id: `r-${Date.now()}`, role: "user", content: cleanText, timestamp: new Date() },
      ]);

      try {
        const res = await fetch(`/api/interviews/share/${token}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response: cleanText }),
        });

        if (!res.ok) throw new Error("Failed to submit response");

        const data = await res.json();

        if (data.completed) {
          setInterviewComplete(true);
          setShowCompleteDialog(true);

          // Thank the user
          const thankYou =
            "Thank you so much for sharing your story with me today. Your insights are incredibly valuable. Take care!";
          setMessages((prev) => [
            ...prev,
            { id: `q-${Date.now()}`, role: "interviewer", content: thankYou, timestamp: new Date() },
          ]);
          (window as any).heygenSpeak?.(thankYou);
        } else if (data.nextQuestion) {
          setCurrentQuestion(data.nextQuestion);
          setProgress(data.progress || progress);

          // Add next question to messages
          setMessages((prev) => [
            ...prev,
            {
              id: `q-${Date.now()}`,
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
      } catch (err) {
        console.error("Error submitting response:", err);
        toast.error("Failed to process your response");
      } finally {
        processingResponseRef.current = false;
      }
    },
    [token, progress, currentQuestion]
  );

  // Video mode: Repeat current question
  const repeatQuestion = useCallback(() => {
    if (currentQuestion && !isAvatarSpeaking) {
      (window as any).heygenSpeak?.(currentQuestion);
    }
  }, [currentQuestion, isAvatarSpeaking]);

  // Video mode: Toggle mute
  const toggleMute = useCallback(() => {
    (window as any).heygenToggleMute?.();
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Loading interview...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <PhoneOff className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Unable to Load Interview</h2>
            <p className="text-gray-500 text-sm">{error}</p>
            <p className="text-gray-400 text-xs mt-4">
              This link may have expired or been revoked.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Name entry screen
  if (showNameEntry) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-white p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Welcome to Your Interview</CardTitle>
            <CardDescription>
              {clientInfo?.brandName || clientInfo?.name
                ? `You've been invited by ${clientInfo.brandName || clientInfo.name}`
                : "You've been invited to share your story"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Your Name
              </label>
              <Input
                placeholder="Enter your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitName();
                }}
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p className="font-medium mb-2">What to expect:</p>
              <ul className="space-y-1.5">
                {isVideoMode ? (
                  <>
                    <li className="flex items-start gap-2">
                      <Video className="w-4 h-4 mt-0.5 text-blue-500" />
                      <span>Interactive video conversation with AI interviewer</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Mic className="w-4 h-4 mt-0.5 text-blue-500" />
                      <span>Speak naturally, the AI will listen and respond</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 mt-0.5 text-blue-500" />
                      <span>Text-based conversation at your own pace</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Send className="w-4 h-4 mt-0.5 text-blue-500" />
                      <span>Type your responses and submit when ready</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            <Button
              onClick={handleSubmitName}
              disabled={isSubmittingName || !guestName.trim()}
              className="w-full"
              size="lg"
            >
              {isSubmittingName ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Start Interview
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Video interview mode
  if (isVideoMode) {
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
            {guestName && (
              <span className="text-sm text-gray-500">
                Welcome, {guestName}
              </span>
            )}
          </div>

          <Badge variant="secondary" className="text-xs">
            {Math.round(progress)}% complete
          </Badge>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-1 rounded-none" />

        {/* Main content */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
          {/* Avatar section */}
          <div className="lg:w-1/2 flex flex-col">
            {/* Dynamic import of HeyGenAvatar to avoid SSR issues */}
            <HeyGenAvatarWrapper
              onReady={handleAvatarReady}
              onAvatarSpeaking={setIsAvatarSpeaking}
              onUserSpeaking={setIsUserSpeaking}
              onTranscript={handleTranscript}
              initialQuestion={currentQuestion || undefined}
              tokenEndpoint={`/api/interviews/share/${token}/heygen-token`}
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
              {messages.map((msg) => (
                <div
                  key={msg.id}
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
                and will help create amazing content.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => window.close()}
                className="bg-green-600 hover:bg-green-700"
              >
                Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Text interview mode
  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Interview</h1>
            {guestName && (
              <p className="text-sm text-gray-500">Welcome, {guestName}</p>
            )}
          </div>
          <Badge variant="secondary">{Math.round(progress)}% complete</Badge>
        </div>

        {/* Progress */}
        <Progress value={progress} className="h-2" />

        {/* Chat Area */}
        <Card className="min-h-[500px] flex flex-col">
          <CardContent className="flex-1 flex flex-col pt-4">
            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] mb-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Loading your first question...</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {msg.role === "interviewer" && (
                        <Badge variant="outline" className="mb-2 text-xs">
                          Interviewer
                        </Badge>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Response Input */}
            {!interviewComplete && (
              <div className="border-t pt-4 space-y-3">
                <Textarea
                  placeholder="Type your response..."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={4}
                  disabled={isSending}
                  className="resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) {
                      handleSubmitResponse();
                    }
                  }}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Cmd+Enter to send</span>
                  <Button onClick={handleSubmitResponse} disabled={isSending}>
                    {isSending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complete Dialog */}
        <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Interview Complete!
              </AlertDialogTitle>
              <AlertDialogDescription>
                Thank you for sharing your story, {guestName}. Your responses have been saved
                and will help create amazing content.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => window.close()}>
                Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// Wrapper component for HeyGenAvatar to handle dynamic import
function HeyGenAvatarWrapper({
  onReady,
  onAvatarSpeaking,
  onUserSpeaking,
  onTranscript,
  initialQuestion,
  tokenEndpoint,
}: {
  onReady?: () => void;
  onAvatarSpeaking?: (isSpeaking: boolean) => void;
  onUserSpeaking?: (isSpeaking: boolean) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  initialQuestion?: string;
  tokenEndpoint?: string;
}) {
  const [HeyGenAvatar, setHeyGenAvatar] = useState<any>(null);

  useEffect(() => {
    import("@/components/interview/heygen-avatar").then((module) => {
      setHeyGenAvatar(() => module.default);
    });
  }, []);

  if (!HeyGenAvatar) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <HeyGenAvatar
      onReady={onReady}
      onError={(err: string) => console.error("Avatar error:", err)}
      onAvatarSpeaking={onAvatarSpeaking}
      onUserSpeaking={onUserSpeaking}
      onTranscript={onTranscript}
      initialQuestion={initialQuestion}
      tokenEndpoint={tokenEndpoint}
    />
  );
}
