# Screen Recording Script
## Video Fall Detection Analyzer — End-to-End Build Walkthrough

---

> **How to use this script:**
> - Text in `[ACTION: ...]` blocks = what to do on screen
> - All other text = what to say out loud while doing it
> - The code is already written — you are copying it in during the recording
> - Keep a natural pace — pause briefly after opening each file before you speak

---

## INTRO (No code yet — just talking to camera / title card)

---

"Hey everyone. In this video I'm going to walk you through how I built a **Video Fall Detection Analyzer** — a full-stack web app that lets you upload a short video clip, sends it to Google Gemini's AI, and tells you whether an accidental human fall occurred, along with a confidence score and a written explanation.

I'll be building this from scratch, explaining every decision along the way. The stack is **Next.js 15** with **TypeScript**, **Tailwind CSS** and the **Google Gemini API** from **Google AI Studio** for the actual AI analysis.

Let me start with a quick look at what we're building."

---

## PART 1 — Reading the Brief and Planning the Architecture

---

`[ACTION: Open the PRD file at .recources/PRD.md in VS Code]`

"Before I write a single line of code, I want to read the brief carefully. Every decision I make is going to come from here.

The requirements are: accept video uploads up to 100 megabytes, maximum 30 seconds long, support MP4, MOV, AVI and WebM formats. Send the video to Gemini. Return three things — a boolean for whether a fall was detected, a confidence integer from zero to a hundred, and a text explanation. Display all of that in a clean UI with color coding — green for no fall, red for fall detected.

Now, one thing the brief doesn't fully spell out is the tech stack for the UI layer, and that's where I want to make a deliberate choice. I'm going to use shadcn/ui for the components. For anyone who hasn't used it — shadcn is not a traditional component library you install as a dependency and import from. It's a collection of pre-built components that get copied directly into your project as source code. So the Button, the Card, the Progress bar — they all live in your `src/components/ui` folder, fully editable, no black box. It uses Radix UI under the hood for accessibility primitives, and it integrates with Tailwind for styling. The reason I'm choosing it here is it gives me production-quality accessible components immediately — things like a proper progress bar with ARIA attributes, a dismissible alert — without spending time building those from scratch. That lets me focus on the actual application logic, which is the interesting part.

Now let me think about the architecture before I touch any files. The key constraint is this — the Gemini API key must never reach the browser. If it does, anyone can open DevTools, find it, and use your quota. So the design has to have the key live on the server only. That shapes everything. So the shape of this app is:"

`[ACTION: Open a blank notepad and type out this sketch while talking:]`

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER (Client)                  │
│                                                      │
│  User selects video  →  validate type/size/duration  │
│         ↓                                            │
│  POST /api/analyze   (multipart/form-data, video)    │
└──────────────────────┬──────────────────────────────┘
                       │  video file travels over HTTP
                       ▼
┌─────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTE  (Server)             │
│                                                      │
│  1. Re-validate file type + size                     │
│  2. Upload video → Gemini File API  (gets a URI)     │
│  3. Poll until file state = ACTIVE                   │
│  4. Call generateContent with that URI               │
│  5. Parse structured JSON response                   │
│         ↓                                            │
│  { fallDetected, confidence, explanation }           │
└──────────────────────┬──────────────────────────────┘
                       │  JSON travels back
                       ▼
┌─────────────────────────────────────────────────────┐
│                    BROWSER (Client)                  │
│                                                      │
│  Display result card — color coded, confidence bar  │
└─────────────────────────────────────────────────────┘

  ⚠ API key stays on the server — never sent to browser
```

"So the browser does the upload and the display. The server does everything that touches the API key — the Gemini upload, the polling, the generation call. The browser never sees the key at any point.

One more thing worth noting — I'm validating the file on both sides. Client-side validation gives the user instant feedback without a network round trip. Server-side validation is the safety net — it means even if someone bypasses the UI and sends a raw request to the API, they still can't sneak in an invalid file.

I'm going to build this from the bottom up — types first, then validation, then the Gemini layer, then the API route, then the React side. Each layer only depends on what's below it."

---

## PART 2 — Project Setup

---

`[ACTION: Open a PowerShell terminal. Navigate to the folder where you want the project to live — e.g. your Desktop]`

"Alright, project setup. I'll use `create-next-app` which scaffolds everything — TypeScript, Tailwind, App Router, the src directory, all of it in one shot."

`[ACTION: Run:]`

```powershell
npx create-next-app@latest video-fall-detection-analyzer
```

`[ACTION: When the prompts appear, select: TypeScript → Yes, ESLint → Yes, Tailwind CSS → Yes, src/ directory → Yes, App Router → Yes, import alias → No (just hit Enter for default)]`

"I'm saying yes to TypeScript, yes to Tailwind, yes to the App Router, and yes to the `src/` directory. These are non-negotiable for how I want to structure this project. The import alias question I'll leave as the default `@/*` which maps to `src/`.

Once it finishes, I'll open the folder in VS Code."

`[ACTION: Run: cd video-fall-detection-analyzer, then open in VS Code]`

"Good. The scaffold gives us `next.config.ts`, `tsconfig.json` with strict mode already on, Tailwind configured, ESLint, a working `src/app` directory. Everything we need to start.

There are two things I want to add to the generated config. First, `next.config.ts` — I need to bump the server body size limit so large video files don't get rejected before they even reach my API route."

`[ACTION: Open next.config.ts and add the serverActions bodySizeLimit inside the existing config object:]`

```typescript
experimental: {
  serverActions: {
    bodySizeLimit: "100mb",
  },
},
```

"Now I need to install two extra packages that aren't included in the scaffold — the Google Gemini SDK and Lucide for icons."

`[ACTION: In terminal, run:]`

```powershell
npm install @google/genai lucide-react
```

"And now before I do anything else, I'll set up the environment file."

`[ACTION: Create .env.local at the project root with:]`

```
GOOGLE_GEMINI_API_KEY=your_key_here
```

`[ACTION: Also create .env.example with the same content but placeholder value, and verify .env.local is already in the generated .gitignore]`

"The `.env.local` file is where the API key lives. Next.js loads it automatically in development. Critically — no `NEXT_PUBLIC_` prefix on the variable name. That prefix would embed it in the client-side JavaScript bundle for anyone to find in DevTools. Without the prefix, Next.js keeps it server-side only.

Now shadcn/ui."

`[ACTION: Run: npx shadcn@latest init --defaults -y]`

"shadcn/ui version 4 fully supports Tailwind 4's CSS-native approach. The init command detects our Tailwind version automatically. It will create a `components.json` config and put the `cn()` utility in `src/lib/utils.ts`."

`[ACTION: Wait for it to finish. Then run: npx shadcn@latest add button card progress badge alert -y]`

"I'm adding exactly the components I need — nothing more. Button, Card, Progress for the confidence bar, Badge for the fall-detected label, and Alert for error messages. shadcn puts these directly into my project as source files, which means I can modify them if I ever need to. They're not inside node_modules."

`[ACTION: Show the src/components/ui/ folder now has files in it]`

"Perfect. Foundation is set. Let's write code."

---

## PART 3 — Types First (`src/lib/types.ts`)

---

`[ACTION: Open src/lib/types.ts — create it if it doesn't exist]` → [`src/lib/types.ts`](src/lib/types.ts)

"I always start with types. Not because TypeScript forces me to, but because writing the types forces me to think clearly about the data flowing through the system before I've written any logic.

What does an analysis result look like? Three fields."

`[ACTION: Type out:]` → [`types.ts L1–5`](src/lib/types.ts#L1-L5)

```typescript
export interface AnalysisResult {
  fallDetected: boolean;
  confidence: number;
  explanation: string;
}
```

"Now the API contract. This is a discriminated union — two possible shapes with a `success` field as the discriminant. TypeScript can narrow between them based on that field."

`[ACTION: Type out:]` → [`types.ts L7–20`](src/lib/types.ts#L7-L20)

```typescript
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
```

"The `ErrorCode` is a union of string literals — not a generic string. This means if I add a new error code later, TypeScript will immediately tell me everywhere I need to handle it."

`[ACTION: Type out:]` → [`types.ts L34–41`](src/lib/types.ts#L34-L41)

```typescript
export type ErrorCode =
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "VIDEO_TOO_LONG"
  | "NO_FILE_PROVIDED"
  | "AI_PROCESSING_FAILED"
  | "API_KEY_MISSING"
  | "INTERNAL_ERROR";
```

"And finally, the UI status type. This models the state machine — the app is always in exactly one of these states."

`[ACTION: Type out:]` → [`types.ts L27–33, L22–25`](src/lib/types.ts#L22-L33)

```typescript
export type AnalysisStatus =
  | "idle"
  | "uploading"
  | "analyzing"
  | "success"
  | "error";

export interface VideoValidation {
  valid: boolean;
  error?: string;
}
```

"That's the complete types file. No logic, just shapes. Every other file in this project will import from here."

---

## PART 4 — Validation Utilities (`src/lib/validators.ts`)

---

`[ACTION: Open src/lib/validators.ts — create it]` → [`src/lib/validators.ts`](src/lib/validators.ts)

"Validation is interesting because some of it happens on the client and some on the server. Type and size can both be validated on both sides. Duration, however, can only be validated on the client — the browser is the only one who knows how long a video is without actually decoding it. The server gets a raw binary stream and has no duration information.

Let me start with the constants."

`[ACTION: Type out:]` → [`validators.ts L3–13`](src/lib/validators.ts#L3-L13)

```typescript
export const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
] as const;

export const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".webm"] as const;

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_DURATION_SECONDS = 30;
```

"I'm using `as const` on the arrays. That turns them into readonly tuples of literal types — much more precise than just `string[]`.

Now the file type validator. I check both MIME type and extension. Why both? Because some browsers — particularly older ones or ones on mobile — can misreport the MIME type of a video file. Checking the extension as a fallback adds robustness."

`[ACTION: Type out validateFileType, validateFileSize, validateDuration, and validateFile functions from the validators.ts file]` → [`validators.ts L15–62`](src/lib/validators.ts#L15-L62)

"Notice `validateFile` runs them in order and returns on the first failure. The user sees one error at a time, not a list of everything wrong at once. That's a small UX consideration but it matters."

---

## PART 5 — Utils (`src/lib/utils.ts`)

---

`[ACTION: Open src/lib/utils.ts — shadcn already created this with cn()]` → [`src/lib/utils.ts`](src/lib/utils.ts)

"shadcn already gave us `cn()`, which merges Tailwind classes intelligently. I just need to add two more helpers — `formatFileSize` to display file sizes in human-readable form, and `formatDuration` for display purposes."

`[ACTION: Add below the existing cn() function:]` → [`utils.ts L8–18`](src/lib/utils.ts#L8-L18)

```typescript
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
```

---

## PART 6 — The Gemini Service (`src/lib/gemini.ts`)

---

`[ACTION: Open src/lib/gemini.ts — create it]` → [`src/lib/gemini.ts`](src/lib/gemini.ts)

"This is the heart of the application. Everything else is just plumbing around this file.

Let me think through the approach before I write any code. There are two ways to send a video to Gemini. Option one is base64 — convert the file to a base64 string and embed it inline in the request. Option two is the File API — upload the video as a separate step, get a URI back, then reference that URI in the generation request.

I'm choosing the File API, and here's exactly why.

Base64 works by encoding binary data as text — every 3 bytes of the original file becomes 4 ASCII characters. That's a 33% size increase before the data even leaves your machine. So a 50 megabyte video becomes roughly 67 megabytes in the request body. For images that's annoying. For video files it's a real problem.

More importantly, base64 inline data has strict size limits in the Gemini API — around 20 megabytes. The File API has no such restriction; it supports files up to 2 gigabytes. Since this app accepts videos up to 100 megabytes, base64 would simply fail for anything above that 20 meg threshold. It's not even a performance trade-off at that point — it's a hard technical blocker.

There's also a memory consideration. With base64, you're holding the entire file as a string in memory on the server simultaneously with the original buffer. With the File API, you stream the upload directly and Google handles the storage on their side. Much cleaner.

And then there's the code simplicity angle — the File API gives you a URI back, and you just reference that URI in the generation call. No encoding, no decoding, no size arithmetic. For video, the File API is simply the right tool."

`[ACTION: Start typing — begin with the import and the system prompt constant:]` → [`gemini.ts L1–2`](src/lib/gemini.ts#L1-L2)

```typescript
import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult } from "./types";
```

"The system prompt is a constant. I don't want it buried inside the function — I want it at the top of the file where I can read and iterate on it easily."

`[ACTION: Type the SYSTEM_PROMPT constant:]` → [`gemini.ts L4–12`](src/lib/gemini.ts#L4-L12)

```typescript
const SYSTEM_PROMPT = `You are a video analysis AI specialized in human fall detection...
```

"A few deliberate choices in this prompt. I say 'ONLY if a person appears to fall accidentally' — I want to avoid false positives from someone sitting down or bending over. I explicitly ask it to distinguish intentional from accidental motion. I ask it to reference specific visual cues in the explanation — so the user gets something meaningful, not just a boolean. And I tell it what to do if no person is visible.

Now the response schema. This is Gemini's native structured output feature."

`[ACTION: Type the RESPONSE_SCHEMA constant:]` → [`gemini.ts L14–33`](src/lib/gemini.ts#L14-L33)

```typescript
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    fallDetected: { type: "boolean", ... },
    confidence: { type: "integer", minimum: 0, maximum: 100, ... },
    explanation: { type: "string", ... },
  },
  required: ["fallDetected", "confidence", "explanation"],
} as const;
```

"With `responseMimeType: 'application/json'` plus this schema, Gemini guarantees the output is valid JSON in exactly this shape. No regex parsing, no hoping it wraps the output in a markdown code block. The structured output mode eliminates an entire class of bugs.

Now the client factory."

`[ACTION: Type getClient():]` → [`gemini.ts L35–41`](src/lib/gemini.ts#L35-L41)

```typescript
function getClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenAI({ apiKey });
}
```

"I make this a function rather than a module-level constant for an important reason — if I initialize the client at module load time and the env var is missing, the error happens at import time, which makes debugging harder. By lazily initializing inside a function, the error happens at call time with a useful stack trace.

Now the main function."

`[ACTION: Type analyzeVideoForFall() step by step, narrating each step:]` → [`gemini.ts L43–61`](src/lib/gemini.ts#L43-L61)

```typescript
export async function analyzeVideoForFall(file: File): Promise<AnalysisResult> {
  const ai = getClient();

  // Step 1: Upload
  const arrayBuffer = await file.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: file.type });

  const uploadedFile = await ai.files.upload({
    file: blob,
    config: { mimeType: file.type, displayName: file.name },
  });
```

"Step one — upload. The File API takes a Blob. I convert the File to an ArrayBuffer and then to a Blob, preserving the original MIME type. The `displayName` is optional but useful for debugging in the Google AI Studio console.

Now here's something important I discovered while testing. Right after upload, the file is in a PROCESSING state — Gemini is transcoding it on their servers. If you immediately call `generateContent` with a file that's still processing, you get an error: 'The file is not in an ACTIVE state and usage is not allowed'. So we need to poll."

`[ACTION: Type waitForFileActive():]` → [`gemini.ts L107–132`](src/lib/gemini.ts#L107-L132)

```typescript
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
```

"We poll every two seconds, up to sixty seconds total. Three states are possible — ACTIVE means we're good to go. FAILED means Gemini couldn't process the video, and we throw immediately with a clear error. PROCESSING means keep waiting. If we hit sixty seconds, we throw with a helpful message telling the user to try a shorter clip.

Back inside `analyzeVideoForFall` — after the upload we call `waitForFileActive`, then generate."

`[ACTION: Continue typing the generateContent call:]` → [`gemini.ts L62–89`](src/lib/gemini.ts#L62-L89)

```typescript
  await waitForFileActive(ai, uploadedFile.name);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        { fileData: { mimeType: file.type, fileUri: uploadedFile.uri } },
        { text: "Analyze this video for accidental human fall detection..." },
      ],
    }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });
```

"I'm using `gemini-2.5-flash` — the latest model as of early 2026. Flash is fast and handles multimodal inputs well. The `fileData` part tells Gemini to look at the uploaded file by URI, and the `text` part is the instruction.

Finally, parse and sanitize the response."

`[ACTION: Type the parsing section and sanitizeResult():]` → [`gemini.ts L91–152`](src/lib/gemini.ts#L91-L152)

```typescript
  const rawText = response.text;
  if (!rawText) throw new Error("Gemini API returned an empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${rawText}`);
  }

  return sanitizeResult(parsed);
}

function sanitizeResult(raw: unknown): AnalysisResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Gemini response is not a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  const fallDetected = Boolean(obj.fallDetected);
  const confidence = Math.min(100, Math.max(0, Math.round(Number(obj.confidence) || 0)));
  const explanation =
    typeof obj.explanation === "string" && obj.explanation.trim().length > 0
      ? obj.explanation.trim()
      : "No explanation provided.";

  return { fallDetected, confidence, explanation };
}
```

"Even though we asked for structured output, I still run it through `sanitizeResult`. Defense in depth — clamp the confidence to 0-100, ensure fallDetected is a proper boolean, ensure explanation is a non-empty string. Belt and suspenders."

---

## PART 7 — The API Route (`src/app/api/analyze/route.ts`)

---

`[ACTION: Create the directory src/app/api/analyze/ then open route.ts]` → [`src/app/api/analyze/route.ts`](src/app/api/analyze/route.ts)

"Now the API route. This is the only file where we connect the server-side Gemini logic to the web. The route needs to do several things in order — and the order matters."

`[ACTION: Type out route.ts, pausing to explain each guard:]` → [`route.ts L1–15`](src/app/api/analyze/route.ts#L1-L15)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { analyzeVideoForFall } from "@/lib/gemini";
import { validateFileType, validateFileSize } from "@/lib/validators";
import type { ApiErrorResponse, ApiSuccessResponse, ErrorCode } from "@/lib/types";
```

"Let me start with the error helper — I don't want to repeat the same response shape three times."

```typescript
function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json<ApiErrorResponse>(
    { success: false, error: { code, message } },
    { status }
  );
}
```

"Now the handler. The very first thing I check is whether the API key exists. If it doesn't, there's no point parsing anything — just return 500 immediately."

```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    return errorResponse("API_KEY_MISSING", "Server configuration error...", 500);
  }
```

"Then parse the multipart form data. In Next.js App Router, you call `request.formData()` directly — there's no manual body parser configuration needed."

`[ACTION: Continue with form data parsing, validation checks, and Gemini call — type each section from the route.ts file]` → [`route.ts L17–93`](src/app/api/analyze/route.ts#L17-L93)

"Notice how I'm using the same `validateFileType` and `validateFileSize` functions I defined in `validators.ts`. That's the benefit of putting them in a shared lib — no duplication between client and server.

The catch block at the end distinguishes between two types of errors — if the message mentions the API key or environment variable, I return 500. Otherwise it's a Gemini processing failure, so I return 502, which correctly signals that my server received the request fine but the upstream dependency failed."

---

## PART 8 — The Custom Hook (`src/hooks/use-video-analysis.ts`)

---

`[ACTION: Create src/hooks/use-video-analysis.ts]` → [`src/hooks/use-video-analysis.ts`](src/hooks/use-video-analysis.ts)

"Now the React side. The hook is the brain of the UI — it manages all state transitions. I'm going to use `useReducer` rather than multiple `useState` calls.

Why `useReducer`? Because the state here is not independent variables — they're tightly coupled. When a file is selected, the result and error should both clear. When analysis starts, the result should be null. These rules are much easier to express as explicit state transitions than as side effects of multiple independent `useState`s. With `useReducer`, every possible state combination is explicitly handled."

`[ACTION: Type the State interface and Action union:]` → [`use-video-analysis.ts L7–22`](src/hooks/use-video-analysis.ts#L7-L22)

```typescript
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
```

"The actions are a discriminated union — each action type carries exactly the payload it needs. TypeScript will catch me if I try to access a field that doesn't exist on a given action type."

`[ACTION: Type the reducer function:]` → [`use-video-analysis.ts L32–65`](src/hooks/use-video-analysis.ts#L32-L65)

"In the reducer, notice the memory leak prevention — whenever a file gets replaced or reset, I call `URL.revokeObjectURL` on the old URL. Object URLs hold references to the file in memory. If you never revoke them, you leak memory for every file the user selects. Small detail but important."

`[ACTION: Type the hook function, narrating handleFileSelect and handleAnalyze:]` → [`use-video-analysis.ts L80–156`](src/hooks/use-video-analysis.ts#L80-L156)

"In `handleFileSelect` — I do the sync validation first, before creating the Object URL. If the type or size is wrong, there's no point creating a URL at all.

In `handleDurationLoaded` — this is called by the upload component after it reads the video metadata. Duration validation is a separate step because it's asynchronous — we need the browser to load the video metadata before we know the duration.

In `handleAnalyze` — I use the native `FormData` API to build a multipart request. No custom encoding. No libraries. Just `formData.append('video', file)` and then `fetch` with `method: 'POST'`. Simple and correct."

---

## PART 9 — UI Components

---

### VideoUpload

`[ACTION: Create src/components/video-upload.tsx]` → [`src/components/video-upload.tsx`](src/components/video-upload.tsx)

"The upload component has some complexity to it — let me walk through the interesting parts.

Duration check — I can't get the video duration from the `File` object alone. I need to actually load it into a `<video>` element, wait for the `loadedmetadata` event, and then read the `duration` property. So inside `handleFileFromInput`, I create a temporary video element programmatically, set its source to an Object URL, and hook into `onloadedmetadata`. Once I have the duration, I revoke that temporary URL immediately — I only made it to check the metadata, not for display."

`[ACTION: Type the handleFileFromInput function:]` → [`video-upload.tsx L28–46`](src/components/video-upload.tsx#L28-L46)

```typescript
const handleFileFromInput = useCallback((file: File) => {
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
    onFileSelect(file);
  };
  videoEl.src = url;
}, [onFileSelect, onDurationLoaded]);
```

"The `onerror` path — if the browser can't load the video metadata for some reason, I still pass the file to `onFileSelect`. The other validators will run, and at worst the user gets a server-side error. I don't silently swallow anything.

For the drag-and-drop — three events. `dragover` to signal we accept the drop and show the visual state, `dragleave` to reset the visual state, and `drop` to actually handle the file. I call `preventDefault()` on `dragover`, which is what tells the browser 'yes, you can drop here' — without it, the browser would navigate to the file."

`[ACTION: Type the JSX, pausing to explain the visual states:]` → [`video-upload.tsx L93–165`](src/components/video-upload.tsx#L93-L165)

"The component has three visual states. Empty — the dashed border with the upload icon. Dragging — the border goes to primary color, slight scale up, background tints. File loaded — shows the filename, file size, and a remove button. All of these are driven by Tailwind classes with the `cn()` utility for conditional application.

One accessibility note — the div has `role='button'` and `tabIndex={0}` with a `keyDown` handler for Enter and Space. So keyboard users can operate it without a mouse."

### VideoPreview

`[ACTION: Create src/components/video-preview.tsx]` → [`src/components/video-preview.tsx`](src/components/video-preview.tsx)

"The preview component is deliberately simple. Just a native `<video>` element with controls. I use the `key={src}` prop — this forces React to completely remount the element when the source changes. Without this, React might try to update the `src` attribute on the existing element, which can cause the browser to keep playing the previous video."

### AnalyzeButton

`[ACTION: Create src/components/analyze-button.tsx]` → [`src/components/analyze-button.tsx`](src/components/analyze-button.tsx)

"The button has three states — disabled when no video is loaded, active when ready, and loading with a spinner when analysis is running. The `aria-busy` attribute signals the loading state to screen readers. I'm using Lucide for icons — Loader2 with `animate-spin` for the spinner, Scan for the idle state."

### AnalysisResultCard

`[ACTION: Create src/components/analysis-result.tsx]` → [`src/components/analysis-result.tsx`](src/components/analysis-result.tsx)

"The results card is where the UI tells the story. I use a `Badge` component with dynamic variant — `destructive` for fall detected, green background for no fall. The progress bar for confidence uses Tailwind's arbitrary value selector `[&>div]:bg-destructive` to color the fill — that's targeting the shadcn Progress component's internal div.

The `animate-in fade-in-0 slide-in-from-bottom-4` classes are from `tw-animate-css` — the card slides up when it appears, which gives a polished feeling without any JavaScript animation code.

The border also changes color — red tint when a fall was detected, green tint when not. Small details but they make the result feel immediately scannable."

### ErrorToast

`[ACTION: Create src/components/error-toast.tsx]` → [`src/components/error-toast.tsx`](src/components/error-toast.tsx)

"The error component wraps shadcn's Alert. It has a dismiss button positioned absolutely in the top right. `aria-live='assertive'` means screen readers will announce the error immediately when it appears."

---

## PART 10 — Globals CSS and Layout

---

`[ACTION: Open src/app/globals.css]` → [`src/app/globals.css`](src/app/globals.css)

"Tailwind 4 changes how you set up your CSS. Instead of the old three directives — `@tailwind base`, `@tailwind components`, `@tailwind utilities` — you now write a single `@import 'tailwindcss'`. That's it. The entire framework in one import.

The `@theme inline` block is how Tailwind 4 handles custom variables. Instead of `tailwind.config.ts`, I define semantic color tokens as CSS variables here. These map to the shadcn color system.

All the shadcn colors are defined as CSS custom properties under `:root` and `.dark`. This is the standard shadcn-with-Tailwind-4 setup."

`[ACTION: Open src/app/layout.tsx]` → [`src/app/layout.tsx`](src/app/layout.tsx)

"The layout is straightforward — Geist font from Google Fonts, metadata for the page title, and the body wrapper. One important detail — `suppressHydrationWarning` on the body element. Without this, you'll get a React hydration mismatch warning in development, because browser extensions like Grammarly inject attributes into the body tag after the server renders it but before React hydrates. The warning is harmless, but it pollutes the console. `suppressHydrationWarning` tells React to ignore attribute differences on this element only."

---

## PART 11 — Main Page (`src/app/page.tsx`)

---

`[ACTION: Open src/app/page.tsx]` → [`src/app/page.tsx`](src/app/page.tsx)

"The main page is the assembly point. It calls `useVideoAnalysis` and gets all the state and handlers back. Then it renders the components in order — error banner at the top if there is one, upload zone, preview if a video is loaded, analyze button, result if analysis succeeded.

Let me point out the conditional rendering logic. `{error && <ErrorToast ... />}` — the error banner only renders when there's an error. `{videoUrl && videoFile && <VideoPreview .../>}` — the preview only renders when we have both a file and an Object URL. `{status === 'success' && result && <AnalysisResultCard .../>}` — results only show after a successful analysis.

The page has a `max-w-2xl` container centered horizontally. I want the app to feel focused — not stretched across the full browser width. A narrow centered column feels intentional and clean.

The footer discloses that videos are sent to Google's API. This is important for privacy transparency."

---

## PART 12 — Environment Setup

---

`[ACTION: Open .env.local in editor (blur/hide the actual key value)]`

"This is where the API key lives. It goes in `.env.local` which Next.js automatically loads in development. The variable is prefixed as `GOOGLE_GEMINI_API_KEY` — no `NEXT_PUBLIC_` prefix, which means Next.js keeps it server-side only. If I had accidentally prefixed it with `NEXT_PUBLIC_`, it would be embedded in the client JavaScript bundle and anyone could find it in the browser DevTools. That's a security hole we definitely want to avoid.

To get a free API key, go to Google AI Studio at aistudio.google.com. The free tier gives you 250 requests per day on gemini-2.5-flash, which is plenty for testing."

---

## PART 13 — Final Check

---

`[ACTION: In the terminal, run: npx tsc --noEmit]`

"Let me run the TypeScript compiler before I start the server. No output means no errors. This is like a spell-check for your types — it catches mismatches before they become runtime errors."

`[ACTION: Run: npm run lint]`

"ESLint clean. Good.

Now let's run it."

`[ACTION: Run: npm run dev]`

`[ACTION: Open the browser at localhost:3000]`

"There it is — the app is running. Let me walk through a quick end-to-end test."

`[ACTION: Drag and drop a video file onto the upload zone]`

"I'll drag a video in. You can see the drag state — the border highlights and the background tints to give clear visual feedback. And when I drop it, the zone updates to show the filename and file size. Below that, the video preview appears automatically."

`[ACTION: Show the video preview playing]`

"The preview uses the native browser video player — no third-party library. Full controls, seekable, I can see what I'm about to analyze.

Now I'll click Analyze."

`[ACTION: Click the Analyze button. Show the spinner. Wait for result.]`

"You can see the button text changes to 'Analyzing...' with a spinner. During this time, the upload zone is disabled — you can't accidentally change the video while analysis is running.

What's happening under the hood right now: the video is being uploaded to Gemini's File API, then we're polling every two seconds until the file is marked as ACTIVE, then we call generateContent with our structured output schema, and finally the response comes back and we render it."

`[ACTION: Show the result card appearing]`

"And there's the result. The card slides up with a subtle animation. The badge shows fall detected or not with color coding. The confidence bar fills to the AI's certainty level. And the explanation gives a human-readable account of what the model actually saw.

Let me also test the error handling quickly."

`[ACTION: Try to drag an image file (e.g., a .jpg) onto the upload zone]`

"If I try to upload an image instead of a video — the error banner appears immediately with a clear message. The upload is rejected before it even reaches the server."

`[ACTION: Dismiss the error by clicking X]`

"Dismiss it. Clean. Now let me try a quick TypeScript check one more time to make sure everything is solid."

`[ACTION: Run: npx tsc --noEmit in terminal]`

"Zero errors. Zero."

---

## OUTRO

---

"And that's the complete build. Let me quickly recap the key decisions I made along the way.

**TypeScript strict mode** throughout — no compromises. This caught several type issues during development that would have been runtime bugs.

**File API over base64** for video uploads to Gemini — base64 inflates file size by 33%, has a ~20 MB inline limit that would hard-block our 100 MB requirement, and doubles memory usage on the server. The File API has none of those problems.

**Native structured output** with `responseMimeType` and `responseSchema` — eliminates an entire class of JSON parsing failures that you'd otherwise have to handle.

**Polling for ACTIVE state** after upload — something you discover the hard way the first time. The file is not immediately available after upload; you have to wait for Gemini to finish processing it.

**useReducer over useState** for the UI state machine — the state transitions are explicit, testable, and impossible to get into an inconsistent state.

**Server-only API key** — never prefixed with NEXT_PUBLIC_, never in the client bundle.

The code is all on GitHub, link in the description. Thanks for watching."

---

## APPENDIX: Quick Reference — File Order for Recording

If you need to stop and resume, here is the exact order files were created:

| Order | Action / File | Part |
|-------|--------------|------|
| 1 | `npx create-next-app@latest video-fall-detection-analyzer` | Part 2 |
| 2 | Edit `next.config.ts` — add bodySizeLimit | Part 2 |
| 3 | `npm install @google/genai lucide-react` | Part 2 |
| 4 | Create `.env.local` + `.env.example` | Part 2 |
| 5 | `npx shadcn@latest init --defaults -y` | Part 2 |
| 6 | `npx shadcn@latest add button card progress badge alert -y` | Part 2 |
| 7 | `src/lib/types.ts` | Part 3 |
| 8 | `src/lib/validators.ts` | Part 4 |
| 9 | `src/lib/utils.ts` (extend with formatFileSize, formatDuration) | Part 5 |
| 10 | `src/lib/gemini.ts` | Part 6 |
| 11 | `src/app/api/analyze/route.ts` | Part 7 |
| 12 | `src/hooks/use-video-analysis.ts` | Part 8 |
| 13 | `src/components/video-upload.tsx` | Part 9 |
| 14 | `src/components/video-preview.tsx` | Part 9 |
| 15 | `src/components/analyze-button.tsx` | Part 9 |
| 16 | `src/components/analysis-result.tsx` | Part 9 |
| 17 | `src/components/error-toast.tsx` | Part 9 |
| 18 | `src/app/globals.css` (review shadcn output) | Part 10 |
| 19 | `src/app/layout.tsx` — add suppressHydrationWarning | Part 10 |
| 20 | `src/app/page.tsx` | Part 11 |
| 21 | *(tsc + lint + npm run dev)* | Part 13 |
