"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, ClipboardList, CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface DashboardStats {
  clients: number;
  interviews: { total: number; completed: number; inProgress: number };
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
        <p className="text-muted-foreground mt-1">Platform overview at a glance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
            <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
              <Users className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.clients || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Active founders</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Interviews</CardTitle>
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.interviews.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.interviews.completed || 0} done, {stats?.interviews.inProgress || 0} active
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.interviews.completed || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">With transcripts</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Questions</CardTitle>
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.questions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">In question bank</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Interviews</CardTitle>
          <CardDescription>Latest sessions from founders</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentInterviews?.length ? (
            <div className="space-y-2">
              {stats.recentInterviews.map((interview) => (
                <Link
                  key={interview.id}
                  href="/admin/interviews"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors duration-200 group"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {interview.title || `Interview ${interview.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {interview.clientName || "Unknown"} · {new Date(interview.createdAt).toLocaleDateString()}
                    </p>
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
                      {interview.status === "completed" ? "Done" :
                       interview.status === "in_progress" ? "Active" : interview.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No interviews yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
