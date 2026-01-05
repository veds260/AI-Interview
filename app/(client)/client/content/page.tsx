"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Copy, Check, FileText, MessageSquare, Linkedin, Twitter, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import CommentableTweetMockup from "@/components/content/commentable-tweet-mockup";
import CommentList from "@/components/content/comment-list";
import LinkedInMockup from "@/components/content/linkedin-mockup";

const CONTENT_TYPES = [
  { value: "all", label: "All Types" },
  { value: "origin_story", label: "Origin Story" },
  { value: "failure_story", label: "Failure Story" },
  { value: "success_story", label: "Success Story" },
  { value: "hot_take", label: "Hot Take" },
  { value: "contrarian_view", label: "Contrarian View" },
  { value: "prediction", label: "Prediction" },
  { value: "technical", label: "Technical" },
  { value: "framework", label: "Framework" },
  { value: "advice", label: "Advice" },
];

interface Comment {
  id: string;
  extractionId: string;
  userId: string | null;
  userName: string;
  userRole: string;
  commentText: string;
  selectedText: string | null;
  startOffset: number | null;
  endOffset: number | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Extraction {
  id: string;
  interviewId: string | null;
  contentType: string;
  topics: string[];
  questionAsked: string;
  rawResponse: string;
  keyQuote: string;
  summary: string;
  tweetDraft: string;
  threadOutline: string[];
  linkedinDraft: string;
  suggestedFormats: string[];
  web2Friendly: boolean;
  technicalDepth: number;
  controversyLevel: number;
  storytellingPotential: number;
  status: string;
  createdAt: string;
  clientName: string | null;
  clientTwitterHandle: string | null;
  clientProfilePicture: string | null;
  interviewTitle: string | null;
}

function ClientContentContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") || "all";
  const { data: session } = useSession();

  const [typeFilter, setTypeFilter] = useState(initialType);
  const [interviewFilter, setInterviewFilter] = useState("all");
  const [selectedExtraction, setSelectedExtraction] = useState<Extraction | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeTab, setActiveTab] = useState("twitter");

  // Fetch comments when extraction is selected
  useEffect(() => {
    if (selectedExtraction) {
      fetchComments(selectedExtraction.id);
    } else {
      setComments([]);
    }
  }, [selectedExtraction?.id]);

  const fetchComments = async (extractionId: string) => {
    try {
      const res = await fetch(`/api/extractions/${extractionId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    }
  };

  const { data: allExtractions = [], isLoading } = useQuery<Extraction[]>({
    queryKey: ["client-extractions", typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);

      const res = await fetch(`/api/extractions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch extractions");
      return res.json();
    },
  });

  // Get unique interviews for filtering
  const uniqueInterviews = allExtractions.reduce((acc, ext) => {
    if (ext.interviewId && ext.interviewTitle && !acc.find(i => i.id === ext.interviewId)) {
      acc.push({ id: ext.interviewId, title: ext.interviewTitle });
    }
    return acc;
  }, [] as { id: string; title: string }[]);

  // Filter by interview
  const extractions = interviewFilter === "all"
    ? allExtractions
    : allExtractions.filter(e => e.interviewId === interviewFilter);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getTypeLabel = (type: string) => {
    return (
      CONTENT_TYPES.find((t) => t.value === type)?.label ||
      type.replace("_", " ")
    );
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      origin_story: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      failure_story: "bg-red-500/20 text-red-400 border-red-500/30",
      success_story: "bg-green-500/20 text-green-400 border-green-500/30",
      hot_take: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      contrarian_view: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      prediction: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      technical: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      framework: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
      advice: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    };
    return colors[type] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  const unresolvedComments = comments.filter(c => !c.resolved);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-gray-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-xl">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Your Content</h1>
            <p className="text-gray-400 mt-1">
              Posts created from your interview responses
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {uniqueInterviews.length > 0 && (
          <>
            <span className="text-sm font-medium text-gray-300">Interview:</span>
            <Select value={interviewFilter} onValueChange={setInterviewFilter}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select Interview" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Interviews</SelectItem>
                {uniqueInterviews.map((interview) => (
                  <SelectItem key={interview.id} value={interview.id}>
                    {interview.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <span className="text-sm font-medium text-gray-300">Type:</span>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Content Type" />
          </SelectTrigger>
          <SelectContent>
            {CONTENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-400">
          {extractions.length} {extractions.length === 1 ? 'post' : 'posts'} available
        </span>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-4" />
          <p className="text-gray-400">Loading your content...</p>
        </div>
      ) : extractions.length === 0 ? (
        <Card className="border-dashed border-gray-800 bg-gray-900/50">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No content yet</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Content will appear here after your interviews are processed.
              Complete an interview to see your posts!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {extractions.map((extraction) => (
            <Card
              key={extraction.id}
              className="group cursor-pointer border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:shadow-lg transition-all duration-200 overflow-hidden"
              onClick={() => setSelectedExtraction(extraction)}
            >
              {/* Type Badge Header */}
              <div className="px-5 pt-5 pb-3">
                <Badge className={`${getTypeColor(extraction.contentType)} border font-medium`}>
                  {getTypeLabel(extraction.contentType)}
                </Badge>
              </div>

              {/* Content Preview */}
              <CardContent className="pt-0 pb-5 space-y-4">
                {/* Key Quote */}
                <div className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-red-500">
                  <p className="text-sm text-gray-300 italic line-clamp-3">
                    &ldquo;{extraction.keyQuote}&rdquo;
                  </p>
                </div>

                {/* Tweet Preview */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Tweet Preview
                  </p>
                  <p className="text-sm text-gray-200 line-clamp-3 leading-relaxed">
                    {extraction.tweetDraft}
                  </p>
                </div>

                {/* Meta Info */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                  <div className="flex gap-2">
                    {extraction.suggestedFormats?.includes('tweet') && (
                      <div className="p-1.5 bg-blue-500/20 rounded-md">
                        <Twitter className="h-4 w-4 text-blue-400" />
                      </div>
                    )}
                    {extraction.linkedinDraft && (
                      <div className="p-1.5 bg-blue-500/20 rounded-md">
                        <Linkedin className="h-4 w-4 text-blue-400" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(extraction.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedExtraction}
        onOpenChange={() => setSelectedExtraction(null)}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {selectedExtraction && (
            <>
              {/* Dialog Header */}
              <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                      <Badge className={`${getTypeColor(selectedExtraction.contentType)} border`}>
                        {getTypeLabel(selectedExtraction.contentType)}
                      </Badge>
                      <span className="font-normal text-muted-foreground">Post Preview</span>
                    </DialogTitle>
                    <DialogDescription>
                      Created from your interview on{" "}
                      {new Date(selectedExtraction.createdAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </DialogDescription>
                  </div>
                  {unresolvedComments.length > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {unresolvedComments.length} feedback
                    </Badge>
                  )}
                </div>
              </DialogHeader>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
                <div className="px-6 pt-4 border-b border-border bg-card">
                  <TabsList className="grid w-full max-w-lg grid-cols-4 bg-muted">
                    <TabsTrigger value="twitter" className="flex items-center gap-2 data-[state=active]:bg-card">
                      <Twitter className="h-4 w-4" />
                      Twitter
                    </TabsTrigger>
                    <TabsTrigger value="linkedin" className="flex items-center gap-2 data-[state=active]:bg-card">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="flex items-center gap-2 data-[state=active]:bg-card">
                      <MessageSquare className="h-4 w-4" />
                      Feedback ({comments.filter(c => !c.resolved).length})
                    </TabsTrigger>
                    <TabsTrigger value="details" className="flex items-center gap-2 data-[state=active]:bg-card">
                      <FileText className="h-4 w-4" />
                      Details
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* Twitter Tab */}
                  <TabsContent value="twitter" className="m-0 h-full">
                    <div className="bg-muted/30 p-8 min-h-full">
                      <div className="max-w-xl mx-auto space-y-6">
                        <CommentableTweetMockup
                          extractionId={selectedExtraction.id}
                          clientName={selectedExtraction.clientName || "You"}
                          twitterHandle={selectedExtraction.clientTwitterHandle || undefined}
                          profilePicture={selectedExtraction.clientProfilePicture || undefined}
                          tweetText={selectedExtraction.tweetDraft}
                          onCommentAdded={() => fetchComments(selectedExtraction.id)}
                          userName={session?.user?.name || "Client"}
                          userRole="client"
                        />

                        {/* Actions */}
                        <div className="flex items-center justify-between bg-card rounded-xl p-4 border border-border shadow-sm">
                          <span className="text-sm text-muted-foreground">
                            {selectedExtraction.tweetDraft?.length || 0} characters
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(selectedExtraction.tweetDraft, "tweet")}
                            className="gap-2"
                          >
                            {copiedField === "tweet" ? (
                              <>
                                <Check className="h-4 w-4 text-green-500" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy Tweet
                              </>
                            )}
                          </Button>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                          Click on any text in the tweet to leave feedback
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  {/* LinkedIn Tab */}
                  <TabsContent value="linkedin" className="m-0 h-full">
                    <div className="bg-muted/30 p-8 min-h-full">
                      <div className="max-w-xl mx-auto space-y-6">
                        {selectedExtraction.linkedinDraft ? (
                          <>
                            <LinkedInMockup
                              clientName={selectedExtraction.clientName || "You"}
                              headline="Founder & CEO"
                              profilePicture={selectedExtraction.clientProfilePicture || undefined}
                              postText={selectedExtraction.linkedinDraft}
                            />

                            {/* Actions */}
                            <div className="flex items-center justify-between bg-card rounded-xl p-4 border border-border shadow-sm">
                              <span className="text-sm text-muted-foreground">
                                {selectedExtraction.linkedinDraft?.length || 0} characters
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(selectedExtraction.linkedinDraft, "linkedin")}
                                className="gap-2"
                              >
                                {copiedField === "linkedin" ? (
                                  <>
                                    <Check className="h-4 w-4 text-green-500" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-4 w-4" />
                                    Copy Post
                                  </>
                                )}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <Card className="border-dashed border-border bg-card/50">
                            <CardContent className="py-12 text-center">
                              <Linkedin className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                              <p className="text-muted-foreground">
                                No LinkedIn version available for this content.
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Comments/Feedback Tab */}
                  <TabsContent value="comments" className="m-0 p-6">
                    <CommentList
                      comments={comments}
                      onCommentUpdate={() => fetchComments(selectedExtraction.id)}
                      currentUserId={session?.user?.id || null}
                    />
                  </TabsContent>

                  {/* Details Tab */}
                  <TabsContent value="details" className="m-0 p-6 space-y-6">
                    {/* Key Quote */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-6 border border-blue-500/20">
                      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-400" />
                        Key Quote
                      </h4>
                      <blockquote className="text-lg text-muted-foreground italic leading-relaxed">
                        &ldquo;{selectedExtraction.keyQuote}&rdquo;
                      </blockquote>
                    </div>

                    {/* Summary */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Summary</h4>
                      <p className="text-muted-foreground leading-relaxed bg-muted rounded-lg p-4">
                        {selectedExtraction.summary}
                      </p>
                    </div>

                    {/* Thread Outline */}
                    {selectedExtraction.threadOutline && selectedExtraction.threadOutline.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-foreground">Thread Ideas</h4>
                        <div className="bg-muted rounded-lg p-4 space-y-3">
                          {selectedExtraction.threadOutline.map((point, i) => (
                            <div key={i} className="flex gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium flex items-center justify-center">
                                {i + 1}
                              </span>
                              <p className="text-muted-foreground text-sm leading-relaxed pt-0.5">{point}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Original Response */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">From Your Interview</h4>
                      <div className="bg-muted rounded-lg p-4 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Question</p>
                          <p className="text-foreground text-sm">{selectedExtraction.questionAsked}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Your Response</p>
                          <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                            {selectedExtraction.rawResponse}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Content Ratings */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{selectedExtraction.storytellingPotential}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Story Score</p>
                      </div>
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{selectedExtraction.technicalDepth}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Technical</p>
                      </div>
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{selectedExtraction.controversyLevel}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Hot Take</p>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClientContentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ClientContentContent />
    </Suspense>
  );
}
