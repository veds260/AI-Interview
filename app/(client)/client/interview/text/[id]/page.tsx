"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Send,
  Loader2,
  Pause,
  CheckCircle,
  SkipForward,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  id: string;
  role: "interviewer" | "client";
  content: string;
  timestamp: Date;
}

interface InterviewState {
  questionIds: string[];
  currentIndex: number;
}

interface Interview {
  id: string;
  status: string;
  sessionState: InterviewState;
  questionsCount: number;
}

export default function TextInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;

  const [interview, setInterview] = useState<Interview | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load interview data
  useEffect(() => {
    const loadInterview = async () => {
      try {
        const res = await fetch(`/api/interviews/${interviewId}`);
        if (!res.ok) throw new Error("Failed to load interview");

        const data = await res.json();
        setInterview(data.interview);
        setMessages(data.messages || []);

        // If interview is completed or paused, redirect
        if (data.interview.status === "completed") {
          router.push("/client/interviews");
          return;
        }

        // Get current question
        if (data.currentQuestion) {
          setCurrentQuestion(data.currentQuestion);

          // Add question to messages if not already there
          const hasQuestion = data.messages?.some(
            (m: Message) =>
              m.role === "interviewer" && m.content === data.currentQuestion
          );
          if (!hasQuestion) {
            setMessages((prev) => [
              ...prev,
              {
                id: `q-${Date.now()}`,
                role: "interviewer",
                content: data.currentQuestion,
                timestamp: new Date(),
              },
            ]);
          }
        } else {
          // No question available - show error
          setLoadError("No questions available for this interview. The interview may not be properly configured.");
        }

        // Calculate progress
        const state = data.interview.sessionState as InterviewState;
        if (state?.questionIds) {
          setProgress(
            ((state.currentIndex || 0) / state.questionIds.length) * 100
          );
        }
      } catch (error) {
        console.error("Failed to load interview:", error);
        setLoadError("Failed to load interview. Please try again.");
        toast.error("Failed to load interview");
      } finally {
        setIsLoading(false);
      }
    };

    loadInterview();
  }, [interviewId, router]);

  const handleSubmitResponse = async () => {
    if (!response.trim()) {
      toast.error("Please enter a response");
      return;
    }

    setIsSending(true);

    // Add user response to messages immediately
    const userMessage: Message = {
      id: `r-${Date.now()}`,
      role: "client",
      content: response,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setResponse("");

    try {
      const res = await fetch(`/api/interviews/${interviewId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: response.trim() }),
      });

      if (!res.ok) throw new Error("Failed to submit response");

      const data = await res.json();

      if (data.completed) {
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
    } catch (error) {
      toast.error("Failed to submit response");
    } finally {
      setIsSending(false);
    }
  };

  const handleSkipQuestion = async () => {
    setIsSending(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/skip`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to skip question");

      const data = await res.json();

      if (data.completed) {
        setShowCompleteDialog(true);
      } else if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setMessages((prev) => [
          ...prev,
          {
            id: `skip-${Date.now()}`,
            role: "client",
            content: "(Skipped this question)",
            timestamp: new Date(),
          },
          {
            id: `q-${Date.now()}`,
            role: "interviewer",
            content: data.nextQuestion,
            timestamp: new Date(),
          },
        ]);
        setProgress(data.progress || progress);
      }
    } catch (error) {
      toast.error("Failed to skip question");
    } finally {
      setIsSending(false);
    }
  };

  const handlePauseInterview = async () => {
    try {
      const res = await fetch(`/api/interviews/${interviewId}/pause`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to pause interview");

      toast.success("Interview paused. You can resume anytime.");
      router.push("/client/interviews");
    } catch (error) {
      toast.error("Failed to pause interview");
    }
  };

  const handleCompleteInterview = async () => {
    try {
      const res = await fetch(`/api/interviews/${interviewId}/complete`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to complete interview");

      toast.success("Interview completed! Thank you for your time.");
      router.push("/client/interviews");
    } catch (error) {
      toast.error("Failed to complete interview");
    }
  };

  if (isLoading) {
    return (
      <motion.div
        className="max-w-3xl mx-auto space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>

        {/* Progress skeleton */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between text-sm mb-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-8" />
            </div>
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>

        {/* Chat area skeleton */}
        <Card className="min-h-[400px]">
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-4">
              <div className="flex justify-start">
                <motion.div
                  className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100"
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-5 w-48 mt-1" />
                </motion.div>
              </div>
            </div>
            <div className="border-t pt-4">
              <Skeleton className="h-24 w-full mb-3" />
              <div className="flex justify-end">
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Text Interview</h1>
          <p className="text-sm text-gray-500">
            Answer thoughtfully - take your time
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPauseDialog(true)}
          >
            <Pause className="mr-1 h-4 w-4" />
            Pause
          </Button>
        </div>
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

      {/* Chat Area */}
      <Card className="min-h-[400px] flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversation
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[350px] mb-4">
            {loadError ? (
              <motion.div
                className="text-center py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-red-700">{loadError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => router.push("/client")}
                  >
                    Return to Dashboard
                  </Button>
                </div>
              </motion.div>
            ) : messages.length === 0 ? (
              <motion.div
                className="text-center text-gray-500 py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="flex justify-center gap-1.5 mb-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-gray-400"
                      animate={{ y: [0, -8, 0] }}
                      transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                    />
                  ))}
                </motion.div>
                <p>Loading your first question...</p>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {messages.map((msg, index) => (
                  <motion.div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "client" ? "justify-end" : "justify-start"
                    }`}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 40,
                      delay: index === messages.length - 1 ? 0 : 0,
                    }}
                    layout
                  >
                    <motion.div
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        msg.role === "client"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      {msg.role === "interviewer" && (
                        <Badge variant="outline" className="mb-2 text-xs">
                          Interviewer
                        </Badge>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Response Input */}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkipQuestion}
                disabled={isSending}
              >
                <SkipForward className="mr-1 h-4 w-4" />
                Skip Question
              </Button>
              <div className="flex gap-2">
                <span className="text-xs text-gray-400 self-center">
                  Cmd+Enter to send
                </span>
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
          </div>
        </CardContent>
      </Card>

      {/* Pause Dialog */}
      <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause Interview?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress will be saved. You can return and continue the
              interview at any time from your dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Interview</AlertDialogCancel>
            <AlertDialogAction onClick={handlePauseInterview}>
              Pause and Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Dialog */}
      <AlertDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
      >
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
