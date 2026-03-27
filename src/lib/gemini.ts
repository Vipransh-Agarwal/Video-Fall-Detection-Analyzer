import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult } from "./types";

const SYSTEM_PROMPT = `You are a video analysis AI specialized in human fall detection. Your task is to analyze the provided video and determine whether an accidental human fall has occurred.

Rules:
- Set fallDetected to true ONLY if a person appears to fall accidentally (losing balance, tripping, slipping).
- Set confidence as an integer from 0 to 100 representing your certainty level.
- Provide a concise 1-3 sentence explanation referencing specific visual cues observed (body posture, movement speed, trajectory, environmental context).
- If no person is visible in the video, set fallDetected to false, confidence to 100, and state that no person was detected.
- Distinguish carefully between accidental falls and intentional actions such as sitting down, lying down, bending over, or performing exercises.
- When uncertain, reflect that uncertainty in the confidence score rather than guessing.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    fallDetected: {
      type: "boolean",
      description: "Whether an accidental fall was detected in the video",
    },
    confidence: {
      type: "integer",
      description: "Confidence score from 0 (no confidence) to 100 (fully confident)",
      minimum: 0,
      maximum: 100,
    },
    explanation: {
      type: "string",
      description: "1-3 sentence explanation referencing specific visual cues",
    },
  },
  required: ["fallDetected", "confidence", "explanation"],
} as const;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenAI({ apiKey });
}

export async function analyzeVideoForFall(file: File): Promise<AnalysisResult> {
  const ai = getClient();

  // Step 1: Upload the video to Gemini File API
  const arrayBuffer = await file.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: file.type });

  const uploadedFile = await ai.files.upload({
    file: blob,
    config: {
      mimeType: file.type,
      displayName: file.name,
    },
  });

  if (!uploadedFile.uri || !uploadedFile.name) {
    throw new Error("File upload to Gemini API failed: no URI returned");
  }

  // Step 2: Wait for the file to become ACTIVE (File API processes asynchronously)
  await waitForFileActive(ai, uploadedFile.name);

  // Step 4: Generate structured analysis
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              mimeType: file.type,
              fileUri: uploadedFile.uri,
            },
          },
          {
            text: "Analyze this video for accidental human fall detection. Return a JSON object with fallDetected, confidence, and explanation fields.",
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  // Step 5: Parse and validate response
  const rawText = response.text;
  if (!rawText) {
    throw new Error("Gemini API returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${rawText}`);
  }

  return sanitizeResult(parsed);
}

/** Poll until the uploaded file reaches ACTIVE state (or throw on failure/timeout). */
async function waitForFileActive(
  ai: GoogleGenAI,
  fileName: string,
  maxWaitMs = 60_000,
  pollIntervalMs = 2_000
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const fileInfo = await ai.files.get({ name: fileName });
    const state = fileInfo.state;

    if (state === "ACTIVE") return;
    if (state === "FAILED") {
      throw new Error(`File processing failed on Gemini servers (state: FAILED).`);
    }

    // PROCESSING — wait and retry
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `File did not become ACTIVE within ${maxWaitMs / 1000}s. Try a smaller or shorter video.`
  );
}

function sanitizeResult(raw: unknown): AnalysisResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Gemini response is not a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  const fallDetected = Boolean(obj.fallDetected);
  const confidence = Math.min(
    100,
    Math.max(0, Math.round(Number(obj.confidence) || 0))
  );
  const explanation =
    typeof obj.explanation === "string" && obj.explanation.trim().length > 0
      ? obj.explanation.trim()
      : "No explanation provided.";

  return { fallDetected, confidence, explanation };
}
