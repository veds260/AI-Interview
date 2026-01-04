"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Loader2, Copy, Check, FileText, MessageSquare, Linkedin, BookOpen, Twitter, Sparkles, Pencil, Trash2, Save, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import CommentableTweetMockup from "@/components/content/commentable-tweet-mockup";
import CommentList from "@/components/content/comment-list";
import LinkedInMockup from "@/components/content/linkedin-mockup";
import TweetMockup from "@/components/content/tweet-mockup";
import ImageUpload from "@/components/content/image-upload";

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

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "extracted", label: "Available" },
  { value: "assigned", label: "Assigned" },
  { value: "used", label: "Used" },
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
  interviewTitle: string | null;
}

function AdminContentContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") || "all";
  const { data: session } = useSession();

  const [typeFilter, setTypeFilter] = useState(initialType);
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [selectedExtraction, setSelectedExtraction] =
    useState<Extraction | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeTab, setActiveTab] = useState("mockup");
  const [tweetImage, setTweetImage] = useState<string | null>(null);
  const [linkedinImage, setLinkedinImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTweet, setEditedTweet] = useState("");
  const [editedLinkedin, setEditedLinkedin] = useState("");

  const queryClient = useQueryClient();

  // Fetch comments when extraction is selected and reset images when dialog closes
  useEffect(() => {
    if (selectedExtraction) {
      fetchComments(selectedExtraction.id);
    } else {
      setComments([]);
      setTweetImage(null);
      setLinkedinImage(null);
      setIsEditing(false);
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
    queryKey: ["admin-extractions", typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const res = await fetch(`/api/extractions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch extractions");
      return res.json();
    },
  });

  // Get unique clients for filtering
  const uniqueClients = allExtractions.reduce((acc, ext) => {
    if (ext.clientName && !acc.find(c => c.name === ext.clientName)) {
      acc.push({ name: ext.clientName });
    }
    return acc;
  }, [] as { name: string }[]);

  // Filter by client
  const extractions = clientFilter === "all"
    ? allExtractions
    : allExtractions.filter(e => e.clientName === clientFilter);

  const markAsUsedMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/extractions/${id}/use`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as used");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-extractions"] });
      toast.success("Marked as used");
    },
    onError: () => {
      toast.error("Failed to mark as used");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, tweetDraft, linkedinDraft }: { id: string; tweetDraft: string; linkedinDraft: string }) => {
      const res = await fetch(`/api/extractions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetDraft, linkedinDraft }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-extractions"] });
      toast.success("Content updated");
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Failed to update content");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/extractions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-extractions"] });
      toast.success("Content deleted");
      setSelectedExtraction(null);
    },
    onError: () => {
      toast.error("Failed to delete content");
    },
  });

  const startEditing = () => {
    if (selectedExtraction) {
      setEditedTweet(selectedExtraction.tweetDraft || "");
      setEditedLinkedin(selectedExtraction.linkedinDraft || "");
      setIsEditing(true);
    }
  };

  // Handle image paste in text areas
  const handleImagePaste = (
    e: React.ClipboardEvent,
    setImage: (url: string | null) => void
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            setImage(result);
            toast.success("Image added from clipboard");
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedTweet("");
    setEditedLinkedin("");
  };

  const saveEdits = () => {
    if (selectedExtraction) {
      updateMutation.mutate({
        id: selectedExtraction.id,
        tweetDraft: editedTweet,
        linkedinDraft: editedLinkedin,
      });
    }
  };

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Content Bank</h1>
            <p className="text-gray-500 mt-1">
              Manage all extracted content from client interviews
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {uniqueClients.length > 0 && (
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {uniqueClients.map((client) => (
                <SelectItem key={client.name} value={client.name}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-gray-500 self-center">
          {extractions.length} {extractions.length === 1 ? 'post' : 'posts'}
        </span>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : extractions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No content found. Content will appear here after interviews are
              processed.
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
              <div className="px-5 pt-5 pb-3 flex justify-between items-start">
                <Badge className={`${getTypeColor(extraction.contentType)} border font-medium`}>
                  {getTypeLabel(extraction.contentType)}
                </Badge>
                <Badge
                  variant={
                    extraction.status === "extracted"
                      ? "default"
                      : extraction.status === "used"
                      ? "secondary"
                      : "outline"
                  }
                  className="text-xs"
                >
                  {extraction.status}
                </Badge>
              </div>

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
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {extraction.clientName && (
                      <span className="font-medium text-gray-600">{extraction.clientName}</span>
                    )}
                    <span>{new Date(extraction.createdAt).toLocaleDateString()}</span>
                  </div>
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
                      <span className="font-normal text-gray-600">Content Details</span>
                    </DialogTitle>
                    <DialogDescription>
                      {selectedExtraction.clientName && (
                        <span className="font-medium text-gray-700">{selectedExtraction.clientName} - </span>
                      )}
                      Interview from{" "}
                      {new Date(selectedExtraction.createdAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </DialogDescription>
                  </div>
                  {comments.filter(c => !c.resolved).length > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {comments.filter(c => !c.resolved).length} feedback
                    </Badge>
                  )}
                </div>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
                <div className="px-6 pt-4 border-b bg-white">
                  <TabsList className="grid w-full max-w-xl grid-cols-4 bg-gray-100/80">
                    <TabsTrigger value="mockup" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <Twitter className="h-4 w-4" />
                      Twitter
                    </TabsTrigger>
                    <TabsTrigger value="linkedin" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <MessageSquare className="h-4 w-4" />
                      Comments ({comments.filter(c => !c.resolved).length})
                    </TabsTrigger>
                    <TabsTrigger value="details" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <FileText className="h-4 w-4" />
                      Details
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* Twitter Tab */}
                  <TabsContent value="mockup" className="m-0 h-full">
                    <div className="bg-gradient-to-b from-gray-100 to-gray-50 p-8 min-h-full">
                      <div className="max-w-xl mx-auto space-y-6">
                        {isEditing ? (
                          <div className="bg-white rounded-xl p-6 border shadow-sm space-y-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-2 block">
                                Edit Tweet
                              </label>
                              <Textarea
                                value={editedTweet}
                                onChange={(e) => setEditedTweet(e.target.value)}
                                onPaste={(e) => handleImagePaste(e, setTweetImage)}
                                rows={6}
                                className="resize-none"
                                placeholder="Write your tweet... (paste image with Ctrl+V)"
                              />
                              <p className="text-xs text-gray-500 mt-2">
                                {editedTweet.length} characters · Paste image with Ctrl+V
                              </p>
                            </div>
                            {/* Show pasted image preview */}
                            {tweetImage && (
                              <div className="relative">
                                <img src={tweetImage} alt="Preview" className="w-full h-32 object-cover rounded-lg border" />
                                <button
                                  onClick={() => setTweetImage(null)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <TweetMockup
                            clientName={selectedExtraction.clientName || "Client"}
                            twitterHandle={selectedExtraction.clientTwitterHandle || undefined}
                            tweetText={selectedExtraction.tweetDraft}
                            media={tweetImage ? [{ type: 'image', data: tweetImage }] : undefined}
                          />
                        )}

                        {/* Image Upload */}
                        {!isEditing && (
                          <div className="bg-white rounded-xl p-4 border shadow-sm">
                            <p className="text-sm font-medium text-gray-700 mb-3">Add Image to Tweet</p>
                            <ImageUpload
                              currentImage={tweetImage}
                              onImageChange={setTweetImage}
                            />
                          </div>
                        )}

                        {/* Actions */}
                        {!isEditing && (
                          <div className="flex items-center justify-between bg-white rounded-xl p-4 border shadow-sm">
                            <span className="text-sm text-gray-500">
                              {selectedExtraction.tweetDraft?.length || 0} characters
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(selectedExtraction.tweetDraft, "tweetDraft")}
                              className="gap-2"
                            >
                              {copiedField === "tweetDraft" ? (
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
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* LinkedIn Tab */}
                  <TabsContent value="linkedin" className="m-0 h-full">
                    <div className="bg-gradient-to-b from-blue-50/30 to-gray-50 p-8 min-h-full">
                      <div className="max-w-xl mx-auto space-y-6">
                        {isEditing ? (
                          <div className="bg-white rounded-xl p-6 border shadow-sm space-y-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-2 block">
                                Edit LinkedIn Post
                              </label>
                              <Textarea
                                value={editedLinkedin}
                                onChange={(e) => setEditedLinkedin(e.target.value)}
                                onPaste={(e) => handleImagePaste(e, setLinkedinImage)}
                                rows={10}
                                className="resize-none"
                                placeholder="Write your LinkedIn post... (paste image with Ctrl+V)"
                              />
                              <p className="text-xs text-gray-500 mt-2">
                                {editedLinkedin.length} characters · Paste image with Ctrl+V
                              </p>
                            </div>
                            {/* Show pasted image preview */}
                            {linkedinImage && (
                              <div className="relative">
                                <img src={linkedinImage} alt="Preview" className="w-full h-32 object-cover rounded-lg border" />
                                <button
                                  onClick={() => setLinkedinImage(null)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : selectedExtraction.linkedinDraft ? (
                          <>
                            <LinkedInMockup
                              clientName={selectedExtraction.clientName || "Client"}
                              headline="Founder & CEO"
                              postText={selectedExtraction.linkedinDraft}
                              imageUrl={linkedinImage || undefined}
                            />

                            {/* Image Upload */}
                            <div className="bg-white rounded-xl p-4 border shadow-sm">
                              <p className="text-sm font-medium text-gray-700 mb-3">Add Image to Post</p>
                              <ImageUpload
                                currentImage={linkedinImage}
                                onImageChange={setLinkedinImage}
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between bg-white rounded-xl p-4 border shadow-sm">
                              <span className="text-sm text-gray-500">
                                {selectedExtraction.linkedinDraft?.length || 0} characters
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(selectedExtraction.linkedinDraft, "linkedinDraft")}
                                className="gap-2"
                              >
                                {copiedField === "linkedinDraft" ? (
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

                  {/* Comments Tab */}
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
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-600" />
                          Key Quote
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedExtraction.keyQuote, "keyQuote")}
                        >
                          {copiedField === "keyQuote" ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <blockquote className="text-lg text-gray-700 italic leading-relaxed">
                        &ldquo;{selectedExtraction.keyQuote}&rdquo;
                      </blockquote>
                    </div>

                    {/* Thread Outline */}
                    {selectedExtraction.threadOutline &&
                      selectedExtraction.threadOutline.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Thread Ideas
                          </h4>
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
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">From the Interview</h4>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Question Asked</p>
                          <p className="text-gray-700 text-sm">{selectedExtraction.questionAsked}</p>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Full Response</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(selectedExtraction.rawResponse, "rawResponse")}
                            >
                              {copiedField === "rawResponse" ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
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

                {/* Actions Footer */}
                <div className="flex justify-between p-6 pt-4 border-t bg-gray-50">
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={cancelEditing}
                          className="gap-2"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          onClick={saveEdits}
                          disabled={updateMutation.isPending}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {updateMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={startEditing}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit Content
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this content?")) {
                              deleteMutation.mutate(selectedExtraction.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedExtraction.status === "extracted" && !isEditing && (
                      <Button
                        onClick={() => {
                          markAsUsedMutation.mutate(selectedExtraction.id);
                          setSelectedExtraction(null);
                        }}
                      >
                        Mark as Used
                      </Button>
                    )}
                  </div>
                </div>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminContentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AdminContentContent />
    </Suspense>
  );
}
