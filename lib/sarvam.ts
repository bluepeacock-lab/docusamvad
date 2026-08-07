import type {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  OcrDownloadResult,
  OcrStatusResult,
} from "./types";

const POLL_INTERVAL_MS = 3000;

export class NetworkError extends Error {}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new NetworkError("Connection error. Check your internet.");
  }
}

async function parseJsonOrThrow(res: Response): Promise<any> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    const message =
      typeof err === "string" ? err : (err?.message ?? `Request failed with status ${res.status}`);
    throw new Error(message);
  }
  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startOcrJob(
  file: File,
  language = "en-IN",
  outputFormat = "md"
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("language", language);
  formData.append("output_format", outputFormat);

  const res = await apiFetch("/api/ocr/start", {
    method: "POST",
    body: formData,
  });

  const data = await parseJsonOrThrow(res);
  return data.jobId;
}

export async function checkOcrStatus(jobId: string): Promise<OcrStatusResult> {
  const res = await apiFetch(`/api/ocr/status/${jobId}`);
  return parseJsonOrThrow(res);
}

export async function downloadOcrResult(jobId: string): Promise<OcrDownloadResult> {
  const res = await apiFetch(`/api/ocr/download/${jobId}`);
  return parseJsonOrThrow(res);
}

export interface OcrProgress {
  phase: "starting" | "polling";
  elapsedSec?: number;
}

export async function runOcrJob(
  file: File,
  onProgress: (progress: OcrProgress) => void,
  language = "en-IN"
): Promise<{ text: string; pages: number }> {
  const startedAt = Date.now();
  onProgress({ phase: "starting" });

  const jobId = await startOcrJob(file, language, "md");
  onProgress({ phase: "polling", elapsedSec: 0 });

  let pagesTotal = 0;

  while (true) {
    await sleep(POLL_INTERVAL_MS);
    const result = await checkOcrStatus(jobId);

    if (result.status === "completed" || result.status === "partially_completed") {
      pagesTotal = result.pagesTotal;
      break;
    }
    if (result.status === "failed" || result.status === "rejected") {
      throw new Error("Document processing failed. Try a different file.");
    }

    onProgress({ phase: "polling", elapsedSec: Math.floor((Date.now() - startedAt) / 1000) });
  }

  const { text } = await downloadOcrResult(jobId);
  return { text, pages: pagesTotal };
}

export async function sendChatMessage(
  messages: ChatMessage[],
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const res = await apiFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, ...options }),
  });

  return parseJsonOrThrow(res);
}

export function buildSystemPrompt(extractedText: string): string {
  return `You are DocuSamvad, an AI document assistant built for India.

LANGUAGE RULE (most important rule — follow this above all else):
Detect the language of the user's question. Respond ENTIRELY in that same language.
- User asks in English → respond in English
- User asks in Hindi → respond in Hindi
- User asks in Kannada → respond in Kannada
- User asks in Tamil → respond in Tamil
- This applies to ALL languages. Match the user's language exactly.
- If the user mixes languages (Hinglish), respond in the same mix.
- The document language does NOT affect your response language. A Hindi document with an English question gets an English answer.

DOCUMENT TEXT:
${extractedText}

ANSWER RULES:
1. Answer ONLY from the document text above. Never use outside knowledge.
2. If the information is not in the document, say so clearly in the user's language.
3. When citing sources, be specific about the page number and section. Use the exact format: [Source: Page X, Section Y] where X is the page number and Y is the section or clause number. If you reference multiple sections, list each one: [Source: Page 1, Section 3; Page 2, Section 1]. Always include page numbers — never say just "Section 3" without the page.
4. Rate your confidence. Format: [Confidence: XX%]
5. The words "Source" and "Confidence" in these tags must always stay in English exactly as shown, even when the rest of your answer is in another language. Do not translate "Source" to "स्रोत", "Confidence" to "विश्वास", or any equivalent in any other language — the tag keywords are fixed English markup, not part of the translated prose.
6. Use simple, everyday language. Break complex legal or technical terms into plain explanations.
7. If the document has blank fields (meant to be filled in), mention that those fields are blank/unfilled.`;
}

const CONFIDENCE_REGEX = /\[Confidence:\s*(\d+)%\]/;
const SOURCE_REGEX = /\[Source:\s*(.+?)\]/;

export interface ParsedAssistantReply {
  text: string;
  confidence?: number;
  source?: string;
}

export function parseAssistantReply(content: string): ParsedAssistantReply {
  const confidenceMatch = content.match(CONFIDENCE_REGEX);
  const sourceMatch = content.match(SOURCE_REGEX);

  const text = content
    .replace(new RegExp(CONFIDENCE_REGEX.source, "g"), "")
    .replace(new RegExp(SOURCE_REGEX.source, "g"), "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text,
    confidence: confidenceMatch ? parseInt(confidenceMatch[1], 10) : undefined,
    source: sourceMatch ? sourceMatch[1].trim() : undefined,
  };
}

const SCRIPT_RANGES: { name: string; regex: RegExp }[] = [
  { name: "Hindi", regex: /[ऀ-ॿ]/ },
  { name: "Bengali", regex: /[ঀ-৿]/ },
  { name: "Punjabi", regex: /[਀-੿]/ },
  { name: "Gujarati", regex: /[઀-૿]/ },
  { name: "Odia", regex: /[଀-୿]/ },
  { name: "Tamil", regex: /[஀-௿]/ },
  { name: "Telugu", regex: /[ఀ-౿]/ },
  { name: "Kannada", regex: /[ಀ-೿]/ },
  { name: "Malayalam", regex: /[ഀ-ൿ]/ },
];

export function detectQuestionLanguage(text: string): string {
  for (const { name, regex } of SCRIPT_RANGES) {
    if (regex.test(text)) return name;
  }
  return "English";
}

// Unlike detectQuestionLanguage (any single script character wins — appropriate
// for short user questions), this is a true majority vote across the whole
// text, with English counted as a real competing script (Latin letters). A
// long English answer that quotes one Hindi word from the document should
// still win as English — only a text that's actually mostly non-English
// should be flagged as a language-compliance failure.
export function detectDominantLanguage(text: string): string {
  const englishMatches = text.match(/[a-zA-Z]/g);

  let bestName = "English";
  let bestCount = englishMatches ? englishMatches.length : 0;

  for (const { name, regex } of SCRIPT_RANGES) {
    const matches = text.match(new RegExp(regex.source, "g"));
    const count = matches ? matches.length : 0;
    if (count > bestCount) {
      bestCount = count;
      bestName = name;
    }
  }

  return bestName;
}

export function buildLanguageReminder(questionLanguage: string, retry = false): string {
  const prefix = retry
    ? "MANDATORY — your previous answer broke this rule, do not repeat that mistake: "
    : "";
  return `${prefix}The user's next question is written in ${questionLanguage}. You must respond entirely in ${questionLanguage}, regardless of the document's language.`;
}

const INPUT_COST_PER_MILLION_INR = 4;
const OUTPUT_COST_PER_MILLION_INR = 16;

export function estimateTokens(chars: number): number {
  return Math.round(chars / 4);
}

export function estimateCostInr(inputChars: number, outputChars: number): number {
  const inputTokens = estimateTokens(inputChars);
  const outputTokens = estimateTokens(outputChars);
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION_INR +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION_INR
  );
}
