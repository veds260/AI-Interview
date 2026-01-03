"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  videoKey?: string; // R2 storage key for download
}

export function VideoPlayer({ src, title, poster, videoKey }: VideoPlayerProps) {
  const handleDownload = () => {
    if (videoKey) {
      // Use download API with the original R2 key
      const downloadUrl = `/api/download?key=${encodeURIComponent(videoKey)}&filename=${encodeURIComponent(title || "video")}&type=video`;
      window.open(downloadUrl, "_blank");
    } else {
      // Fallback: open presigned URL directly
      window.open(src, "_blank");
    }
  };

  return (
    <div className="relative w-full" style={{ maxHeight: "70vh" }}>
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          src={src}
          poster={poster}
          controls
          className="w-full max-h-[60vh] object-contain"
          playsInline
        />
      </div>

      {/* Download button below video */}
      <div className="flex justify-end mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4 mr-2" />
          Download Video
        </Button>
      </div>
    </div>
  );
}
