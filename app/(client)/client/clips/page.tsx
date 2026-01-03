"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, Play, Calendar, Clock, Loader2, Mic } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AudioPlayer } from "@/components/ui/audio-player";
import { VideoPlayer } from "@/components/ui/video-player";

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
  interviewTitle: string | null;
}

interface AudioRecording {
  id: string;
  audioUrl: string;
  content: string;
  role: "interviewer" | "client";
  createdAt: string;
  interviewId: string | null;
  interviewTitle: string | null;
  fileSizeBytes: number | null;
}

export default function ClipsPage() {
  const [selectedClip, setSelectedClip] = useState<VideoClip | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "audio">("video");

  const { data, isLoading } = useQuery<{ clips: VideoClip[] }>({
    queryKey: ["clips"],
    queryFn: async () => {
      const res = await fetch("/api/clips");
      if (!res.ok) throw new Error("Failed to fetch clips");
      return res.json();
    },
  });

  const { data: audioData, isLoading: audioLoading } = useQuery<{ recordings: AudioRecording[] }>({
    queryKey: ["audio-recordings"],
    queryFn: async () => {
      const res = await fetch("/api/audio-recordings");
      if (!res.ok) throw new Error("Failed to fetch audio recordings");
      return res.json();
    },
  });

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your Media</h1>
        <p className="text-gray-500 mt-1">
          Recordings from your interview sessions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "video" | "audio")}>
        <TabsList>
          <TabsTrigger value="video" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Video Clips
          </TabsTrigger>
          <TabsTrigger value="audio" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Audio Recordings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="video" className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !data?.clips?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Video className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No clips yet</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Video recordings from your interviews will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.clips.map((clip) => (
            <Card
              key={clip.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedClip(clip)}
            >
              <div className="aspect-video bg-gray-900 relative flex items-center justify-center">
                {clip.thumbnailUrl ? (
                  <img
                    src={clip.thumbnailUrl}
                    alt={clip.title || "Video clip"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Video className="h-12 w-12 text-gray-600" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="h-6 w-6 text-gray-900 ml-1" />
                  </div>
                </div>
                {clip.durationSeconds && (
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(clip.durationSeconds)}
                  </div>
                )}
              </div>
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium line-clamp-1">
                  {clip.title ||
                    clip.interviewTitle ||
                    `Clip from ${formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })}`}
                </CardTitle>
                <CardDescription className="text-xs flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(clip.createdAt).toLocaleDateString()}
                  </span>
                  <span>{formatFileSize(clip.fileSizeBytes)}</span>
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audio" className="space-y-6">
          {audioLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !audioData?.recordings?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mic className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No audio recordings yet</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Audio from your interview responses will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Recordings</CardTitle>
                <CardDescription>
                  {audioData.recordings.length} audio recordings from your interviews
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {audioData.recordings.map((recording) => (
                    <div
                      key={recording.id}
                      className="p-4 hover:bg-gray-50 space-y-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 line-clamp-2">
                          {recording.content}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className={`px-1.5 py-0.5 rounded ${
                            recording.role === "client"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {recording.role === "client" ? "Your Response" : "Question"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(recording.createdAt), { addSuffix: true })}
                          </span>
                          {recording.fileSizeBytes && (
                            <span>{formatFileSize(recording.fileSizeBytes)}</span>
                          )}
                        </div>
                      </div>
                      <AudioPlayer src={recording.audioUrl} compact />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Video Player Dialog */}
      <Dialog open={!!selectedClip} onOpenChange={() => setSelectedClip(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedClip?.title ||
                selectedClip?.interviewTitle ||
                "Video Clip"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="aspect-video">
              {selectedClip && (
                <VideoPlayer
                  src={selectedClip.videoUrl}
                  title={selectedClip.title || selectedClip.interviewTitle || "video"}
                  poster={selectedClip.thumbnailUrl || undefined}
                />
              )}
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {selectedClip &&
                  new Date(selectedClip.createdAt).toLocaleString()}
              </span>
              {selectedClip?.durationSeconds && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDuration(selectedClip.durationSeconds)}
                </span>
              )}
              <span>{formatFileSize(selectedClip?.fileSizeBytes || null)}</span>
            </div>
            {selectedClip?.transcript && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Transcript</h4>
                <p className="text-sm text-gray-600">{selectedClip.transcript}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
