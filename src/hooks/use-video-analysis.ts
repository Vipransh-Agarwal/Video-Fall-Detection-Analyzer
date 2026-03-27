"use client";

import { useCallback, useReducer } from "react";
import type { AnalysisResult, AnalysisStatus } from "@/lib/types";
import { validateFile, validateDuration, MAX_DURATION_SECONDS } from "@/lib/validators";

interface State {
  status: AnalysisStatus;
  videoFile: File | null;
  videoUrl: string | null;
  result: AnalysisResult | null;
  error: string | null;
}

type Action =
  | { type: "FILE_SELECTED"; file: File; url: string }
  | { type: "VALIDATION_ERROR"; error: string }
  | { type: "ANALYSIS_START" }
  | { type: "ANALYSIS_SUCCESS"; result: AnalysisResult }
  | { type: "ANALYSIS_ERROR"; error: string }
  | { type: "DISMISS_ERROR" }
  | { type: "RESET" };

const initialState: State = {
  status: "idle",
  videoFile: null,
  videoUrl: null,
  result: null,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FILE_SELECTED":
      // Revoke previous Object URL to prevent memory leaks
      if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
      return {
        status: "idle",
        videoFile: action.file,
        videoUrl: action.url,
        result: null,
        error: null,
      };
    case "VALIDATION_ERROR":
      if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
      return {
        ...initialState,
        status: "error",
        error: action.error,
      };
    case "ANALYSIS_START":
      return { ...state, status: "analyzing", result: null, error: null };
    case "ANALYSIS_SUCCESS":
      return { ...state, status: "success", result: action.result };
    case "ANALYSIS_ERROR":
      return { ...state, status: "error", error: action.error };
    case "DISMISS_ERROR":
      return { ...state, error: null, status: state.videoFile ? "idle" : "idle" };
    case "RESET":
      if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
      return { ...initialState };
    default:
      return state;
  }
}

export interface VideoAnalysisHook {
  status: AnalysisStatus;
  videoFile: File | null;
  videoUrl: string | null;
  result: AnalysisResult | null;
  error: string | null;
  handleFileSelect: (file: File) => void;
  handleDurationLoaded: (durationSeconds: number) => void;
  handleAnalyze: () => Promise<void>;
  handleDismissError: () => void;
  handleReset: () => void;
}

export function useVideoAnalysis(): VideoAnalysisHook {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      dispatch({ type: "VALIDATION_ERROR", error: validation.error ?? "Invalid file." });
      return;
    }
    const url = URL.createObjectURL(file);
    dispatch({ type: "FILE_SELECTED", file, url });
  }, []);

  const handleDurationLoaded = useCallback((durationSeconds: number) => {
    const validation = validateDuration(durationSeconds);
    if (!validation.valid) {
      dispatch({ type: "VALIDATION_ERROR", error: validation.error ?? `Video must be under ${MAX_DURATION_SECONDS} seconds.` });
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!state.videoFile) return;

    dispatch({ type: "ANALYSIS_START" });

    const formData = new FormData();
    formData.append("video", state.videoFile);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const json: unknown = await response.json();

      if (
        !json ||
        typeof json !== "object" ||
        !("success" in json)
      ) {
        throw new Error("Unexpected response format from server.");
      }

      const data = json as { success: boolean; data?: AnalysisResult; error?: { message: string } };

      if (!data.success || !data.data) {
        const message = data.error?.message ?? "Analysis failed. Please try again.";
        dispatch({ type: "ANALYSIS_ERROR", error: message });
        return;
      }

      dispatch({ type: "ANALYSIS_SUCCESS", result: data.data });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Network error. Please check your connection.";
      dispatch({ type: "ANALYSIS_ERROR", error: message });
    }
  }, [state.videoFile]);

  const handleDismissError = useCallback(() => {
    dispatch({ type: "DISMISS_ERROR" });
  }, []);

  const handleReset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    ...state,
    handleFileSelect,
    handleDurationLoaded,
    handleAnalyze,
    handleDismissError,
    handleReset,
  };
}
