import { NextRequest, NextResponse } from "next/server";
import { analyzeVideoForFall } from "@/lib/gemini";
import { validateFileType, validateFileSize } from "@/lib/validators";
import type { ApiErrorResponse, ApiSuccessResponse, ErrorCode } from "@/lib/types";

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number
): NextResponse<ApiErrorResponse> {
  return NextResponse.json<ApiErrorResponse>(
    { success: false, error: { code, message } },
    { status }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Guard: API key must be configured
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    return errorResponse(
      "API_KEY_MISSING",
      "Server configuration error: Gemini API key is not configured.",
      500
    );
  }

  // 2. Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to parse request body. Please ensure you are sending multipart/form-data.",
      400
    );
  }

  // 3. Extract video file
  const videoField = formData.get("video");
  if (!videoField || !(videoField instanceof File)) {
    return errorResponse(
      "NO_FILE_PROVIDED",
      "No video file was provided. Please include a video file in the 'video' field.",
      400
    );
  }

  const file = videoField;

  // 4. Validate file type
  const typeValidation = validateFileType(file);
  if (!typeValidation.valid) {
    return errorResponse(
      "INVALID_FILE_TYPE",
      typeValidation.error ?? "Invalid file type.",
      400
    );
  }

  // 5. Validate file size
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.valid) {
    return errorResponse(
      "FILE_TOO_LARGE",
      sizeValidation.error ?? "File is too large.",
      400
    );
  }

  // 6. Analyze with Gemini
  try {
    const result = await analyzeVideoForFall(file);
    return NextResponse.json<ApiSuccessResponse>({
      success: true,
      data: result,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";

    // Distinguish API key / configuration errors from runtime errors
    if (message.includes("API_KEY") || message.includes("environment variable")) {
      return errorResponse("API_KEY_MISSING", message, 500);
    }

    return errorResponse(
      "AI_PROCESSING_FAILED",
      `Video analysis failed: ${message}`,
      502
    );
  }
}
