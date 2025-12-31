"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Video,
  MessageSquare,
  Download,
  Copy,
  ExternalLink,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface InterviewData {
  id: string;
  title: string | null;
  mode: string;
  status: string;
  questionsCount: number | null;
  completedAt: string | null;
  transcript: string | null;
  questionsAsked: any[];
  recordingUrl: string | null;
}

interface SharedInterviewResponse {
  interview: InterviewData;
  client: {
    name: string;
    brandName: string | null;
  } | null;
}

export default function SharedInterviewViewPage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, error } = useQuery<SharedInterviewResponse>({
    queryKey: ["shared-interview-view", token],
    queryFn: async () => {
      const res = await fetch(`/api/interviews/share/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch interview");
      }
      return res.json();
    },
  });

  const interview = data?.interview;
  const client = data?.client;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const exportTranscript = () => {
    if (!interview?.questionsAsked?.length) {
      toast.error("No transcript available");
      return;
    }

    let transcript = `Interview: ${interview.title || interview.id}\n`;
    transcript += `Date: ${interview.completedAt ? new Date(interview.completedAt).toLocaleString() : "N/A"}\n`;
    transcript += `Mode: ${interview.mode.replace("_", " ")}\n`;
    if (client) {
      transcript += `Client: ${client.name}${client.brandName ? ` (${client.brandName})` : ""}\n`;
    }
    transcript += `\n${"=".repeat(50)}\n\n`;

    interview.questionsAsked.forEach((qa: any, idx: number) => {
      transcript += `Q${idx + 1}: ${qa.question}\n\n`;
      transcript += `A: ${qa.response}\n\n`;
      transcript += `${"-".repeat(30)}\n\n`;
    });

    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript exported");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-2 text-gray-500">Loading interview...</p>
        </div>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Interview Not Found</CardTitle>
            </div>
            <CardDescription>
              This interview link may have expired or is no longer valid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Please contact the person who shared this link with you for a new one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <FileText className="h-4 w-4" />
            <span>Shared Interview</span>
          </div>
          <h1 className="text-3xl font-bold">
            {interview.title || "Interview Transcript"}
          </h1>
          {client && (
            <p className="text-gray-500 mt-1">
              {client.name}
              {client.brandName && ` - ${client.brandName}`}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {interview.mode === "live_video" ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
                <span className="capitalize">
                  {interview.mode.replace("_", " ")}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                className={
                  interview.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
                }
              >
                {interview.status}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {interview.questionsCount || 0}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm">
                {interview.completedAt
                  ? new Date(interview.completedAt).toLocaleDateString()
                  : "N/A"}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Interview Content</CardTitle>
              <div className="flex gap-2">
                {interview.recordingUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={interview.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Recording
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={exportTranscript}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="qa">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qa">Q&A</TabsTrigger>
                <TabsTrigger value="transcript">Full Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="qa" className="mt-4">
                <ScrollArea className="h-[500px]">
                  {interview.questionsAsked?.length ? (
                    <div className="space-y-4 pr-4">
                      {interview.questionsAsked.map((qa: any, idx: number) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-blue-700">
                              Q{idx + 1}: {qa.question}
                            </h4>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(`Q: ${qa.question}\nA: ${qa.response}`)
                              }
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                            {qa.response}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-gray-400">
                      No Q&A data available
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="transcript" className="mt-4">
                <div className="flex justify-end mb-2">
                  {interview.transcript && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(interview.transcript!)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy All
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[500px] border rounded p-4">
                  {interview.transcript ? (
                    <pre className="whitespace-pre-wrap text-sm">
                      {interview.transcript}
                    </pre>
                  ) : interview.questionsAsked?.length ? (
                    <div className="space-y-4">
                      {interview.questionsAsked.map((qa: any, idx: number) => (
                        <div key={idx}>
                          <p className="font-medium">Q: {qa.question}</p>
                          <p className="mt-1">A: {qa.response}</p>
                          {idx < interview.questionsAsked.length - 1 && (
                            <hr className="my-3" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-8">
                      No transcript available
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-8">
          Powered by Compound Interviewer
        </p>
      </div>
    </div>
  );
}
