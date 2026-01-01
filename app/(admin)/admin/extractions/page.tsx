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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Edit,
  Copy,
  Twitter,
  Linkedin,
  Save,
  FileText,
  Eye,
  Search,
  X,
} from "lucide-react";
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

interface Extraction {
  id: string;
  interviewId: string;
  clientId: string | null;
  contentType: string;
  topics: string[] | null;
  questionAsked: string | null;
  rawResponse: string;
  keyQuote: string | null;
  summary: string | null;
  tweetDraft: string | null;
  linkedinDraft: string | null;
  threadOutline: any[];
  suggestedFormats: string[];
  status: string;
  web2Friendly: boolean;
  technicalDepth: number | null;
  controversyLevel: number | null;
  storytellingPotential: number | null;
  createdAt: string;
  clientName: string | null;
  interviewTitle: string | null;
}

interface Client {
  id: string;
  name: string;
}

interface Interview {
  id: string;
  title: string | null;
  clientId: string | null;
}

export default function AdminExtractionsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [interviewFilter, setInterviewFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExtraction, setSelectedExtraction] = useState<Extraction | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    tweetDraft: "",
    linkedinDraft: "",
  });

  // Fetch clients for filter dropdown
  const { data: clientsData } = useQuery<Client[]>({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      return data.clients || data;
    },
  });

  // Fetch interviews for filter dropdown
  const { data: interviewsData } = useQuery<Interview[]>({
    queryKey: ["interviews-list", clientFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clientFilter !== "all") params.append("clientId", clientFilter);
      const res = await fetch(`/api/interviews?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch interviews");
      const data = await res.json();
      return data.interviews || data;
    },
  });

  const { data: extractions = [], isLoading } = useQuery<Extraction[]>({
    queryKey: ["admin-extractions", typeFilter, clientFilter, interviewFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (clientFilter !== "all") params.append("clientId", clientFilter);
      if (interviewFilter !== "all") params.append("interviewId", interviewFilter);

      const res = await fetch(`/api/extractions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch extractions");
      return res.json();
    },
  });

  // Filter by search query locally
  const filteredExtractions = useMemo(() => {
    if (!searchQuery.trim()) return extractions;
    const query = searchQuery.toLowerCase();
    return extractions.filter(
      (e) =>
        e.keyQuote?.toLowerCase().includes(query) ||
        e.summary?.toLowerCase().includes(query) ||
        e.questionAsked?.toLowerCase().includes(query) ||
        e.clientName?.toLowerCase().includes(query) ||
        e.interviewTitle?.toLowerCase().includes(query)
    );
  }, [extractions, searchQuery]);

  const clearFilters = () => {
    setTypeFilter("all");
    setClientFilter("all");
    setInterviewFilter("all");
    setSearchQuery("");
  };

  const hasActiveFilters = typeFilter !== "all" || clientFilter !== "all" || interviewFilter !== "all" || searchQuery;

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/extractions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update extraction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-extractions"] });
      setEditDialogOpen(false);
      toast.success("Drafts updated successfully");
    },
    onError: () => {
      toast.error("Failed to update drafts");
    },
  });

  const getTypeLabel = (type: string) => {
    return (
      CONTENT_TYPES.find((t) => t.value === type)?.label ||
      type.replace("_", " ")
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleEdit = (extraction: Extraction) => {
    setSelectedExtraction(extraction);
    setEditData({
      tweetDraft: extraction.tweetDraft || "",
      linkedinDraft: extraction.linkedinDraft || "",
    });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (selectedExtraction) {
      updateMutation.mutate({
        id: selectedExtraction.id,
        data: editData,
      });
    }
  };

  // Stats (use filtered extractions)
  const extractedCount = filteredExtractions.filter((e) => e.status === "extracted").length;
  const usedCount = filteredExtractions.filter((e) => e.status === "used").length;
  const withTweet = filteredExtractions.filter((e) => e.tweetDraft).length;
  const withLinkedin = filteredExtractions.filter((e) => e.linkedinDraft).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content Extractions</h1>
        <p className="text-gray-500 mt-1">
          View and edit extracted content drafts from interviews
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Extractions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredExtractions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              With Tweet Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{withTweet}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              With LinkedIn Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{withLinkedin}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{usedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search quotes, summaries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={clientFilter} onValueChange={(val) => {
          setClientFilter(val);
          setInterviewFilter("all"); // Reset interview when client changes
        }}>
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

        <Select value={interviewFilter} onValueChange={setInterviewFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Interviews" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Interviews</SelectItem>
            {interviewsData?.map((interview) => (
              <SelectItem key={interview.id} value={interview.id}>
                {interview.title || `Interview ${interview.id.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Extractions</CardTitle>
          <CardDescription>
            {filteredExtractions.length} extraction{filteredExtractions.length !== 1 ? "s" : ""}
            {hasActiveFilters && ` (filtered from ${extractions.length} total)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredExtractions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {hasActiveFilters
                ? "No extractions match your filters."
                : "No extractions yet. Process completed interviews to extract content."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Interview</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[25%]">Key Quote</TableHead>
                  <TableHead>Drafts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExtractions.map((extraction) => (
                  <TableRow key={extraction.id}>
                    <TableCell>
                      <span className="font-medium text-sm">
                        {extraction.clientName || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 truncate max-w-[150px] block">
                        {extraction.interviewTitle || `#${extraction.interviewId?.slice(0, 6)}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTypeLabel(extraction.contentType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <p className="line-clamp-2 text-sm">
                        &quot;{extraction.keyQuote}&quot;
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {extraction.tweetDraft && (
                          <Badge variant="outline" className="text-blue-500">
                            <Twitter className="h-3 w-3 mr-1" />
                            Tweet
                          </Badge>
                        )}
                        {extraction.linkedinDraft && (
                          <Badge variant="outline" className="text-blue-800">
                            <Linkedin className="h-3 w-3 mr-1" />
                            LinkedIn
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={extraction.status === "used" ? "secondary" : "default"}
                      >
                        {extraction.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(extraction.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedExtraction(extraction);
                            setViewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(extraction)}
                        >
                          <Edit className="h-4 w-4" />
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

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedExtraction && getTypeLabel(selectedExtraction.contentType)}
            </DialogTitle>
            <DialogDescription>
              View extraction details and content drafts
            </DialogDescription>
          </DialogHeader>

          {selectedExtraction && (
            <Tabs defaultValue="content" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="tweet">
                  <Twitter className="h-4 w-4 mr-1" />
                  Tweet
                </TabsTrigger>
                <TabsTrigger value="linkedin">
                  <Linkedin className="h-4 w-4 mr-1" />
                  LinkedIn
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <div>
                  <Label className="text-gray-500">Question Asked</Label>
                  <p className="mt-1">{selectedExtraction.questionAsked || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Key Quote</Label>
                  <p className="mt-1 font-medium">
                    &quot;{selectedExtraction.keyQuote}&quot;
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Summary</Label>
                  <p className="mt-1">{selectedExtraction.summary || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Full Response</Label>
                  <ScrollArea className="h-40 border rounded p-2 mt-1">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedExtraction.rawResponse}
                    </p>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="tweet">
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(selectedExtraction.tweetDraft || "")
                      }
                      disabled={!selectedExtraction.tweetDraft}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="border rounded-lg p-4 min-h-32">
                    {selectedExtraction.tweetDraft ? (
                      <p className="whitespace-pre-wrap">
                        {selectedExtraction.tweetDraft}
                      </p>
                    ) : (
                      <p className="text-gray-400 text-center py-8">
                        No tweet draft generated
                      </p>
                    )}
                  </div>
                  {selectedExtraction.tweetDraft && (
                    <p className="text-sm text-gray-500 text-right">
                      {selectedExtraction.tweetDraft.length} / 280 characters
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="linkedin">
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(selectedExtraction.linkedinDraft || "")
                      }
                      disabled={!selectedExtraction.linkedinDraft}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="border rounded-lg p-4 min-h-32">
                      {selectedExtraction.linkedinDraft ? (
                        <p className="whitespace-pre-wrap">
                          {selectedExtraction.linkedinDraft}
                        </p>
                      ) : (
                        <p className="text-gray-400 text-center py-8">
                          No LinkedIn draft generated
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setViewDialogOpen(false);
              if (selectedExtraction) handleEdit(selectedExtraction);
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Drafts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Content Drafts</DialogTitle>
            <DialogDescription>
              Edit tweet and LinkedIn post drafts for this extraction
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="tweet" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tweet">
                <Twitter className="h-4 w-4 mr-1" />
                Tweet
              </TabsTrigger>
              <TabsTrigger value="linkedin">
                <Linkedin className="h-4 w-4 mr-1" />
                LinkedIn
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tweet" className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Tweet Draft</Label>
                  <span className={`text-sm ${editData.tweetDraft.length > 280 ? "text-red-500" : "text-gray-500"}`}>
                    {editData.tweetDraft.length} / 280
                  </span>
                </div>
                <Textarea
                  value={editData.tweetDraft}
                  onChange={(e) =>
                    setEditData({ ...editData, tweetDraft: e.target.value })
                  }
                  placeholder="Write your tweet draft..."
                  rows={6}
                />
              </div>
            </TabsContent>

            <TabsContent value="linkedin" className="space-y-4">
              <div>
                <Label className="mb-2 block">LinkedIn Post Draft</Label>
                <Textarea
                  value={editData.linkedinDraft}
                  onChange={(e) =>
                    setEditData({ ...editData, linkedinDraft: e.target.value })
                  }
                  placeholder="Write your LinkedIn post draft..."
                  rows={10}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
