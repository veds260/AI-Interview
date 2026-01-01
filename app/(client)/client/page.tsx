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
import { Video, MessageSquare, History, Clock, Loader2 } from "lucide-react";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome to Your Interview Portal</h1>
        <p className="text-gray-500 mt-1">
          Share your story through AI-powered interviews
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-2 hover:border-blue-500 transition-colors">
          <CardHeader>
            <Video className="h-8 w-8 text-blue-600 mb-2" />
            <CardTitle>Video Interview</CardTitle>
            <CardDescription>
              Have a live conversation with our AI avatar. Speak naturally and
              share your insights.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/client/interview/start?mode=live_video">
              <Button className="w-full">Start Video Interview</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-green-500 transition-colors">
          <CardHeader>
            <MessageSquare className="h-8 w-8 text-green-600 mb-2" />
            <CardTitle>Text Interview</CardTitle>
            <CardDescription>
              Answer questions at your own pace through text. Perfect for busy
              schedules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/client/interview/start?mode=text_chat">
              <Button variant="outline" className="w-full">
                Start Text Interview
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Interviews
            </CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.completed || 0}</div>
                <p className="text-xs text-muted-foreground">Sessions finished</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.inProgress || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Paused or ongoing interviews
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Content Generated
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.contentGenerated || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Stories and insights extracted
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your interview history</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : stats?.recentInterviews?.length ? (
            <div className="space-y-3">
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
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {interview.title || `Interview ${interview.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {interview.mode === "live_video" ? "Video" : "Text"} -{" "}
                      {new Date(interview.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    className={
                      interview.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : interview.status === "in_progress"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }
                  >
                    {interview.status}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No interviews yet. Start your first interview above!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
