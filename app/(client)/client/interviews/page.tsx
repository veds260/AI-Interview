"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Play,
  Video,
  MessageSquare,
  Clock,
  CheckCircle,
  PauseCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Interview {
  id: string;
  mode: "text_chat" | "live_video";
  status: "in_progress" | "paused" | "completed";
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export default function InterviewsPage() {
  const { data: interviews = [], isLoading } = useQuery<Interview[]>({
    queryKey: ["my-interviews"],
    queryFn: async () => {
      const res = await fetch("/api/interviews/mine");
      if (!res.ok) throw new Error("Failed to fetch interviews");
      return res.json();
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "paused":
        return <PauseCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case "paused":
        return <Badge variant="secondary">Paused</Badge>;
      default:
        return <Badge variant="default">In Progress</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Interviews</h1>
          <p className="text-gray-500 mt-1">View and continue your interviews</p>
        </div>
        <Link href="/client/interview/start">
          <Button>
            <Play className="mr-2 h-4 w-4" />
            New Interview
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : interviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              You haven&apos;t done any interviews yet.
            </p>
            <Link href="/client/interview/start">
              <Button>Start Your First Interview</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {interviews.map((interview) => (
            <Card key={interview.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {interview.mode === "live_video" ? (
                      <Video className="h-5 w-5 text-blue-600" />
                    ) : (
                      <MessageSquare className="h-5 w-5 text-green-600" />
                    )}
                    <div>
                      <CardTitle className="text-lg">
                        {interview.mode === "live_video"
                          ? "Video Interview"
                          : "Text Interview"}
                      </CardTitle>
                      <CardDescription>
                        Started {new Date(interview.createdAt).toLocaleDateString()}{" "}
                        at {new Date(interview.createdAt).toLocaleTimeString()}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(interview.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {getStatusIcon(interview.status)}
                    <span>
                      {interview.status === "completed"
                        ? "Interview completed"
                        : interview.status === "paused"
                        ? "Interview paused - you can resume anytime"
                        : "Interview in progress"}
                    </span>
                  </div>
                  {interview.status !== "completed" && (
                    <Link
                      href={
                        interview.mode === "live_video"
                          ? `/client/interview/video/${interview.id}`
                          : `/client/interview/text/${interview.id}`
                      }
                    >
                      <Button variant="outline" size="sm">
                        {interview.status === "paused" ? "Resume" : "Continue"}
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
