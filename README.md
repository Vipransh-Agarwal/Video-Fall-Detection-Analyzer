# Video Fall Detection Analyzer

A Next.js web application that uses Google Gemini's multimodal AI to detect accidental human falls in uploaded video clips.

## Features

- Drag-and-drop or click-to-browse video upload (MP4, MOV, AVI, WebM)
- Client-side validation: file type, size (≤100 MB), duration (≤30 seconds)
- Video preview player before analysis
- Structured AI analysis: fall detected (yes/no), confidence score (0–100%), and explanation
- Color-coded results: green for no fall, red for fall detected
- Dismissible error messages for all failure modes

## Prerequisites

- **Node.js 18+** (tested on Node 24)
- **Google Gemini API key** — free tier at [aistudio.google.com](https://aistudio.google.com/app/apikey)
  - Free tier: 10 RPM, 250 RPD on `gemini-2.5-flash`

## Setup

```powershell
# 1. Install dependencies
npm install

# 2. Configure API key
#    Copy .env.example to .env.local and add your key
Copy-Item .env.example .env.local
# Then edit .env.local and replace "your_api_key_here" with your actual key

# 3. Run the development server
npm run dev
# OR use the helper script:
.\scripts\dev.ps1
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_GEMINI_API_KEY` | Your Google Gemini API key (required, server-side only) |

The API key is only used server-side in the `/api/analyze` route and is never exposed to the browser.

## Google Gemini Integration

### SDK
Uses `@google/genai` v1.x — the new unified Google AI SDK (the older `@google/generative-ai` was deprecated November 30, 2025).

### Upload Strategy: File API
Videos are uploaded to Gemini via the **File API** (`ai.files.upload()`), which:
- Avoids base64 encoding overhead
- Supports files up to 2 GB
- Files are stored temporarily (~48 hours) and then auto-deleted by Google

### Structured Output
The API uses `responseMimeType: "application/json"` combined with a `responseSchema` to guarantee a well-formed JSON response — no fragile regex parsing needed.

### Model
`gemini-2.5-flash` — the latest multimodal model, suitable for video understanding on the free tier.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx           # Root layout + metadata
│   ├── page.tsx             # Main page (assembles all components)
│   ├── globals.css          # Tailwind v4 + shadcn CSS variables
│   └── api/analyze/
│       └── route.ts         # POST /api/analyze — server-side handler
├── components/
│   ├── ui/                  # shadcn/ui components (auto-generated)
│   ├── video-upload.tsx     # Drag-and-drop upload zone
│   ├── video-preview.tsx    # HTML5 video player
│   ├── analyze-button.tsx   # CTA with loading state
│   ├── analysis-result.tsx  # Results card (fall status, confidence, explanation)
│   └── error-toast.tsx      # Dismissible error banner
├── hooks/
│   └── use-video-analysis.ts  # State machine for the full workflow
└── lib/
    ├── gemini.ts            # Gemini SDK integration
    ├── validators.ts        # File type/size/duration validation
    ├── types.ts             # Shared TypeScript interfaces
    └── utils.ts             # cn(), formatFileSize(), formatDuration()
```

## API Reference

### `POST /api/analyze`

**Request:** `multipart/form-data` with a `video` file field.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "fallDetected": true,
    "confidence": 87,
    "explanation": "The person loses balance near the staircase and falls rapidly to the ground, with arms flailing."
  }
}
```

**Error Response (400 / 500 / 502):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "Unsupported file type. Please upload an MP4, MOV, AVI, or WebM video."
  }
}
```

**Error codes:** `INVALID_FILE_TYPE` · `FILE_TOO_LARGE` · `NO_FILE_PROVIDED` · `AI_PROCESSING_FAILED` · `API_KEY_MISSING` · `INTERNAL_ERROR`

## Scripts

| Script | Description |
|--------|-------------|
| `.\scripts\00-bootstrap.ps1` | Initial project setup (already run) |
| `.\scripts\dev.ps1` | Start dev server with API key check |
| `.\scripts\11-verify.ps1` | Run all verification checks |

## Assumptions & Limitations
1. **Duration validation is client-side only.** The server cannot determine video duration; it only validates file type and size. A user could bypass the 30-second limit by sending a request directly to the API.
2. **Single video at a time.** The UI handles one video per session; no batch processing.
3. **No persistence.** No videos or results are saved to disk or a database.
4. **Free tier rate limits apply.** With the Gemini free tier, you get 10 requests/minute and 250 requests/day. The app does not implement retry logic or rate-limit handling.
5. **No authentication.** The app is intended for local/demo use. Deploying publicly without auth would expose your Gemini API quota.

## Privacy

Videos uploaded through this application are sent to the **Google Gemini API** for analysis. Google may process and temporarily store uploaded files per their Terms of Service. Files uploaded via the File API are automatically deleted after 48 hours. No data is stored by this application itself.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 (CSS-native) |
| UI Components | shadcn/ui v4 |
| AI SDK | @google/genai v1 |
| AI Model | gemini-2.5-flash |
| Icons | lucide-react |
