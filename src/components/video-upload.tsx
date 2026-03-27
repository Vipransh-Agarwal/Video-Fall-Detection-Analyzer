"use client";

import { useRef, useState, useCallback } from "react";
import { UploadCloud, FileVideo, X } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import { ALLOWED_EXTENSIONS, MAX_DURATION_SECONDS } from "@/lib/validators";
import type { AnalysisStatus } from "@/lib/types";

interface VideoUploadProps {
  videoFile: File | null;
  status: AnalysisStatus;
  onFileSelect: (file: File) => void;
  onDurationLoaded: (seconds: number) => void;
  onReset: () => void;
}

export function VideoUpload({
  videoFile,
  status,
  onFileSelect,
  onDurationLoaded,
  onReset,
}: VideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDisabled = status === "analyzing";

  const handleFileFromInput = useCallback(
    (file: File) => {
      // Check duration via a temporary video element
      const url = URL.createObjectURL(file);
      const videoEl = document.createElement("video");
      videoEl.preload = "metadata";
      videoEl.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        onDurationLoaded(videoEl.duration);
        onFileSelect(file);
      };
      videoEl.onerror = () => {
        URL.revokeObjectURL(url);
        onFileSelect(file); // let validator handle it
      };
      videoEl.src = url;
    },
    [onFileSelect, onDurationLoaded]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileFromInput(file);
      // Reset input value so same file can be re-selected
      e.target.value = "";
    },
    [handleFileFromInput]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (isDisabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileFromInput(file);
    },
    [handleFileFromInput, isDisabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!isDisabled) setIsDragging(true);
    },
    [isDisabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!isDisabled) inputRef.current?.click();
  }, [isDisabled]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onReset();
    },
    [onReset]
  );

  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label="Upload video file"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      className={cn(
        "relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none",
        "min-h-[180px] px-6 py-8 text-center",
        isDragging && "border-primary bg-primary/5 scale-[1.01]",
        !isDragging && !videoFile && "border-border hover:border-primary/60 hover:bg-muted/50",
        !isDragging && videoFile && "border-primary/40 bg-muted/30",
        isDisabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(",")}
        className="sr-only"
        onChange={handleInputChange}
        disabled={isDisabled}
        aria-hidden="true"
      />

      {videoFile ? (
        <div className="flex flex-col items-center gap-2">
          <FileVideo className="w-10 h-10 text-primary" />
          <p className="font-medium text-foreground text-sm leading-snug max-w-xs truncate">
            {videoFile.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(videoFile.size)}
          </p>
          <button
            type="button"
            onClick={handleRemove}
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-3 h-3" />
            Remove
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "rounded-full p-3 transition-colors",
            isDragging ? "bg-primary/10" : "bg-muted"
          )}>
            <UploadCloud className={cn(
              "w-8 h-8 transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isDragging ? "Drop your video here" : "Drag & drop a video, or click to browse"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              MP4, MOV, AVI, WebM · Max 100 MB · Max {MAX_DURATION_SECONDS}s
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
