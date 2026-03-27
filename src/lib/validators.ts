import type { VideoValidation } from "./types";

export const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
] as const;

export const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".webm"] as const;

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_DURATION_SECONDS = 30;

export function validateFileType(file: File): VideoValidation {
  const isAllowedMime = (ALLOWED_MIME_TYPES as readonly string[]).includes(
    file.type
  );

  // Also check by extension as a fallback (some browsers misreport MIME)
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const isAllowedExt = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);

  if (!isAllowedMime && !isAllowedExt) {
    return {
      valid: false,
      error: `Unsupported file type. Please upload an MP4, MOV, AVI, or WebM video.`,
    };
  }
  return { valid: true };
}

export function validateFileSize(file: File): VideoValidation {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large. Maximum size is 100 MB (your file: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }
  return { valid: true };
}

export function validateDuration(durationSeconds: number): VideoValidation {
  if (durationSeconds > MAX_DURATION_SECONDS) {
    return {
      valid: false,
      error: `Video is too long. Maximum duration is 30 seconds (your video: ${Math.round(durationSeconds)}s).`,
    };
  }
  return { valid: true };
}

/** Runs all client-side validations in order. Returns the first failure, or valid. */
export function validateFile(file: File): VideoValidation {
  const typeCheck = validateFileType(file);
  if (!typeCheck.valid) return typeCheck;

  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) return sizeCheck;

  return { valid: true };
}
