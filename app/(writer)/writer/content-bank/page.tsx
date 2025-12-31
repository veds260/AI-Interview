"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Copy, Check, FileText, MessageSquare, Linkedin, BookOpen } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
}

function ContentBankContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") || "all";

  const [typeFilter, setTypeFilter] = useState(initialType);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedExtraction, setSelectedExtraction] =
    useState<Extraction | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: extractions = [], isLoading } = useQuery<Extraction[]>({
    queryKey: ["extractions", typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const res = await fetch(`/api/extractions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch extractions");
      return res.json();
    },
  });

  const markAsUsedMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/extractions/${id}/use`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as used");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extractions"] });
      toast.success("Marked as used");
    },
    onError: () => {
      toast.error("Failed to mark as used");
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

  const getFormatIcon = (format: string) => {
    switch (format) {
      case "tweet":
        return <MessageSquare className="h-3 w-3" />;
      case "thread":
        return <FileText className="h-3 w-3" />;
      case "linkedin":
        return <Linkedin className="h-3 w-3" />;
      case "blog":
        return <BookOpen className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content Bank</h1>
        <p className="text-gray-500 mt-1">
          Browse and use extracted content from interviews
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {extractions.map((extraction) => (
            <Card
              key={extraction.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedExtraction(extraction)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="outline">
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
                  >
                    {extraction.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium line-clamp-2">
                  &quot;{extraction.keyQuote}&quot;
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {extraction.summary}
                </p>

                <div className="flex flex-wrap gap-1">
                  {extraction.suggestedFormats?.slice(0, 3).map((format) => (
                    <Badge
                      key={format}
                      variant="secondary"
                      className="text-xs"
                    >
                      {getFormatIcon(format)}
                      <span className="ml-1 capitalize">{format}</span>
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-2 text-xs text-muted-foreground">
                  {extraction.web2Friendly && (
                    <span className="text-green-600">Web2 Friendly</span>
                  )}
                  <span>Story: {extraction.storytellingPotential}/5</span>
                  <span>Controversy: {extraction.controversyLevel}/5</span>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedExtraction && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="outline">
                    {getTypeLabel(selectedExtraction.contentType)}
                  </Badge>
                  Content Details
                </DialogTitle>
                <DialogDescription>
                  From interview on{" "}
                  {new Date(selectedExtraction.createdAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 pt-4">
                {/* Key Quote */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-sm">Key Quote</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          selectedExtraction.keyQuote,
                          "keyQuote"
                        )
                      }
                    >
                      {copiedField === "keyQuote" ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="bg-gray-50 rounded-lg p-3 text-sm">
                    &quot;{selectedExtraction.keyQuote}&quot;
                  </p>
                </div>

                <Separator />

                {/* Tweet Draft */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Tweet Draft
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          selectedExtraction.tweetDraft,
                          "tweetDraft"
                        )
                      }
                    >
                      {copiedField === "tweetDraft" ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="bg-blue-50 rounded-lg p-3 text-sm">
                    {selectedExtraction.tweetDraft}
                  </p>
                </div>

                {/* Thread Outline */}
                {selectedExtraction.threadOutline &&
                  selectedExtraction.threadOutline.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4" />
                        Thread Outline
                      </h4>
                      <ul className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                        {selectedExtraction.threadOutline.map((point, i) => (
                          <li key={i}>
                            {i + 1}. {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* LinkedIn Draft */}
                {selectedExtraction.linkedinDraft && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Linkedin className="h-4 w-4" />
                        LinkedIn Draft
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            selectedExtraction.linkedinDraft,
                            "linkedinDraft"
                          )
                        }
                      >
                        {copiedField === "linkedinDraft" ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="bg-blue-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {selectedExtraction.linkedinDraft}
                    </p>
                  </div>
                )}

                <Separator />

                {/* Full Response */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Original Question</h4>
                  <p className="bg-gray-50 rounded-lg p-3 text-sm">
                    {selectedExtraction.questionAsked}
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-sm">Full Response</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          selectedExtraction.rawResponse,
                          "rawResponse"
                        )
                      }
                    >
                      {copiedField === "rawResponse" ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {selectedExtraction.rawResponse}
                  </p>
                </div>

                {/* Ratings */}
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Technical:</span>{" "}
                    {selectedExtraction.technicalDepth}/5
                  </div>
                  <div>
                    <span className="text-muted-foreground">Controversy:</span>{" "}
                    {selectedExtraction.controversyLevel}/5
                  </div>
                  <div>
                    <span className="text-muted-foreground">Story:</span>{" "}
                    {selectedExtraction.storytellingPotential}/5
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4">
                  {selectedExtraction.status === "extracted" && (
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ContentBankPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ContentBankContent />
    </Suspense>
  );
}
