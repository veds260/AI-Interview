"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Target, Twitter, Trash2, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
  brandName: string | null;
}

interface Competitor {
  id: string;
  clientId: string;
  twitterHandle: string;
  name: string | null;
  topics: string[] | null;
  avgEngagement: string | null;
  lastScrapedAt: string | null;
  createdAt: string;
  client: Client | null;
}

export default function CompetitorsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientId: "",
    twitterHandle: "",
    name: "",
    topics: "",
  });

  const { data: competitors = [], isLoading } = useQuery<Competitor[]>({
    queryKey: ["competitors"],
    queryFn: async () => {
      const res = await fetch("/api/competitors");
      if (!res.ok) throw new Error("Failed to fetch competitors");
      return res.json();
    },
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          topics: data.topics
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create competitor");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      setIsOpen(false);
      setFormData({
        clientId: "",
        twitterHandle: "",
        name: "",
        topics: "",
      });
      toast.success("Competitor added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/competitors/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete competitor");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      toast.success("Competitor deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [scrapingAll, setScrapingAll] = useState(false);

  const scrapeAllMutation = useMutation({
    mutationFn: async () => {
      setScrapingAll(true);
      const unscrapedCompetitors = competitors.filter(c => !c.lastScrapedAt || c.topics?.length === 0);
      if (unscrapedCompetitors.length === 0) {
        throw new Error("All competitors have already been scraped");
      }

      let success = 0;
      let failed = 0;

      for (const comp of unscrapedCompetitors) {
        try {
          const res = await fetch("/api/competitors/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ competitorId: comp.id }),
          });
          if (res.ok) {
            success++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      return { success, failed, total: unscrapedCompetitors.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      toast.success(`Scraped ${data.success}/${data.total} competitors${data.failed > 0 ? ` (${data.failed} failed)` : ""}`);
      setScrapingAll(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setScrapingAll(false);
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: async (competitorId: string) => {
      setScrapingId(competitorId);
      const res = await fetch("/api/competitors/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to scrape competitor");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      toast.success(`Scraped ${data.tweetCount} tweets, found ${data.topics.length} topics`);
      setScrapingId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setScrapingId(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || !formData.twitterHandle) {
      toast.error("Client and Twitter handle are required");
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Competitors</h1>
          <p className="text-gray-500 mt-1">
            Track competitor Twitter accounts for voice and style analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => scrapeAllMutation.mutate()}
            disabled={scrapingAll || competitors.length === 0}
          >
            {scrapingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scraping...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Scrape All
              </>
            )}
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Competitor
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Competitor</DialogTitle>
              <DialogDescription>
                Add a Twitter account to track for voice/style analysis
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client *</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, clientId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} {client.brandName && `(${client.brandName})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterHandle">Twitter Handle *</Label>
                <Input
                  id="twitterHandle"
                  placeholder="@username"
                  value={formData.twitterHandle}
                  onChange={(e) =>
                    setFormData({ ...formData, twitterHandle: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  placeholder="Competitor name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="topics">Topics</Label>
                <Input
                  id="topics"
                  placeholder="crypto, fintech, leadership (comma-separated)"
                  value={formData.topics}
                  onChange={(e) =>
                    setFormData({ ...formData, topics: e.target.value })
                  }
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Competitor"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Competitors</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competitors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients Tracked</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(competitors.map((c) => c.clientId)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recently Scraped</CardTitle>
            <Twitter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {competitors.filter((c) => c.lastScrapedAt).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Competitors</CardTitle>
          <CardDescription>
            {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} being tracked
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : competitors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No competitors yet</p>
              <p className="text-sm">Add competitor accounts to analyze their content style</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Twitter Handle</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead>Last Scraped</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((competitor) => (
                  <TableRow key={competitor.id}>
                    <TableCell className="font-medium">
                      <a
                        href={`https://twitter.com/${competitor.twitterHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <Twitter className="h-4 w-4" />
                        @{competitor.twitterHandle}
                      </a>
                    </TableCell>
                    <TableCell>{competitor.name || "-"}</TableCell>
                    <TableCell>
                      {competitor.client?.name || "Unknown"}
                      {competitor.client?.brandName && (
                        <span className="text-gray-500 text-sm ml-1">
                          ({competitor.client.brandName})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {competitor.topics?.slice(0, 3).map((topic) => (
                          <Badge key={topic} variant="secondary">
                            {topic}
                          </Badge>
                        ))}
                        {(competitor.topics?.length || 0) > 3 && (
                          <Badge variant="outline">
                            +{(competitor.topics?.length || 0) - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {competitor.lastScrapedAt
                        ? new Date(competitor.lastScrapedAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => scrapeMutation.mutate(competitor.id)}
                          disabled={scrapingId === competitor.id}
                          title="Scrape Twitter data"
                        >
                          {scrapingId === competitor.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(competitor.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
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
    </div>
  );
}
