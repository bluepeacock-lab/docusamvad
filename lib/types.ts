export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface MessageTrace {
  pipeline: "OCR→105B" | "105B";
  ocrLatencyMs: number;
  inputChars: number;
  outputChars: number;
  crossLanguage: boolean;
}

export interface DisplayMessage extends ChatMessage {
  id: string;
  confidence?: number;
  source?: string;
  latencyMs?: number;
  trace?: MessageTrace;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionOptions {
  model: string;
  temperature?: number;
  max_tokens?: number;
  reasoning_effort?: string | null;
}

export type OcrJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "partially_completed"
  | "failed"
  | "rejected";

export interface OcrStatusResult {
  status: OcrJobStatus;
  pagesTotal: number;
  pagesSucceeded: number;
  pagesFailed: number;
}

export interface OcrDownloadResult {
  text: string;
}

export interface DocumentPage {
  pageNumber: number;
  content: string;
}

export type DocumentBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };
