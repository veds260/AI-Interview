"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Play,
  CheckCircle,
  Clock,
  MessageSquare,
  Video,
  User,
  Building,
  Copy,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

interface Assignment {
  id: string;
  interviewId: string;
  writerId: string;
  status: "pending" | "in_progress" | "completed";
  notes: string | null;
  contentProduced: any[];
  assignedAt: string;
  completedAt: string | null;
  interview: {
    id: string;
    title: string | null;
    mode: string;
    status: string;
    questionsCount: number;
    transcript: string | null;
    recordingUrl: string | null;
    questionsAsked: any[];
    completedAt: string | null;
  } | null;
  client: {
    id: string;
    name: string;
    brandName: string | null;
    voiceStyle: string | null;
    topicsOfExpertise: string[] | null;
    knowledgeBase: {
      bio?: string;
      products?: string[];
      talkingPoints?: string[];
      pastInterviews?: string[];
      voiceGuidelines?: string;
      notes?: string;
      typefullyTweets?: Array<{
        content: string;
        postedAt?: string;
        likes?: number;
        retweets?: number;
      }>;
    } | null;
  } | null;
  extractionsCount: number;
  extractions: any[];
}

export default function AssignmentsPage() {
  const queryClient = useQueryClient();
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Fetch assignments
  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ["assignments"],
    queryFn: async () => {
      const res = await fetch("/api/assignments");
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
  });

  // Update assignment status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-blue-500"><Play className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingAssignments = assignments?.filter(a => a.status === "pending") || [];
  const inProgressAssignments = assignments?.filter(a => a.status === "in_progress") || [];
  const completedAssignments = assignments?.filter(a => a.status === "completed") || [];

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
        <h1 className="text-3xl font-bold">My Assignments</h1>
        <p className="text-gray-500 mt-1">
          View and manage your interview content assignments
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAssignments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressAssignments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedAssignments.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Assignments Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingAssignments.length})
          </TabsTrigger>
          <TabsTrigger value="in_progress">
            In Progress ({inProgressAssignments.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedAssignments.length})
          </TabsTrigger>
        </TabsList>

        {["pending", "in_progress", "completed"].map((status) => {
          const filteredAssignments = assignments?.filter(a => a.status === status) || [];

          return (
            <TabsContent key={status} value={status}>
              <Card>
                <CardContent className="pt-6">
                  {!filteredAssignments.length ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No {status.replace("_", " ")} assignments</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredAssignments.map((assignment) => (
                        <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  {assignment.interview?.mode === "live_video" ? (
                                    <Video className="h-4 w-4 text-blue-500" />
                                  ) : (
                                    <MessageSquare className="h-4 w-4 text-green-500" />
                                  )}
                                  <h3 className="font-semibold">
                                    {assignment.interview?.title || `Interview ${assignment.interviewId.slice(0, 8)}`}
                                  </h3>
                                  {getStatusBadge(assignment.status)}
                                </div>

                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  {assignment.client && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {assignment.client.name}
                                    </span>
                                  )}
                                  {assignment.client?.brandName && (
                                    <span className="flex items-center gap-1">
                                      <Building className="h-3 w-3" />
                                      {assignment.client.brandName}
                                    </span>
                                  )}
                                  <span>
                                    {assignment.extractionsCount} extractions
                                  </span>
                                  <span>
                                    Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
                                  </span>
                                </div>

                                {assignment.notes && (
                                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                    <strong>Notes:</strong> {assignment.notes}
                                  </p>
                                )}
                              </div>

                              <div className="flex gap-2">
                                {assignment.status === "pending" && (
                                  <Button
                                    size="sm"
                                    onClick={() => updateStatus.mutate({ id: assignment.id, status: "in_progress" })}
                                  >
                                    Start Working
                                  </Button>
                                )}
                                {assignment.status === "in_progress" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-green-50 text-green-700 hover:bg-green-100"
                                    onClick={() => updateStatus.mutate({ id: assignment.id, status: "completed" })}
                                  >
                                    Mark Complete
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedAssignment(assignment);
                                    setDetailDialogOpen(true);
                                  }}
                                >
                                  View Details
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Assignment Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedAssignment?.interview?.title || "Interview Details"}
            </DialogTitle>
            <DialogDescription>
              Review the interview content and create posts
            </DialogDescription>
          </DialogHeader>

          {selectedAssignment && (
            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="extractions">Content ({selectedAssignment.extractionsCount})</TabsTrigger>
                <TabsTrigger value="client">Client Info</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-gray-500">Interview Mode</h4>
                    <p className="flex items-center gap-2">
                      {selectedAssignment.interview?.mode === "live_video" ? (
                        <>
                          <Video className="h-4 w-4 text-blue-500" /> Video Interview
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-4 w-4 text-green-500" /> Text Chat
                        </>
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-gray-500">Questions Asked</h4>
                    <p>{selectedAssignment.interview?.questionsCount || 0}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-gray-500">Completed</h4>
                    <p>
                      {selectedAssignment.interview?.completedAt
                        ? new Date(selectedAssignment.interview.completedAt).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-gray-500">Recording</h4>
                    {selectedAssignment.interview?.recordingUrl ? (
                      <a
                        href={selectedAssignment.interview.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" /> View Recording
                      </a>
                    ) : (
                      <p className="text-gray-400">No recording available</p>
                    )}
                  </div>
                </div>

                {selectedAssignment.notes && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-gray-500">Assignment Notes</h4>
                    <p className="bg-yellow-50 p-3 rounded border border-yellow-100">
                      {selectedAssignment.notes}
                    </p>
                  </div>
                )}

                {/* Q&A Summary */}
                {selectedAssignment.interview?.questionsAsked && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-gray-500">Questions & Answers</h4>
                    <ScrollArea className="h-64 border rounded p-4">
                      {(selectedAssignment.interview.questionsAsked as any[]).map((qa, idx) => (
                        <div key={idx} className="mb-4 pb-4 border-b last:border-0">
                          <p className="font-medium text-blue-700">Q: {qa.question}</p>
                          <p className="mt-2 text-gray-700">A: {qa.response}</p>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="transcript">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Full Transcript</h4>
                    {selectedAssignment.interview?.transcript && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(selectedAssignment.interview!.transcript!)}
                      >
                        <Copy className="h-4 w-4 mr-1" /> Copy
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-96 border rounded p-4">
                    {selectedAssignment.interview?.transcript ? (
                      <pre className="whitespace-pre-wrap text-sm font-mono">
                        {selectedAssignment.interview.transcript}
                      </pre>
                    ) : (
                      <p className="text-gray-400 text-center py-8">
                        No transcript available
                      </p>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="extractions">
                <ScrollArea className="h-96">
                  {selectedAssignment.extractions?.length ? (
                    <div className="space-y-4">
                      {selectedAssignment.extractions.map((extraction: any) => (
                        <Card key={extraction.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-2">
                              <Badge variant="outline">
                                {extraction.contentType?.replace("_", " ") || "Content"}
                              </Badge>
                              <div className="flex gap-1">
                                {extraction.web2Friendly && (
                                  <Badge variant="secondary" className="text-xs">Web2</Badge>
                                )}
                                {extraction.storytellingPotential >= 4 && (
                                  <Badge variant="secondary" className="text-xs bg-purple-100">High Story</Badge>
                                )}
                              </div>
                            </div>

                            {extraction.keyQuote && (
                              <div className="mb-3">
                                <h5 className="text-xs text-gray-500 mb-1">Key Quote</h5>
                                <p className="italic bg-gray-50 p-2 rounded text-sm">
                                  "{extraction.keyQuote}"
                                </p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="mt-1"
                                  onClick={() => copyToClipboard(extraction.keyQuote)}
                                >
                                  <Copy className="h-3 w-3 mr-1" /> Copy
                                </Button>
                              </div>
                            )}

                            {extraction.tweetDraft && (
                              <div className="mb-3">
                                <h5 className="text-xs text-gray-500 mb-1">Tweet Draft</h5>
                                <p className="bg-blue-50 p-2 rounded text-sm">
                                  {extraction.tweetDraft}
                                </p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="mt-1"
                                  onClick={() => copyToClipboard(extraction.tweetDraft)}
                                >
                                  <Copy className="h-3 w-3 mr-1" /> Copy
                                </Button>
                              </div>
                            )}

                            {extraction.summary && (
                              <div>
                                <h5 className="text-xs text-gray-500 mb-1">Summary</h5>
                                <p className="text-sm text-gray-700">{extraction.summary}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No content extractions yet</p>
                      <p className="text-sm">Extractions will appear once generated from the interview</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="client">
                <ScrollArea className="h-96">
                {selectedAssignment.client ? (
                  <div className="space-y-4 pr-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-sm text-gray-500">Name</h4>
                        <p className="text-lg">{selectedAssignment.client.name}</p>
                      </div>
                      {selectedAssignment.client.brandName && (
                        <div>
                          <h4 className="font-medium text-sm text-gray-500">Brand</h4>
                          <p className="text-lg">{selectedAssignment.client.brandName}</p>
                        </div>
                      )}
                    </div>

                    {selectedAssignment.client.voiceStyle && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-500">Voice & Style</h4>
                        <p className="bg-gray-50 p-3 rounded mt-1">
                          {selectedAssignment.client.voiceStyle}
                        </p>
                      </div>
                    )}

                    {selectedAssignment.client.topicsOfExpertise?.length ? (
                      <div>
                        <h4 className="font-medium text-sm text-gray-500">Topics of Expertise</h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedAssignment.client.topicsOfExpertise.map((topic, idx) => (
                            <Badge key={idx} variant="outline">{topic}</Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Knowledge Base Section */}
                    {selectedAssignment.client.knowledgeBase && (
                      <>
                        <Separator className="my-4" />
                        <h3 className="font-semibold text-lg">Knowledge Base</h3>

                        {selectedAssignment.client.knowledgeBase.bio && (
                          <div>
                            <h4 className="font-medium text-sm text-gray-500">Bio</h4>
                            <p className="bg-blue-50 p-3 rounded mt-1 text-sm">
                              {selectedAssignment.client.knowledgeBase.bio}
                            </p>
                          </div>
                        )}

                        {selectedAssignment.client.knowledgeBase.voiceGuidelines && (
                          <div>
                            <h4 className="font-medium text-sm text-gray-500">Voice Guidelines</h4>
                            <p className="bg-purple-50 p-3 rounded mt-1 text-sm whitespace-pre-wrap">
                              {selectedAssignment.client.knowledgeBase.voiceGuidelines}
                            </p>
                          </div>
                        )}

                        {selectedAssignment.client.knowledgeBase.products?.length ? (
                          <div>
                            <h4 className="font-medium text-sm text-gray-500">Products/Services</h4>
                            <ul className="list-disc list-inside bg-gray-50 p-3 rounded mt-1 text-sm">
                              {selectedAssignment.client.knowledgeBase.products.map((product, idx) => (
                                <li key={idx}>{product}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {selectedAssignment.client.knowledgeBase.talkingPoints?.length ? (
                          <div>
                            <h4 className="font-medium text-sm text-gray-500">Key Talking Points</h4>
                            <ul className="list-disc list-inside bg-green-50 p-3 rounded mt-1 text-sm">
                              {selectedAssignment.client.knowledgeBase.talkingPoints.map((point, idx) => (
                                <li key={idx}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {selectedAssignment.client.knowledgeBase.notes && (
                          <div>
                            <h4 className="font-medium text-sm text-gray-500">Additional Notes</h4>
                            <p className="bg-yellow-50 p-3 rounded mt-1 text-sm whitespace-pre-wrap">
                              {selectedAssignment.client.knowledgeBase.notes}
                            </p>
                          </div>
                        )}

                        {selectedAssignment.client.knowledgeBase.typefullyTweets?.length ? (
                          <div>
                            <h4 className="font-medium text-sm text-gray-500">
                              Sample Posts ({selectedAssignment.client.knowledgeBase.typefullyTweets.length})
                            </h4>
                            <div className="space-y-2 mt-1">
                              {selectedAssignment.client.knowledgeBase.typefullyTweets.slice(0, 5).map((tweet, idx) => (
                                <div key={idx} className="bg-gray-50 p-3 rounded text-sm border-l-2 border-blue-400">
                                  <p>{tweet.content}</p>
                                  {(tweet.likes || tweet.retweets) && (
                                    <p className="text-xs text-gray-500 mt-2">
                                      {tweet.likes && `${tweet.likes} likes`}
                                      {tweet.likes && tweet.retweets && " • "}
                                      {tweet.retweets && `${tweet.retweets} retweets`}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">
                    No client information available
                  </p>
                )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
            <Link href="/writer/content-bank">
              <Button>
                Browse Content Bank
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
