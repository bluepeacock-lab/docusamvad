"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import {
  buildLanguageReminder,
  buildSystemPrompt,
  detectDominantLanguage,
  detectQuestionLanguage,
  parseAssistantReply,
  runOcrJob,
  streamChatMessage,
} from "@/lib/sarvam";
import type { ChatMessage, DisplayMessage } from "@/lib/types";

interface ChatPanelProps {
  uploadedFile: File | null;
  traceEnabled: boolean;
  extractedText: string | null;
  onExtractedTextChange: (text: string | null, pages: number | null) => void;
  onSourceClick: (pageNumber: number) => void;
}

const OCR_LANGUAGE = "en-IN";

function createId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ChatPanel({
  uploadedFile,
  traceEnabled,
  extractedText,
  onExtractedTextChange,
  onSourceClick,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ocrStatusText, setOcrStatusText] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingPhase, setStreamingPhase] = useState<"thinking" | "answering" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasDocument = !!uploadedFile;

  useEffect(() => {
    setOcrStatusText(null);
    setOcrError(null);
    setChatError(null);
    setMessages([]);
  }, [uploadedFile]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, ocrStatusText, ocrError, chatError, streamingText]);

  const askQuestion = async (
    history: DisplayMessage[],
    docText: string,
    ocrLatencyForThisMessage: number | null
  ) => {
    const startedAt = Date.now();
    const latestQuestion = history[history.length - 1];
    const earlierHistory = history.slice(0, -1);
    const questionLanguage = detectQuestionLanguage(latestQuestion.content);
    const documentLanguage = detectQuestionLanguage(docText);

    const buildMessages = (retry: boolean): ChatMessage[] => [
      { role: "system", content: buildSystemPrompt(docText) },
      ...earlierHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "system", content: buildLanguageReminder(questionLanguage, retry) },
      { role: latestQuestion.role, content: latestQuestion.content },
    ];

    // reasoning_effort "low" still spends part of the 4096-token budget (the
    // account's hard plan ceiling — can't be raised) on reasoning before the
    // actual answer. For broad questions that can exhaust that budget mid-
    // reasoning, finish_reason comes back "length" with content: null.
    // Confirmed empirically: retrying the SAME request with reasoning
    // disabled (reasoning_effort: null) gives the full budget to the answer
    // and reliably produces content. Only used as a fallback — the initial
    // attempt always reasons normally.
    //
    // Streamed rather than a single blocking call: sarvam-105b's reasoning
    // can take 40-50s+, and the client sees each token as it arrives
    // (rendered live via setStreamingText) instead of a blank wait. The
    // retry/validation logic below still runs on the fully accumulated
    // text once a stream completes — streaming only changes how the text
    // arrives, not when it's judged.
    const callModel = (options: { retryLanguage: boolean; disableReasoning: boolean }) => {
      const apiMessages = buildMessages(options.retryLanguage);
      const inputChars = apiMessages.reduce((sum, m) => sum + m.content.length, 0);
      setStreamingText("");
      setStreamingPhase(null);
      return streamChatMessage(
        apiMessages,
        {
          model: "sarvam-105b",
          temperature: 0.3,
          max_tokens: 4096,
          reasoning_effort: options.disableReasoning ? null : "low",
        },
        (progress) => {
          setStreamingPhase(progress.phase);
          setStreamingText(progress.content);
        }
      ).then((result) => ({ result, inputChars }));
    };

    const MAX_ATTEMPTS = 3;

    try {
      let result, inputChars, rawContent, parsed;
      let attempts = 0;
      let disableReasoningNext = false;

      do {
        attempts += 1;
        ({ result, inputChars } = await callModel({
          retryLanguage: attempts > 1,
          disableReasoning: disableReasoningNext,
        }));
        rawContent = result.content;
        parsed = rawContent ? parseAssistantReply(rawContent) : null;

        if (!parsed) {
          console.warn(`[Chat] empty response (likely reasoning exhausted budget) — attempt ${attempts}/${MAX_ATTEMPTS}, disabling reasoning for retry`);
          disableReasoningNext = true;
          continue;
        }

        if (detectDominantLanguage(parsed.text) !== questionLanguage) {
          console.warn(
            "[Chat] language mismatch — expected",
            questionLanguage,
            "got",
            detectDominantLanguage(parsed.text),
            `— attempt ${attempts}/${MAX_ATTEMPTS}`
          );
          continue;
        }

        break;
      } while (attempts < MAX_ATTEMPTS);

      const latencyMs = Date.now() - startedAt;
      console.log("[Chat] latency:", latencyMs, "attempts:", attempts, "finishReason:", result.finishReason);

      if (!parsed || !rawContent) {
        setChatError("No response was generated. Try rephrasing your question.");
        return;
      }

      const { text, confidence, source } = parsed;
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: text,
          confidence,
          source,
          latencyMs,
          trace: {
            pipeline: ocrLatencyForThisMessage !== null ? "OCR→105B" : "105B",
            ocrLatencyMs: ocrLatencyForThisMessage ?? 0,
            inputChars,
            outputChars: rawContent.length,
            crossLanguage: questionLanguage !== documentLanguage,
          },
        },
      ]);
    } catch (err) {
      console.error("[Chat] failed:", err);
      setChatError(err instanceof Error ? err.message : "Failed to get a response. Try again.");
    } finally {
      setStreamingText(null);
      setStreamingPhase(null);
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !uploadedFile) return;

    const userMessage: DisplayMessage = { id: createId(), role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setOcrError(null);
    setChatError(null);
    setIsLoading(true);

    let docText = extractedText;
    let ocrLatencyForThisMessage: number | null = null;

    if (docText === null) {
      const startedAt = Date.now();
      setOcrStatusText("Extracting text from document...");

      try {
        const result = await runOcrJob(
          uploadedFile,
          (progress) => {
            setOcrStatusText(
              progress.phase === "starting"
                ? "Extracting text from document..."
                : `Processing... (${progress.elapsedSec}s elapsed)`
            );
          },
          OCR_LANGUAGE
        );

        const latency = Date.now() - startedAt;
        console.log("OCR status: FIRST RUN — extracted", result.text.length, "chars");

        onExtractedTextChange(result.text, result.pages);
        setOcrStatusText(`Document processed — ${result.pages} page${result.pages === 1 ? "" : "s"} extracted`);

        await sleep(600);
        setOcrStatusText(null);

        docText = result.text;
        ocrLatencyForThisMessage = latency;
      } catch (err) {
        console.error("[OCR] failed:", err);
        setOcrError(err instanceof Error ? err.message : "Document processing failed. Try a different file.");
        setOcrStatusText(null);
        setIsLoading(false);
        return;
      }
    } else {
      console.log("OCR status: USING CACHED TEXT");
    }

    await askQuestion(nextMessages, docText, ocrLatencyForThisMessage);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isThinking = isLoading && ocrStatusText === null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-1 py-2">
        {messages.length === 0 && !ocrStatusText && !ocrError ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted">
            {hasDocument ? "Ask a question about your document" : "Upload a document to get started"}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} traceEnabled={traceEnabled} onSourceClick={onSourceClick} />
            ))}

            {ocrStatusText && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-card border border-border bg-card px-4 py-2.5 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      ocrStatusText.startsWith("Document processed")
                        ? "bg-accent-secondary"
                        : "animate-pulse bg-accent-primary"
                    }`}
                  />
                  <span
                    className={
                      ocrStatusText.startsWith("Document processed") ? "text-accent-secondary" : "text-accent-primary"
                    }
                  >
                    {ocrStatusText}
                  </span>
                </div>
              </div>
            )}

            {ocrError && (
              <div className="flex justify-start">
                <div className="rounded-card border border-danger/40 bg-card px-4 py-2.5 text-sm text-danger">
                  {ocrError}
                </div>
              </div>
            )}

            {chatError && (
              <div className="flex justify-start">
                <div className="rounded-card border border-danger/40 bg-card px-4 py-2.5 text-sm text-danger">
                  {chatError}
                </div>
              </div>
            )}

            {isThinking && (
              streamingText ? (
                <MessageBubble message={{ id: "streaming", role: "assistant", content: streamingText }} />
              ) : streamingPhase === "thinking" ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-card border border-border bg-card px-4 py-2.5 text-sm">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-accent-primary" />
                    <span className="text-accent-primary">Processing...</span>
                  </div>
                </div>
              ) : (
                <MessageBubble message={{ id: "pending", role: "assistant", content: "" }} isPending />
              )
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <div className="mt-3 flex items-end gap-2 rounded-card border border-border bg-card p-2 transition-colors focus-within:border-accent-primary/50">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={!hasDocument}
            placeholder={hasDocument ? "Ask about your document…" : "Upload a document first…"}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-heading placeholder-muted outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />

          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !hasDocument}
            className="rounded-button bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
