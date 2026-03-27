export interface AnalysisResult {
  fallDetected: boolean;
  confidence: number;
  explanation: string;
}

export interface ApiSuccessResponse {
  success: true;
  data: AnalysisResult;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

export interface VideoValidation {
  valid: boolean;
  error?: string;
}

export type AnalysisStatus =
  | "idle"
  | "uploading"
  | "analyzing"
  | "success"
  | "error";

export type ErrorCode =
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "VIDEO_TOO_LONG"
  | "NO_FILE_PROVIDED"
  | "AI_PROCESSING_FAILED"
  | "API_KEY_MISSING"
  | "INTERNAL_ERROR";
