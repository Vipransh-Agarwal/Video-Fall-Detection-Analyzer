"use client";

import { Loader2, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisStatus } from "@/lib/types";

interface AnalyzeButtonProps {
  status: AnalysisStatus;
  hasVideo: boolean;
  onClick: () => void;
}

export function AnalyzeButton({ status, hasVideo, onClick }: AnalyzeButtonProps) {
  const isLoading = status === "analyzing";
  const isDisabled = !hasVideo || isLoading;

  return (
    <Button
      size="lg"
      className="w-full sm:w-auto min-w-[180px]"
      disabled={isDisabled}
      onClick={onClick}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Analyzing...
        </>
      ) : (
        <>
          <Scan className="w-4 h-4" />
          Analyze Video
        </>
      )}
    </Button>
  );
}
