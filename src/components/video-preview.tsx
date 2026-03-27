"use client";

interface VideoPreviewProps {
  src: string;
  fileName: string;
}

export function VideoPreview({ src, fileName }: VideoPreviewProps) {
  return (
    <div className="w-full rounded-xl overflow-hidden border border-border bg-black">
      <video
        key={src}
        src={src}
        controls
        playsInline
        className="w-full max-h-[360px] object-contain"
        aria-label={`Preview of ${fileName}`}
      />
    </div>
  );
}
