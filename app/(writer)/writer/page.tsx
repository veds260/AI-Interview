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
import { ClipboardList, Archive, FileText, CheckCircle, Loader2 } from "lucide-react";

interface WriterStats {
  pending: number;
  inProgress: number;
  completed: number;
  completedThisMonth: number;
  contentBank: number;
  recentAssignments: Array<{
    id: string;
    status: string;
    assignedAt: string;
    interviewId: string;
    interviewTitle: string | null;
    clientName: string | null;
  }>;
}

export default function WriterDashboard() {
  const { data: stats, isLoading } = useQuery<WriterStats>({
    queryKey: ["writer-dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/writer/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Writer Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Access interview content and create posts
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Assignments
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.pending || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Awaiting your review
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.inProgress || 0}</div>
                <p className="text-xs text-muted-foreground">Currently working on</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.completedThisMonth || 0}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content Bank</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.contentBank || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Available extractions
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your Assignments</CardTitle>
            <CardDescription>
              Interviews assigned to you for content creation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : stats?.recentAssignments?.length ? (
              <div className="space-y-3">
                {stats.recentAssignments.map((assignment) => (
                  <Link
                    key={assignment.id}
                    href={`/writer/assignments/${assignment.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {assignment.interviewTitle || `Interview ${assignment.interviewId?.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {assignment.clientName || "Unknown client"} -{" "}
                        {new Date(assignment.assignedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      className={
                        assignment.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : assignment.status === "in_progress"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {assignment.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No assignments yet. Check back soon!
              </p>
            )}
            <Link href="/writer/assignments">
              <Button variant="outline" className="w-full mt-4">
                View All Assignments
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
            <CardDescription>Jump to frequently used sections</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/writer/content-bank">
              <Button variant="outline" className="w-full justify-start">
                <Archive className="mr-2 h-4 w-4" />
                Browse Content Bank
              </Button>
            </Link>
            <Link href="/writer/content-bank?type=hot_take">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                Hot Takes
              </Button>
            </Link>
            <Link href="/writer/content-bank?type=origin_story">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                Origin Stories
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
