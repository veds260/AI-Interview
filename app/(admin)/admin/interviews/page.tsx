"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  FileText,
  MessageSquare,
  Eye,
  Copy,
  Share2,
  Link,
  Check,
  Search,
  X,
  Trash2,
  Mic,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Interview {
  id: string;
  clientId: string | null;
  clientName?: string | null;
  mode: string;
  status: string;
  title: string | null;
  questionsCount: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  transcript: string | null;
  transcriptMarkdown: string | null;
  questionsAsked: any[];
  shareToken: string | null;
  shareTokenExpiresAt: string | null;
}

interface Client {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In Progress" },
  { value: "paused", label: "Paused" },
  { value: "pending", label: "Pending" },
];

const MODE_OPTIONS = [
  { value: "all", label: "All Modes" },
  { value: "live_video", label: "Audio" },
  { value: "text_chat", label: "Text" },
];

export default function AdminInterviewsPage() {
  const queryClient = useQueryClient();
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [interviewToDelete, setInterviewToDelete] = useState<Interview | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createClientId, setCreateClientId] = useState("");
  const [createMode, setCreateMode] = useState("text_chat");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");

  const { data: clientsData } = useQuery<Client[]>({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      return data.clients || data;
    },
  });

  const { data: interviews = [], isLoading } = useQuery<Interview[]>({
    queryKey: ["admin-interviews"],
    queryFn: async () => {
      const res = await fetch("/api/interviews");
      if (!res.ok) throw new Error("Failed to fetch interviews");
      return res.json();
    },
  });

  const filteredInterviews = useMemo(() => {
    return interviews.filter((interview) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = interview.title?.toLowerCase().includes(query);
        const matchesClient = interview.clientName?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesClient) return false;
      }
      if (clientFilter !== "all" && interview.clientId !== clientFilter) return false;
      if (statusFilter !== "all" && interview.status !== statusFilter) return false;
      if (modeFilter !== "all" && interview.mode !== modeFilter) return false;
      return true;
    });
  }, [interviews, searchQuery, clientFilter, statusFilter, modeFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setClientFilter("all");
    setStatusFilter("all");
    setModeFilter("all");
  };

  const hasActiveFilters = searchQuery || clientFilter !== "all" || statusFilter !== "all" || modeFilter !== "all";

  const shareMutation = useMutation({
    mutationFn: async (interviewId: string) => {
      const res = await fetch(`/api/interviews/${interviewId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: 30 }),
      });
      if (!res.ok) throw new Error("Failed to generate share link");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-interviews"] });
      setShareUrl(data.shareUrl);
      toast.success("Share link generated");
    },
    onError: () => {
      toast.error("Failed to generate share link");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (interviewId: string) => {
      const res = await fetch(`/api/interviews/${interviewId}/share`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to revoke share link");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-interviews"] });
      setShareUrl(null);
      toast.success("Share link revoked");
    },
    onError: () => {
      toast.error("Failed to revoke share link");
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ clientId, mode }: { clientId: string; mode: string }) => {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, mode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create interview");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-interviews"] });
      setCreateDialogOpen(false);
      toast.success("Interview created");
      // Auto-generate share link
      try {
        const shareRes = await fetch(`/api/interviews/${data.id}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresInDays: 30 }),
        });
        if (shareRes.ok) {
          const shareData = await shareRes.json();
          queryClient.invalidateQueries({ queryKey: ["admin-interviews"] });
          setShareUrl(shareData.shareUrl);
          setSelectedInterview({ ...data, shareToken: shareData.shareToken, shareTokenExpiresAt: shareData.expiresAt } as Interview);
          setShareDialogOpen(true);
        }
      } catch {
        // Share link generation failed, user can do it manually
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (interviewId: string) => {
      const res = await fetch(`/api/interviews/${interviewId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete interview");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-interviews"] });
      toast.success("Interview deleted");
      setDeleteConfirmOpen(false);
      setInterviewToDelete(null);
    },
    onError: () => {
      toast.error("Failed to delete interview");
    },
  });

  const copyShareLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500/20 text-blue-400">In Progress</Badge>;
      case "paused":
        return <Badge variant="warning">Paused</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getModeLabel = (mode: string) => {
    return mode === "live_video" ? "Audio" : "Text";
  };

  const getModeIcon = (mode: string) => {
    return mode === "live_video" ? (
      <Mic className="h-4 w-4" />
    ) : (
      <MessageSquare className="h-4 w-4" />
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getTranscriptText = (interview: Interview): string | null => {
    if (interview.transcriptMarkdown) return interview.transcriptMarkdown;
    if (interview.transcript) return interview.transcript;
    if (!interview.questionsAsked?.length) return null;

    // Generate from Q&A pairs as fallback
    let md = `# Interview Transcript\n\n`;
    md += `**Title:** ${interview.title || "Interview"}\n`;
    md += `**Date:** ${interview.completedAt ? new Date(interview.completedAt).toLocaleDateString() : "N/A"}\n\n---\n\n`;
    interview.questionsAsked.forEach((qa: any, i: number) => {
      md += `## Q${i + 1}: ${qa.question}\n\n${qa.response}\n\n`;
    });
    return md;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interviews</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all interview sessions
          </p>
        </div>
        <Button onClick={() => { setCreateClientId(""); setCreateMode("text_chat"); setCreateDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Interview
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredInterviews.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredInterviews.filter((i) => i.status === "completed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {filteredInterviews.filter((i) => i.status === "in_progress").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {filteredInterviews.filter((i) => i.transcriptMarkdown || i.transcript).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clientsData?.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Modes" />
          </SelectTrigger>
          <SelectContent>
            {MODE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Interviews</CardTitle>
          <CardDescription>
            {filteredInterviews.length} interview{filteredInterviews.length !== 1 ? "s" : ""}
            {hasActiveFilters && ` (filtered from ${interviews.length} total)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInterviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {hasActiveFilters
                ? "No interviews match your filters."
                : "No interviews yet. Create one and share the link with a client."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInterviews.map((interview) => (
                  <TableRow key={interview.id}>
                    <TableCell>
                      <span className="font-medium text-sm">
                        {interview.clientName || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {interview.title || `Interview ${interview.id.slice(0, 8)}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getModeIcon(interview.mode)}
                        <span className="text-sm">
                          {getModeLabel(interview.mode)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(interview.status)}</TableCell>
                    <TableCell>{interview.questionsCount || 0}</TableCell>
                    <TableCell>
                      {new Date(interview.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedInterview(interview);
                            setViewDialogOpen(true);
                          }}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {getTranscriptText(interview) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const text = getTranscriptText(interview);
                              if (text) copyToClipboard(text);
                            }}
                            title="Copy transcript"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedInterview(interview);
                            if (interview.shareToken) {
                              const baseUrl = window.location.origin;
                              setShareUrl(`${baseUrl}/shared/${interview.shareToken}`);
                            } else {
                              setShareUrl(null);
                            }
                            setShareDialogOpen(true);
                          }}
                          title="Share link"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setInterviewToDelete(interview);
                            setDeleteConfirmOpen(true);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Interview Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedInterview?.title || "Interview Details"}
            </DialogTitle>
            <DialogDescription>
              View interview transcript
            </DialogDescription>
          </DialogHeader>

          {selectedInterview && (
            <Tabs defaultValue="transcript" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="qa">Q&A</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                    <p>{getStatusBadge(selectedInterview.status)}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Mode</h4>
                    <p className="flex items-center gap-2">
                      {getModeIcon(selectedInterview.mode)}
                      <span>{getModeLabel(selectedInterview.mode)}</span>
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Questions</h4>
                    <p>{selectedInterview.questionsCount || 0}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Completed</h4>
                    <p>
                      {selectedInterview.completedAt
                        ? new Date(selectedInterview.completedAt).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="qa">
                <ScrollArea className="h-96">
                  {selectedInterview.questionsAsked?.length ? (
                    <div className="space-y-4 pr-4">
                      {(selectedInterview.questionsAsked as any[]).map((qa, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-blue-700">
                              Q{idx + 1}: {qa.question}
                            </h4>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(`Q: ${qa.question}\nA: ${qa.response}`)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="mt-2 text-foreground whitespace-pre-wrap">
                            {qa.response}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      No Q&A data available
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="transcript">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Markdown Transcript</h4>
                    {getTranscriptText(selectedInterview) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const text = getTranscriptText(selectedInterview);
                          if (text) copyToClipboard(text);
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" /> Copy Transcript
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-80 border rounded p-4">
                    {getTranscriptText(selectedInterview) ? (
                      <pre className="whitespace-pre-wrap text-sm">
                        {getTranscriptText(selectedInterview)}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No transcript available yet. Complete the interview first.
                      </p>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Interview</DialogTitle>
            <DialogDescription>
              Generate a shareable link for this interview
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {shareUrl ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Share Link</Label>
                  <div className="flex gap-2">
                    <Input value={shareUrl} readOnly className="font-mono text-sm" />
                    <Button size="icon" variant="outline" onClick={copyShareLink}>
                      {linkCopied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {selectedInterview?.shareTokenExpiresAt && (
                  <p className="text-sm text-muted-foreground">
                    Expires: {new Date(selectedInterview.shareTokenExpiresAt).toLocaleDateString()}
                  </p>
                )}

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    if (selectedInterview) {
                      revokeMutation.mutate(selectedInterview.id);
                    }
                  }}
                  disabled={revokeMutation.isPending}
                >
                  {revokeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Revoke Link
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Link className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  No share link exists. Generate one to send to the interviewee.
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (selectedInterview) {
                      shareMutation.mutate(selectedInterview.id);
                    }
                  }}
                  disabled={shareMutation.isPending}
                >
                  {shareMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Share2 className="h-4 w-4 mr-2" />
                  Generate Share Link
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Interview Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Interview</DialogTitle>
            <DialogDescription>
              Select a client and mode. A shareable link will be generated automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={createClientId} onValueChange={setCreateClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clientsData?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={createMode} onValueChange={setCreateMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text_chat">Text Chat</SelectItem>
                  <SelectItem value="live_video">Audio</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {createMode === "live_video"
                  ? "Questions spoken aloud via TTS, answers recorded via microphone"
                  : "Text-based Q&A chat interface"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!createClientId) {
                  toast.error("Please select a client");
                  return;
                }
                createMutation.mutate({ clientId: createClientId, mode: createMode });
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create & Generate Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Interview?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the interview and all associated data.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                The following will be permanently deleted:
              </p>
              <ul className="text-sm text-red-700 mt-2 list-disc list-inside space-y-1">
                <li>Interview record and all messages</li>
                <li>All Q&A history and transcript</li>
              </ul>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>Interview:</strong> {interviewToDelete?.title || `Interview ${interviewToDelete?.id?.slice(0, 8)}`}</p>
              <p><strong>Client:</strong> {interviewToDelete?.clientName || "Unknown"}</p>
              <p><strong>Questions:</strong> {interviewToDelete?.questionsCount || 0}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setInterviewToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (interviewToDelete) {
                  deleteMutation.mutate(interviewToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Interview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
