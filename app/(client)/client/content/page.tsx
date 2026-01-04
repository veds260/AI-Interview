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
import TweetMockup from "@/components/content/tweet-mockup";
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
}

function ClientContentContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") || "all";
  const { data: session } = useSession();

  const [typeFilter, setTypeFilter] = useState(initialType);
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

  const { data: extractions = [], isLoading } = useQuery<Extraction[]>({
    queryKey: ["client-extractions", typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);

      const res = await fetch(`/api/extractions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch extractions");
      return res.json();
    },
  });

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
      origin_story: "bg-purple-100 text-purple-800 border-purple-200",
      failure_story: "bg-red-100 text-red-800 border-red-200",
      success_story: "bg-green-100 text-green-800 border-green-200",
      hot_take: "bg-orange-100 text-orange-800 border-orange-200",
      contrarian_view: "bg-yellow-100 text-yellow-800 border-yellow-200",
      prediction: "bg-blue-100 text-blue-800 border-blue-200",
      technical: "bg-gray-100 text-gray-800 border-gray-200",
      framework: "bg-indigo-100 text-indigo-800 border-indigo-200",
      advice: "bg-teal-100 text-teal-800 border-teal-200",
    };
    return colors[type] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const unresolvedComments = comments.filter(c => !c.resolved);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Content</h1>
            <p className="text-gray-500 mt-1">
              Posts created from your interview responses
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Filter by type:</span>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
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
        <span className="text-sm text-gray-500">
          {extractions.length} {extractions.length === 1 ? 'post' : 'posts'} available
        </span>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
          <p className="text-gray-500">Loading your content...</p>
        </div>
      ) : extractions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No content yet</h3>
            <p className="text-gray-500 max-w-md mx-auto">
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
              className="group cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all duration-200 overflow-hidden"
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
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <p className="text-sm text-gray-700 italic line-clamp-3">
                    &ldquo;{extraction.keyQuote}&rdquo;
                  </p>
                </div>

                {/* Tweet Preview */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Tweet Preview
                  </p>
                  <p className="text-sm text-gray-900 line-clamp-3 leading-relaxed">
                    {extraction.tweetDraft}
                  </p>
                </div>

                {/* Meta Info */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex gap-2">
                    {extraction.suggestedFormats?.includes('tweet') && (
                      <div className="p-1.5 bg-blue-50 rounded-md">
                        <Twitter className="h-4 w-4 text-blue-500" />
                      </div>
                    )}
                    {extraction.linkedinDraft && (
                      <div className="p-1.5 bg-blue-50 rounded-md">
                        <Linkedin className="h-4 w-4 text-blue-700" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
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
              <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                      <Badge className={`${getTypeColor(selectedExtraction.contentType)} border`}>
                        {getTypeLabel(selectedExtraction.contentType)}
                      </Badge>
                      <span className="font-normal text-gray-600">Post Preview</span>
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
                <div className="px-6 pt-4 border-b bg-white">
                  <TabsList className="grid w-full max-w-md grid-cols-3 bg-gray-100/80">
                    <TabsTrigger value="twitter" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <Twitter className="h-4 w-4" />
                      Twitter
                    </TabsTrigger>
                    <TabsTrigger value="linkedin" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </TabsTrigger>
                    <TabsTrigger value="details" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <FileText className="h-4 w-4" />
                      Details
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* Twitter Tab */}
                  <TabsContent value="twitter" className="m-0 h-full">
                    <div className="bg-gradient-to-b from-gray-100 to-gray-50 p-8 min-h-full">
                      <div className="max-w-xl mx-auto space-y-6">
                        <TweetMockup
                          clientName={selectedExtraction.clientName || "You"}
                          twitterHandle={selectedExtraction.clientTwitterHandle || undefined}
                          tweetText={selectedExtraction.tweetDraft}
                        />

                        {/* Actions */}
                        <div className="flex items-center justify-between bg-white rounded-xl p-4 border shadow-sm">
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">
                              {selectedExtraction.tweetDraft?.length || 0} / 280 characters
                            </span>
                            {selectedExtraction.tweetDraft?.length <= 280 && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Good length
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(selectedExtraction.tweetDraft, "tweet")}
                            className="gap-2"
                          >
                            {copiedField === "tweet" ? (
                              <>
                                <Check className="h-4 w-4 text-green-600" />
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
                      </div>
                    </div>
                  </TabsContent>

                  {/* LinkedIn Tab */}
                  <TabsContent value="linkedin" className="m-0 h-full">
                    <div className="bg-gradient-to-b from-blue-50/30 to-gray-50 p-8 min-h-full">
                      <div className="max-w-xl mx-auto space-y-6">
                        {selectedExtraction.linkedinDraft ? (
                          <>
                            <LinkedInMockup
                              clientName={selectedExtraction.clientName || "You"}
                              headline="Founder & CEO"
                              postText={selectedExtraction.linkedinDraft}
                            />

                            {/* Actions */}
                            <div className="flex items-center justify-between bg-white rounded-xl p-4 border shadow-sm">
                              <span className="text-sm text-gray-500">
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
                                    <Check className="h-4 w-4 text-green-600" />
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
                          <Card className="border-dashed bg-white/50">
                            <CardContent className="py-12 text-center">
                              <Linkedin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                              <p className="text-gray-500">
                                No LinkedIn version available for this content.
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Details Tab */}
                  <TabsContent value="details" className="m-0 p-6 space-y-6">
                    {/* Key Quote */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        Key Quote
                      </h4>
                      <blockquote className="text-lg text-gray-700 italic leading-relaxed">
                        &ldquo;{selectedExtraction.keyQuote}&rdquo;
                      </blockquote>
                    </div>

                    {/* Summary */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Summary</h4>
                      <p className="text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-4">
                        {selectedExtraction.summary}
                      </p>
                    </div>

                    {/* Thread Outline */}
                    {selectedExtraction.threadOutline && selectedExtraction.threadOutline.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900">Thread Ideas</h4>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                          {selectedExtraction.threadOutline.map((point, i) => (
                            <div key={i} className="flex gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-medium flex items-center justify-center">
                                {i + 1}
                              </span>
                              <p className="text-gray-700 text-sm leading-relaxed pt-0.5">{point}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Original Response */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">From Your Interview</h4>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Question</p>
                          <p className="text-gray-700 text-sm">{selectedExtraction.questionAsked}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Your Response</p>
                          <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                            {selectedExtraction.rawResponse}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Content Ratings */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900">{selectedExtraction.storytellingPotential}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Story Score</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900">{selectedExtraction.technicalDepth}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Technical</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900">{selectedExtraction.controversyLevel}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Hot Take</p>
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
