"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  Play,
  Trash2,
  HardDrive,
  Calendar,
  User,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
}

interface VideoClip {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  title: string | null;
  description: string | null;
  transcript: string | null;
  createdAt: string;
  interviewId: string | null;
  clientId: string | null;
  interviewTitle: string | null;
  clientName: string | null;
}

interface StorageStats {
  totalClips: number;
  totalBytes: number;
  totalMB: number;
  totalGB: number;
  freeLimitGB: number;
  usagePercent: number;
  remainingGB: number;
}

export default function AdminClipsPage() {
  const queryClient = useQueryClient();
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [previewClip, setPreviewClip] = useState<VideoClip | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [clipToDelete, setClipToDelete] = useState<VideoClip | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [clientFilter, setClientFilter] = useState<string>("all");

  // Fetch clients for filter dropdown
  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: clipsData, isLoading: clipsLoading } = useQuery<{ clips: VideoClip[] }>({
    queryKey: ["admin-clips"],
    queryFn: async () => {
      const res = await fetch("/api/clips?limit=200");
      if (!res.ok) throw new Error("Failed to fetch clips");
      return res.json();
    },
  });

  // Filter clips by client
  const filteredClips = clipsData?.clips?.filter((clip) => {
    if (clientFilter === "all") return true;
    if (clientFilter === "unassigned") return !clip.clientId;
    return clip.clientId === clientFilter;
  }) || [];

  const { data: stats, isLoading: statsLoading } = useQuery<StorageStats>({
    queryKey: ["storage-stats"],
    queryFn: async () => {
      const res = await fetch("/api/clips/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (clipId: string) => {
      const res = await fetch(`/api/clips/${clipId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete clip");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clips"] });
      queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
      toast.success("Clip deleted");
    },
    onError: () => {
      toast.error("Failed to delete clip");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (clipIds: string[]) => {
      const results = await Promise.all(
        clipIds.map((id) =>
          fetch(`/api/clips/${id}`, { method: "DELETE" }).then((r) => r.ok)
        )
      );
      const successCount = results.filter(Boolean).length;
      return { successCount, total: clipIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-clips"] });
      queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
      setSelectedClips(new Set());
      toast.success(`Deleted ${data.successCount} of ${data.total} clips`);
    },
    onError: () => {
      toast.error("Failed to delete some clips");
    },
  });

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toggleSelectAll = () => {
    if (selectedClips.size === filteredClips.length) {
      setSelectedClips(new Set());
    } else {
      setSelectedClips(new Set(filteredClips.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedClips);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedClips(newSelected);
  };

  const handleDelete = (clip: VideoClip) => {
    setClipToDelete(clip);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (clipToDelete) {
      deleteMutation.mutate(clipToDelete.id);
      setShowDeleteDialog(false);
      setClipToDelete(null);
    }
  };

  const handleBulkDelete = () => {
    if (selectedClips.size > 0) {
      setShowBulkDeleteDialog(true);
    }
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedClips));
    setShowBulkDeleteDialog(false);
  };

  const isLoading = clipsLoading || statsLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Video Clips</h1>
          <p className="text-gray-500 mt-1">
            Manage recorded interview clips and storage
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Filter by client:</span>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clips</SelectItem>
              <SelectItem value="unassigned">Unassigned (No Client)</SelectItem>
              {clientsList?.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clientFilter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClientFilter("all")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Storage Usage Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Storage Usage
          </CardTitle>
          <CardDescription>Cloudflare R2 Free Tier (10 GB)</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : stats ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats.totalGB.toFixed(2)} GB used</span>
                <span>{stats.remainingGB.toFixed(2)} GB remaining</span>
              </div>
              <Progress
                value={stats.usagePercent}
                className={stats.usagePercent > 80 ? "bg-red-100" : ""}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{stats.totalClips} clips</span>
                <span>{stats.usagePercent.toFixed(1)}% of free tier</span>
              </div>
              {stats.usagePercent > 80 && (
                <div className="flex items-center gap-2 text-amber-600 text-sm mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Storage almost full. Consider deleting old clips.</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Storage not configured</p>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedClips.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
          <span className="text-sm font-medium">
            {selectedClips.size} clip{selectedClips.size > 1 ? "s" : ""} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
          >
            {bulkDeleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete Selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedClips(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Clips List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : !filteredClips.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium">
              {clientFilter !== "all" ? "No clips for this client" : "No clips yet"}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {clientFilter !== "all"
                ? "Try selecting a different client or clearing the filter"
                : "Video recordings from interviews will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {clientFilter !== "all" ? "Filtered" : "All"} Clips ({filteredClips.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedClips.size === filteredClips.length && filteredClips.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-gray-500">Select all</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredClips.map((clip) => (
                <div
                  key={clip.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedClips.has(clip.id)}
                    onCheckedChange={() => toggleSelect(clip.id)}
                  />

                  <div
                    className="w-24 h-16 bg-gray-900 rounded flex items-center justify-center cursor-pointer relative group"
                    onClick={() => setPreviewClip(clip)}
                  >
                    <Video className="h-6 w-6 text-gray-600" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                      <Play className="h-6 w-6 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {clip.title || clip.interviewTitle || `Clip ${clip.id.slice(0, 8)}`}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      {clip.clientName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {clip.clientName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })}
                      </span>
                      <span>{formatFileSize(clip.fileSizeBytes)}</span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(clip)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewClip} onOpenChange={() => setPreviewClip(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {previewClip?.title || previewClip?.interviewTitle || "Video Clip"}
            </DialogTitle>
            <DialogDescription>
              {previewClip?.clientName && `Client: ${previewClip.clientName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            {previewClip && (
              <video
                src={previewClip.videoUrl}
                controls
                autoPlay
                className="w-full h-full"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewClip(null)}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (previewClip) {
                  handleDelete(previewClip);
                  setPreviewClip(null);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Clip?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this clip from storage. This action cannot be undone.
              {clipToDelete?.fileSizeBytes && (
                <span className="block mt-2 font-medium">
                  This will free up {formatFileSize(clipToDelete.fileSizeBytes)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedClips.size} Clips?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedClips.size} clip{selectedClips.size > 1 ? "s" : ""} from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
