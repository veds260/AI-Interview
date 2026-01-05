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
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "paused":
        return <PauseCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "paused":
        return <Badge variant="warning">Paused</Badge>;
      default:
        return <Badge variant="default">In Progress</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Interviews</h1>
          <p className="text-muted-foreground mt-1">View and continue your interviews</p>
        </div>
        <Link href="/client/interview/start">
          <Button variant="premium">
            <Play className="mr-2 h-4 w-4" />
            New Interview
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : interviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
              <Video className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">
              You haven&apos;t done any interviews yet.
            </p>
            <Link href="/client/interview/start">
              <Button variant="premium">Start Your First Interview</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {interviews.map((interview) => (
            <Card key={interview.id} className="hover:border-muted-foreground/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      interview.mode === "live_video" ? "bg-red-500/20" : "bg-emerald-500/20"
                    }`}>
                      {interview.mode === "live_video" ? (
                        <Video className="h-5 w-5 text-red-500" />
                      ) : (
                        <MessageSquare className="h-5 w-5 text-emerald-500" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {interview.mode === "live_video"
                          ? "Voice Interview"
                          : "Written Interview"}
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
                        ? "Interview paused - resume anytime"
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
                      <Button size="sm" variant="secondary">
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
