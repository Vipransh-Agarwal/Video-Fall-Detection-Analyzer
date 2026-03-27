"use client";

import { VideoUpload } from "@/components/video-upload";
import { VideoPreview } from "@/components/video-preview";
import { AnalyzeButton } from "@/components/analyze-button";
import { AnalysisResultCard } from "@/components/analysis-result";
import { ErrorToast } from "@/components/error-toast";
import { useVideoAnalysis } from "@/hooks/use-video-analysis";
import { ShieldAlert } from "lucide-react";

export default function Home() {
  const {
    status,
    videoFile,
    videoUrl,
    result,
    error,
    handleFileSelect,
    handleDurationLoaded,
    handleAnalyze,
    handleDismissError,
    handleReset,
  } = useVideoAnalysis();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center rounded-2xl bg-primary/10 p-3 mb-4">
            <ShieldAlert className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Fall Detection Analyzer
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-md mx-auto">
            Upload a short video clip and AI will detect whether an accidental
            human fall has occurred.
          </p>
        </div>

        {/* Main content stack */}
        <div className="flex flex-col gap-5">
          {/* Error banner */}
          {error && (
            <ErrorToast message={error} onDismiss={handleDismissError} />
          )}

          {/* Upload zone */}
          <VideoUpload
            videoFile={videoFile}
            status={status}
            onFileSelect={handleFileSelect}
            onDurationLoaded={handleDurationLoaded}
            onReset={handleReset}
          />

          {/* Video preview — shown only when file loaded */}
          {videoUrl && videoFile && (
            <VideoPreview src={videoUrl} fileName={videoFile.name} />
          )}

          {/* Analyze button */}
          <div className="flex justify-center">
            <AnalyzeButton
              status={status}
              hasVideo={!!videoFile}
              onClick={handleAnalyze}
            />
          </div>

          {/* Results — shown only after successful analysis */}
          {status === "success" && result && (
            <AnalysisResultCard result={result} />
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-muted-foreground">
          <p>
            Videos are sent to Google Gemini API for analysis and are not stored
            permanently.{" "}
            <span className="opacity-60">Powered by gemini-2.5-flash</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
