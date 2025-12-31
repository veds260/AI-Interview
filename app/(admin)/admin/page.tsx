"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, FileText, Video, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface DashboardStats {
  clients: number;
  interviews: { total: number; completed: number; inProgress: number };
  extractions: { total: number; extracted: number; assigned: number; used: number };
  questions: number;
  recentInterviews: Array<{
    id: string;
    title: string | null;
    status: string;
    clientName: string | null;
    createdAt: string;
  }>;
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your interview platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.clients || 0}</div>
            <p className="text-xs text-muted-foreground">Active founders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.interviews.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.interviews.completed || 0} completed, {stats?.interviews.inProgress || 0} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content Extractions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.extractions.total || 0}</div>
            <p className="text-xs text-muted-foreground">Stories, takes, insights</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.questions || 0}</div>
            <p className="text-xs text-muted-foreground">In question bank</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Interviews</CardTitle>
            <CardDescription>Latest interview sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentInterviews?.length ? (
              <div className="space-y-3">
                {stats.recentInterviews.map((interview) => (
                  <Link
                    key={interview.id}
                    href="/admin/interviews"
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {interview.title || `Interview ${interview.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {interview.clientName || "Unknown client"} - {new Date(interview.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      className={
                        interview.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }
                    >
                      {interview.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No interviews yet. Create a client to get started.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content Pipeline</CardTitle>
            <CardDescription>Extractions by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Extracted</span>
                <span className="font-medium">{stats?.extractions.extracted || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Assigned</span>
                <span className="font-medium">{stats?.extractions.assigned || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">{stats?.extractions.used || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
