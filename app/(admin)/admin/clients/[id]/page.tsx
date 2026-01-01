"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  FileText,
  MessageSquare,
  Target,
  BookOpen,
  User,
  Upload,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface KnowledgeBase {
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
}

interface Client {
  id: string;
  name: string;
  brandName: string | null;
  twitterHandle: string | null;
  telegramHandle: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  topicsOfExpertise: string[] | null;
  voiceStyle: string | null;
  knowledgeBase: KnowledgeBase | null;
  isActive: boolean;
  createdAt: string;
  competitors: any[];
  interviews: any[];
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const clientId = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [newItem, setNewItem] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogField, setAddDialogField] = useState<string>("");

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}`);
      if (!res.ok) throw new Error("Failed to fetch client");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Client>) => {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update client");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setIsEditing(false);
      toast.success("Client updated successfully");
    },
    onError: () => {
      toast.error("Failed to update client");
    },
  });

  const handleEdit = () => {
    if (client) {
      setFormData({
        name: client.name,
        brandName: client.brandName,
        twitterHandle: client.twitterHandle,
        linkedinUrl: client.linkedinUrl,
        websiteUrl: client.websiteUrl,
        topicsOfExpertise: client.topicsOfExpertise || [],
        voiceStyle: client.voiceStyle,
        knowledgeBase: client.knowledgeBase || {
          bio: "",
          products: [],
          talkingPoints: [],
          pastInterviews: [],
          voiceGuidelines: "",
          notes: "",
        },
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleAddItem = (field: keyof KnowledgeBase) => {
    if (!newItem.trim()) return;

    const currentKb = formData.knowledgeBase || {};
    const currentArray = (currentKb[field] as string[]) || [];

    setFormData({
      ...formData,
      knowledgeBase: {
        ...currentKb,
        [field]: [...currentArray, newItem.trim()],
      },
    });
    setNewItem("");
    setAddDialogOpen(false);
  };

  const handleRemoveItem = (field: keyof KnowledgeBase, index: number) => {
    const currentKb = formData.knowledgeBase || {};
    const currentArray = (currentKb[field] as string[]) || [];

    setFormData({
      ...formData,
      knowledgeBase: {
        ...currentKb,
        [field]: currentArray.filter((_, i) => i !== index),
      },
    });
  };

  const handleAddTopic = () => {
    if (!newItem.trim()) return;
    const topics = formData.topicsOfExpertise || [];
    setFormData({
      ...formData,
      topicsOfExpertise: [...topics, newItem.trim()],
    });
    setNewItem("");
    setAddDialogOpen(false);
  };

  const handleRemoveTopic = (index: number) => {
    const topics = formData.topicsOfExpertise || [];
    setFormData({
      ...formData,
      topicsOfExpertise: topics.filter((_, i) => i !== index),
    });
  };

  const handleTypefullyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data as Record<string, string>[];
          const tweets: KnowledgeBase["typefullyTweets"] = [];

          // Find the correct column names (case-insensitive)
          const firstRow = data[0];
          if (!firstRow) {
            toast.error("CSV file is empty");
            return;
          }

          const columns = Object.keys(firstRow);
          const contentCol = columns.find(c =>
            c.toLowerCase().includes("content") ||
            c.toLowerCase().includes("text") ||
            c.toLowerCase() === "tweet"
          );
          const dateCol = columns.find(c =>
            c.toLowerCase().includes("date") ||
            c.toLowerCase().includes("posted") ||
            c.toLowerCase().includes("created_at")
          );
          const likesCol = columns.find(c => c.toLowerCase().includes("like"));
          const retweetsCol = columns.find(c =>
            c.toLowerCase().includes("retweet") ||
            c.toLowerCase().includes("rt_count")
          );

          for (const row of data) {
            const content = contentCol ? row[contentCol]?.trim() : "";
            if (content) {
              tweets.push({
                content,
                postedAt: dateCol ? row[dateCol] : undefined,
                likes: likesCol ? parseInt(row[likesCol]) || 0 : undefined,
                retweets: retweetsCol ? parseInt(row[retweetsCol]) || 0 : undefined,
              });
            }
          }

          if (tweets.length > 0) {
            setFormData({
              ...formData,
              knowledgeBase: {
                ...(formData.knowledgeBase || {}),
                typefullyTweets: [
                  ...((formData.knowledgeBase as KnowledgeBase)?.typefullyTweets || []),
                  ...tweets,
                ],
              },
            });
            toast.success(`Imported ${tweets.length} tweets from Typefully`);
          } else {
            toast.error("No tweets found in CSV. Make sure it has a content/text column.");
          }
        } catch (err) {
          toast.error("Failed to parse CSV file");
          console.error(err);
        }
      },
      error: (err) => {
        toast.error("Failed to read CSV file");
        console.error(err);
      }
    });
    e.target.value = ""; // Reset input
  };

  const handleClearTypefullyTweets = () => {
    setFormData({
      ...formData,
      knowledgeBase: {
        ...(formData.knowledgeBase || {}),
        typefullyTweets: [],
      },
    });
    toast.success("Cleared all Typefully tweets");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Client not found</h2>
        <Link href="/admin/clients">
          <Button variant="link">Back to clients</Button>
        </Link>
      </div>
    );
  }

  const kb = isEditing ? formData.knowledgeBase || {} : client.knowledgeBase || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/clients">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{client.name}</h1>
            {client.brandName && (
              <p className="text-gray-500">{client.brandName}</p>
            )}
          </div>
          <Badge variant={client.isActive ? "default" : "secondary"}>
            {client.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          ) : (
            <Button onClick={handleEdit}>Edit Profile</Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Interviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{client.interviews?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {client.interviews?.filter((i: any) => i.status === "completed").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Competitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{client.competitors?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {client.topicsOfExpertise?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <BookOpen className="h-4 w-4 mr-2" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="interviews">
            <MessageSquare className="h-4 w-4 mr-2" />
            Interviews
          </TabsTrigger>
          <TabsTrigger value="competitors">
            <Target className="h-4 w-4 mr-2" />
            Competitors
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Client profile and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={formData.name || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Brand Name</Label>
                    <Input
                      value={formData.brandName || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, brandName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Twitter Handle</Label>
                    <Input
                      value={formData.twitterHandle || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, twitterHandle: e.target.value })
                      }
                      placeholder="@username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn URL</Label>
                    <Input
                      value={formData.linkedinUrl || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, linkedinUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Website URL</Label>
                    <Input
                      value={formData.websiteUrl || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, websiteUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label>Topics of Expertise</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAddDialogField("topics");
                          setAddDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(formData.topicsOfExpertise || []).map((topic, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          {topic}
                          <button
                            onClick={() => handleRemoveTopic(idx)}
                            className="ml-1 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Voice Style Notes</Label>
                    <Textarea
                      value={formData.voiceStyle || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, voiceStyle: e.target.value })
                      }
                      rows={8}
                      placeholder="Describe the client's voice, tone, and communication style..."
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-gray-500">Name</Label>
                    <p className="font-medium">{client.name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Brand Name</Label>
                    <p className="font-medium">{client.brandName || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Twitter</Label>
                    <p className="font-medium">
                      {client.twitterHandle ? `@${client.twitterHandle}` : "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">LinkedIn</Label>
                    <p className="font-medium truncate">
                      {client.linkedinUrl || "-"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-gray-500">Website</Label>
                    <p className="font-medium">{client.websiteUrl || "-"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-gray-500">Topics of Expertise</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {client.topicsOfExpertise?.length ? (
                        client.topicsOfExpertise.map((topic, idx) => (
                          <Badge key={idx} variant="secondary">
                            {topic}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-400">No topics set</span>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-gray-500">Voice Style</Label>
                    <p className="font-medium whitespace-pre-wrap">
                      {client.voiceStyle || "-"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bio & Background</CardTitle>
              <CardDescription>
                Background information about the client
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={(formData.knowledgeBase as KnowledgeBase)?.bio || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      knowledgeBase: {
                        ...(formData.knowledgeBase || {}),
                        bio: e.target.value,
                      },
                    })
                  }
                  rows={8}
                  placeholder="Client's bio, background, and story..."
                />
              ) : (
                <p className="whitespace-pre-wrap">
                  {(kb as KnowledgeBase).bio || "No bio added yet"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Products & Services</CardTitle>
                  <CardDescription>
                    What the client offers or is building
                  </CardDescription>
                </div>
                {isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAddDialogField("products");
                      setAddDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {((kb as KnowledgeBase).products?.length || 0) > 0 ? (
                <ul className="space-y-2">
                  {(kb as KnowledgeBase).products?.map((product, idx) => (
                    <li key={idx} className="flex items-center justify-between p-2 border rounded">
                      <span>{product}</span>
                      {isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveItem("products", idx)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">No products added yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Talking Points</CardTitle>
                  <CardDescription>
                    Key points the client wants to emphasize
                  </CardDescription>
                </div>
                {isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAddDialogField("talkingPoints");
                      setAddDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {((kb as KnowledgeBase).talkingPoints?.length || 0) > 0 ? (
                <ul className="space-y-2">
                  {(kb as KnowledgeBase).talkingPoints?.map((point, idx) => (
                    <li key={idx} className="flex items-center justify-between p-2 border rounded">
                      <span>{point}</span>
                      {isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveItem("talkingPoints", idx)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">No talking points added yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Voice Guidelines</CardTitle>
              <CardDescription>
                How the client wants to sound in content
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={(formData.knowledgeBase as KnowledgeBase)?.voiceGuidelines || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      knowledgeBase: {
                        ...(formData.knowledgeBase || {}),
                        voiceGuidelines: e.target.value,
                      },
                    })
                  }
                  rows={8}
                  placeholder="Tone, style preferences, words to use/avoid..."
                />
              ) : (
                <p className="whitespace-pre-wrap">
                  {(kb as KnowledgeBase).voiceGuidelines || "No voice guidelines added yet"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
              <CardDescription>
                Any other relevant information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={(formData.knowledgeBase as KnowledgeBase)?.notes || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      knowledgeBase: {
                        ...(formData.knowledgeBase || {}),
                        notes: e.target.value,
                      },
                    })
                  }
                  rows={8}
                  placeholder="Any other important notes..."
                />
              ) : (
                <p className="whitespace-pre-wrap">
                  {(kb as KnowledgeBase).notes || "No notes added yet"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Twitter className="h-5 w-5" />
                    Typefully Tweets
                  </CardTitle>
                  <CardDescription>
                    Upload CSV export from Typefully to analyze client&apos;s tweet style
                  </CardDescription>
                </div>
                {isEditing && (
                  <div className="flex gap-2">
                    <label htmlFor="typefully-upload">
                      <Button size="sm" variant="outline" asChild>
                        <span className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-1" />
                          Upload CSV
                        </span>
                      </Button>
                    </label>
                    <input
                      id="typefully-upload"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleTypefullyUpload}
                    />
                    {((formData.knowledgeBase as KnowledgeBase)?.typefullyTweets?.length || 0) > 0 && (
                      <Button size="sm" variant="outline" onClick={handleClearTypefullyTweets}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {((kb as KnowledgeBase).typefullyTweets?.length || 0) > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {(kb as KnowledgeBase).typefullyTweets?.map((tweet, idx) => (
                      <div key={idx} className="p-3 border rounded bg-gray-50">
                        <p className="text-sm whitespace-pre-wrap">{tweet.content}</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          {tweet.postedAt && <span>{tweet.postedAt}</span>}
                          {tweet.likes !== undefined && <span>{tweet.likes} likes</span>}
                          {tweet.retweets !== undefined && <span>{tweet.retweets} RTs</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Twitter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No tweets imported yet</p>
                  {isEditing && (
                    <p className="text-sm mt-1">Upload a Typefully CSV export to get started</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interviews Tab */}
        <TabsContent value="interviews" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Interviews</CardTitle>
              <CardDescription>
                All interviews conducted with this client
              </CardDescription>
            </CardHeader>
            <CardContent>
              {client.interviews?.length ? (
                <ScrollArea className="h-80">
                  <div className="space-y-2">
                    {client.interviews.map((interview: any) => (
                      <div
                        key={interview.id}
                        className="flex items-center justify-between p-3 border rounded"
                      >
                        <div>
                          <p className="font-medium">
                            {interview.title || `Interview ${interview.id.slice(0, 8)}`}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(interview.createdAt).toLocaleDateString()} -
                            {interview.questionsCount || 0} questions
                          </p>
                        </div>
                        <Badge
                          className={
                            interview.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }
                        >
                          {interview.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-center py-8 text-gray-400">
                  No interviews yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitors Tab */}
        <TabsContent value="competitors" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tracked Competitors</CardTitle>
                  <CardDescription>
                    Twitter accounts being analyzed for voice/style
                  </CardDescription>
                </div>
                <Link href="/admin/competitors">
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Competitor
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {client.competitors?.length ? (
                <div className="space-y-2">
                  {client.competitors.map((comp: any) => (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <p className="font-medium">@{comp.twitterHandle}</p>
                        {comp.name && (
                          <p className="text-sm text-gray-500">{comp.name}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {comp.topics?.slice(0, 2).map((topic: string) => (
                          <Badge key={topic} variant="outline">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-gray-400">
                  No competitors tracked yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Item Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {addDialogField === "topics" ? "Topic" : addDialogField.replace(/([A-Z])/g, " $1").trim()}
            </DialogTitle>
            <DialogDescription>
              Enter the new item to add
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Enter item..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (addDialogField === "topics") {
                  handleAddTopic();
                } else {
                  handleAddItem(addDialogField as keyof KnowledgeBase);
                }
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (addDialogField === "topics") {
                  handleAddTopic();
                } else {
                  handleAddItem(addDialogField as keyof KnowledgeBase);
                }
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
