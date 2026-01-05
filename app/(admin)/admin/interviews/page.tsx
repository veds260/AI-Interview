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
  Play,
  FileText,
  Video,
  MessageSquare,
  Eye,
  Download,
  Copy,
  UserPlus,
  ExternalLink,
  Share2,
  Link,
  Check,
  Search,
  X,
  RefreshCw,
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
  extractionsCount: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  transcript: string | null;
  recordingUrl: string | null;
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
  { value: "live_video", label: "Live Video" },
  { value: "text", label: "Text" },
];

export default function AdminInterviewsPage() {
  const queryClient = useQueryClient();
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [extractConfirmOpen, setExtractConfirmOpen] = useState(false);
  const [interviewToExtract, setInterviewToExtract] = useState<Interview | null>(null);
  const [reextractConfirmOpen, setReextractConfirmOpen] = useState(false);
  const [interviewToReextract, setInterviewToReextract] = useState<Interview | null>(null);
  const [extractingInterviewId, setExtractingInterviewId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");

  // Fetch clients for filter
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

  // Filter interviews
  const filteredInterviews = useMemo(() => {
    return interviews.filter((interview) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = interview.title?.toLowerCase().includes(query);
        const matchesClient = interview.clientName?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesClient) return false;
      }

      // Client filter
      if (clientFilter !== "all" && interview.clientId !== clientFilter) return false;

      // Status filter
      if (statusFilter !== "all" && interview.status !== statusFilter) return false;

      // Mode filter
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

  const { data: writers = [] } = useQuery<any[]>({
    queryKey: ["writers"],
    queryFn: async () => {
      const res = await fetch("/api/writers");
      if (!res.ok) throw new Error("Failed to fetch writers");
      return res.json();
    },
    enabled: assignDialogOpen,
  });

  const extractMutation = useMutation({
    mutationFn: async (interviewId: string) => {
      setExtractingInterviewId(interviewId);
      const res = await fetch("/api/extractions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId }),
      });
      if (!res.ok) throw new Error("Failed to extract content");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-interviews"] });
      toast.success(`Extracted ${data.count} content pieces.`);
      setExtractConfirmOpen(false);
      setInterviewToExtract(null);
      setExtractingInterviewId(null);
    },
    onError: () => {
      toast.error("Failed to extract content");
      setExtractingInterviewId(null);
    },
  });

  const reextractMutation = useMutation({
    mutationFn: async (interviewId: string) => {
      setExtractingInterviewId(interviewId);
      const res = await fetch("/api/extractions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, reextract: true }),
      });
      if (!res.ok) throw new Error("Failed to re-extract content");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-interviews"] });
      queryClient.invalidateQueries({ queryKey: ["admin-extractions"] });
      toast.success(`Re-extracted ${data.count} content pieces.`);
      setReextractConfirmOpen(false);
      setInterviewToReextract(null);
      setExtractingInterviewId(null);
    },
    onError: () => {
      toast.error("Failed to re-extract content");
      setExtractingInterviewId(null);
    },
  });

  const handleExtractClick = (interview: Interview) => {
    if (interview.status !== "completed") {
      setInterviewToExtract(interview);
      setExtractConfirmOpen(true);
    } else {
      extractMutation.mutate(interview.id);
    }
  };

  const assignMutation = useMutation({
    mutationFn: async ({ interviewId, writerId }: { interviewId: string; writerId: string }) => {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, writerId }),
      });
      if (!res.ok) throw new Error("Failed to assign");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Interview assigned to writer");
      setAssignDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to assign interview");
    },
  });

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
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getModeIcon = (mode: string) => {
    return mode === "live_video" ? (
      <Video className="h-4 w-4" />
    ) : (
      <MessageSquare className="h-4 w-4" />
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const exportInterview = (interview: Interview) => {
    const exportData = {
      title: interview.title,
      mode: interview.mode,
      status: interview.status,
      completedAt: interview.completedAt,
      questionsCount: interview.questionsCount,
      transcript: interview.transcript,
      questionsAsked: interview.questionsAsked,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-${interview.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Interview exported");
  };

  const exportTranscript = (interview: Interview) => {
    if (!interview.questionsAsked?.length) {
      toast.error("No transcript available");
      return;
    }

    let transcript = `Interview: ${interview.title || interview.id}\n`;
    transcript += `Date: ${interview.completedAt ? new Date(interview.completedAt).toLocaleString() : "N/A"}\n`;
    transcript += `Mode: ${interview.mode.replace("_", " ")}\n`;
    transcript += `\n${"=".repeat(50)}\n\n`;

    (interview.questionsAsked as any[]).forEach((qa, idx) => {
      transcript += `Q${idx + 1}: ${qa.question}\n\n`;
      transcript += `A: ${qa.response}\n\n`;
      transcript += `${"-".repeat(30)}\n\n`;
    });

    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${interview.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript exported");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Interviews</h1>
        <p className="text-gray-500 mt-1">
          View, extract content, and manage all interview sessions
        </p>
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
            <CardTitle className="text-sm font-medium">Extracted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {filteredInterviews.filter((i) => (i.extractionsCount || 0) > 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredInterviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {hasActiveFilters
                ? "No interviews match your filters."
                : "No interviews yet. Clients will appear here after they complete interviews."}
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
                  <TableHead>Extractions</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInterviews.map((interview) => (
                  <TableRow key={interview.id}>
                    <TableCell>
                      <span className="font-medium text-sm">
                        {interview.clientName || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {interview.title || `Interview ${interview.id.slice(0, 8)}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getModeIcon(interview.mode)}
                        <span className="capitalize text-sm">
                          {interview.mode.replace("_", " ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(interview.status)}</TableCell>
                    <TableCell>{interview.questionsCount || 0}</TableCell>
                    <TableCell>
                      {extractingInterviewId === interview.id ? (
                        <Badge className="bg-blue-100 text-blue-800 animate-pulse">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Extracting...
                        </Badge>
                      ) : (interview.extractionsCount || 0) > 0 ? (
                        <Badge className="bg-green-100 text-green-800">
                          {interview.extractionsCount} Available
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          Not extracted
                        </Badge>
                      )}
                    </TableCell>
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
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {["completed", "in_progress", "paused"].includes(interview.status) && (
                          <>
                            {(interview.extractionsCount || 0) === 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExtractClick(interview)}
                                disabled={extractMutation.isPending || extractingInterviewId === interview.id}
                                title="Extract content"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setInterviewToReextract(interview);
                                    setReextractConfirmOpen(true);
                                  }}
                                  disabled={reextractMutation.isPending || extractingInterviewId === interview.id}
                                  title="Re-extract with full context"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedInterview(interview);
                                    setAssignDialogOpen(true);
                                  }}
                                  title="Assign to writer"
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => exportTranscript(interview)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>

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
                        >
                          <Share2 className="h-4 w-4" />
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
              View interview content and transcript
            </DialogDescription>
          </DialogHeader>

          {selectedInterview && (
            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="qa">Q&A</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-500">Status</h4>
                    <p>{getStatusBadge(selectedInterview.status)}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-500">Mode</h4>
                    <p className="flex items-center gap-2">
                      {getModeIcon(selectedInterview.mode)}
                      <span className="capitalize">
                        {selectedInterview.mode.replace("_", " ")}
                      </span>
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-500">Questions</h4>
                    <p>{selectedInterview.questionsCount || 0}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-500">Extractions</h4>
                    <p>{selectedInterview.extractionsCount || 0}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-500">Completed</h4>
                    <p>
                      {selectedInterview.completedAt
                        ? new Date(selectedInterview.completedAt).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-500">Recording</h4>
                    {selectedInterview.recordingUrl ? (
                      <a
                        href={selectedInterview.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" /> View Recording
                      </a>
                    ) : (
                      <p className="text-gray-400">No recording</p>
                    )}
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

              <TabsContent value="transcript">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Full Transcript</h4>
                    <div className="flex gap-2">
                      {selectedInterview.transcript && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(selectedInterview.transcript!)}
                        >
                          <Copy className="h-4 w-4 mr-1" /> Copy
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportTranscript(selectedInterview)}
                      >
                        <Download className="h-4 w-4 mr-1" /> Export
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-80 border rounded p-4">
                    {selectedInterview.transcript ? (
                      <pre className="whitespace-pre-wrap text-sm">
                        {selectedInterview.transcript}
                      </pre>
                    ) : selectedInterview.questionsAsked?.length ? (
                      <div className="space-y-4">
                        {(selectedInterview.questionsAsked as any[]).map((qa, idx) => (
                          <div key={idx}>
                            <p className="font-medium">Q: {qa.question}</p>
                            <p className="mt-1">A: {qa.response}</p>
                            {idx < (selectedInterview.questionsAsked?.length || 0) - 1 && (
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
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            {selectedInterview && ["completed", "in_progress", "paused"].includes(selectedInterview.status) && (
              <>
                {(selectedInterview.extractionsCount || 0) === 0 ? (
                  <Button
                    onClick={() => {
                      setViewDialogOpen(false);
                      handleExtractClick(selectedInterview);
                    }}
                    disabled={extractMutation.isPending}
                  >
                    {extractMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Extract Content
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setViewDialogOpen(false);
                      setAssignDialogOpen(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign to Writer
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Writer</DialogTitle>
            <DialogDescription>
              Select a writer to assign this interview content to
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {writers.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No writers available. Add writers first.
              </p>
            ) : (
              <div className="space-y-2">
                {writers.map((writer) => (
                  <Button
                    key={writer.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedInterview) {
                        assignMutation.mutate({
                          interviewId: selectedInterview.id,
                          writerId: writer.id,
                        });
                      }
                    }}
                    disabled={assignMutation.isPending}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {writer.name || writer.email}
                    <span className="ml-auto text-xs text-gray-400">
                      {writer.assignmentsCount?.inProgress || 0} active
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
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
              Generate a shareable link for clients to view this interview
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
                  <p className="text-sm text-gray-500">
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
                <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                  <Link className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500">
                  No share link exists for this interview. Generate one to share with clients.
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

      {/* Extract Confirmation Dialog */}
      <Dialog open={extractConfirmOpen} onOpenChange={setExtractConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extract from Incomplete Interview?</DialogTitle>
            <DialogDescription>
              This interview is currently {interviewToExtract?.status === "in_progress" ? "in progress" : "paused"}.
              Extracting content will mark this interview as <strong>completed</strong> and it cannot be continued.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                The client will no longer be able to continue this interview after extraction.
              </p>
            </div>
            <div className="text-sm text-gray-600">
              <p><strong>Interview:</strong> {interviewToExtract?.title || `Interview ${interviewToExtract?.id?.slice(0, 8)}`}</p>
              <p><strong>Questions answered:</strong> {interviewToExtract?.questionsCount || 0}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExtractConfirmOpen(false);
                setInterviewToExtract(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (interviewToExtract) {
                  extractMutation.mutate(interviewToExtract.id);
                }
              }}
              disabled={extractMutation.isPending}
            >
              {extractMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Extract & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-extract Confirmation Dialog */}
      <Dialog open={reextractConfirmOpen} onOpenChange={setReextractConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-extract Content?</DialogTitle>
            <DialogDescription>
              This will delete all existing extracted content for this interview and re-generate it using the full knowledge base context.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                The new extraction will use:
              </p>
              <ul className="text-sm text-blue-700 mt-2 list-disc list-inside space-y-1">
                <li>Client&apos;s full knowledge base (bio, products, talking points)</li>
                <li>Competitor topics for timely content</li>
                <li>All other Q&As from this interview for context</li>
                <li>Voice style guidelines</li>
              </ul>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                Warning: This will permanently delete {interviewToReextract?.extractionsCount || 0} existing content pieces.
              </p>
            </div>
            <div className="text-sm text-gray-600">
              <p><strong>Interview:</strong> {interviewToReextract?.title || `Interview ${interviewToReextract?.id?.slice(0, 8)}`}</p>
              <p><strong>Client:</strong> {interviewToReextract?.clientName || "Unknown"}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReextractConfirmOpen(false);
                setInterviewToReextract(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (interviewToReextract) {
                  reextractMutation.mutate(interviewToReextract.id);
                }
              }}
              disabled={reextractMutation.isPending}
            >
              {reextractMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Re-extract Content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
