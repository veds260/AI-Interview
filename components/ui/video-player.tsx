"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
}

export function VideoPlayer({ src, title, poster }: VideoPlayerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleDownload = async (format: "mp4" | "webm") => {
    setShowDropdown(false);
    setIsDownloading(true);
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "video"}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(src, "_blank");
    } finally {
      setIsDownloading(false);
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
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            disabled={isDownloading}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download
          </Button>

          {showDropdown && (
            <div className="absolute right-0 mt-1 w-40 bg-white border rounded-md shadow-lg z-50">
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                onClick={() => handleDownload("mp4")}
              >
                Download as MP4
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                onClick={() => handleDownload("webm")}
              >
                Download as WebM
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
