"use client";

import { useQuery } from "@tanstack/react-query";
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
import { Mic, MessageSquare, CheckCircle, Clock, Loader2, FileText, ArrowRight } from "lucide-react";

interface ClientStats {
  completed: number;
  inProgress: number;
  contentGenerated: number;
  recentInterviews: Array<{
    id: string;
    title: string | null;
    status: string;
    mode: string;
    createdAt: string;
  }>;
}

export default function ClientDashboard() {
  const { data: stats, isLoading } = useQuery<ClientStats>({
    queryKey: ["client-dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/client/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ready to Share Your Story?</h1>
        <p className="text-muted-foreground mt-2">
          Start an interview. We'll handle the rest.
        </p>
      </div>

      {/* Interview Mode Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="group border border-gray-800 hover:border-red-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-gray-900/80">
          <CardHeader className="pb-4">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-red-500/30 transition-colors duration-300">
              <Mic className="h-6 w-6 text-red-500" />
            </div>
            <CardTitle className="text-xl text-white">Voice Interview</CardTitle>
            <CardDescription className="text-gray-300">
              Speak naturally. Our AI listens and asks follow-up questions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/client/interview/start?mode=live_video">
              <Button variant="premium" className="w-full group-hover:shadow-[0_0_30px_-5px_rgba(255,0,0,0.4)]">
                Start Voice Interview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="group border border-gray-800 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-gray-900/80">
          <CardHeader className="pb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-500/30 transition-colors duration-300">
              <MessageSquare className="h-6 w-6 text-emerald-500" />
            </div>
            <CardTitle className="text-xl text-white">Written Interview</CardTitle>
            <CardDescription className="text-gray-300">
              Type at your own pace. Save and continue anytime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/client/interview/start?mode=text_chat">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                Start Written Interview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-3xl font-bold">{stats?.completed || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Sessions finished</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-3xl font-bold">{stats?.inProgress || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Paused interviews
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Posts Created
            </CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-3xl font-bold">{stats?.contentGenerated || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ready to publish
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <CardDescription>Your interview history</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stats?.recentInterviews?.length ? (
            <div className="space-y-2">
              {stats.recentInterviews.map((interview) => (
                <Link
                  key={interview.id}
                  href={
                    interview.status === "completed"
                      ? "/client/interviews"
                      : interview.mode === "live_video"
                      ? `/client/interview/video/${interview.id}`
                      : `/client/interview/text/${interview.id}`
                  }
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      interview.mode === "live_video" ? "bg-red-500/10" : "bg-emerald-500/10"
                    }`}>
                      {interview.mode === "live_video" ? (
                        <Mic className="h-4 w-4 text-red-500" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-emerald-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {interview.title || `Interview ${interview.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(interview.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        interview.status === "completed"
                          ? "success"
                          : interview.status === "in_progress"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {interview.status === "completed" ? "Completed" :
                       interview.status === "in_progress" ? "In Progress" : interview.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                <Mic className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No interviews yet. Start your first interview above.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
