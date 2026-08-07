"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { renderInlineMarkdown } from "@/lib/markdown";
import { parseSourcePageNumber } from "@/lib/sourceNavigation";
import { estimateCostInr, estimateTokens } from "@/lib/sarvam";
import type { DisplayMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: DisplayMessage;
  isPending?: boolean;
  traceEnabled?: boolean;
  onSourceClick?: (pageNumber: number) => void;
}

function renderContent(content: string): ReactNode[] {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="ml-4 list-disc space-y-1 marker:text-muted">
          {listItems.map((item, i) => (
            <li key={i}>{renderInlineMarkdown(item, `li-${blocks.length}-${i}`)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
    } else {
      flushList();
      if (trimmed.length === 0) {
        blocks.push(<div key={`gap-${i}`} className="h-2" />);
      } else {
        blocks.push(<p key={`p-${i}`}>{renderInlineMarkdown(line, `p-${i}`)}</p>);
      }
    }
  });
  flushList();

  return blocks;
}

function getConfidenceStyles(confidence: number): string {
  if (confidence >= 80) return "text-accent-secondary border-accent-secondary";
  if (confidence >= 50) return "text-warning border-warning";
  return "text-danger border-danger";
}

function getLatencyColor(ms: number): string {
  const sec = ms / 1000;
  if (sec < 3) return "text-accent-secondary";
  if (sec <= 8) return "text-warning";
  return "text-danger";
}

function formatLatency(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function TraceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-pulse rounded-full bg-accent-primary"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </div>
  );
}

function ThumbsUpIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
}

export default function MessageBubble({ message, isPending, traceEnabled, onSourceClick }: MessageBubbleProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const isUser = message.role === "user";
  const trace = message.trace;
  const llmLatencyMs = message.latencyMs ?? 0;
  const totalLatencyMs = (trace?.ocrLatencyMs ?? 0) + llmLatencyMs;
  const sourcePageNumber = message.source ? parseSourcePageNumber(message.source) : null;

  const handleSourceClick = () => {
    if (sourcePageNumber === null) return;
    onSourceClick?.(sourcePageNumber);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-card px-4 py-2.5 text-sm leading-relaxed ${
          isUser ? "bg-accent-primary/10 text-heading" : "border border-border bg-card text-body"
        }`}
      >
        {isPending ? (
          <LoadingDots />
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <div className="space-y-1">{renderContent(message.content)}</div>

            {(message.confidence !== undefined || message.source) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                {message.confidence !== undefined && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getConfidenceStyles(message.confidence)}`}
                  >
                    {message.confidence}% confidence
                  </span>
                )}
                {message.source && sourcePageNumber !== null ? (
                  <button
                    onClick={handleSourceClick}
                    className="text-xs text-muted transition-colors hover:text-accent-primary hover:underline"
                  >
                    📍 Source: {message.source}
                  </button>
                ) : (
                  message.source && <span className="text-xs text-muted">Source: {message.source}</span>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => setFeedback((f) => (f === "up" ? null : "up"))}
                aria-label="Good response"
                className={`transition-colors ${
                  feedback === "up" ? "text-accent-secondary" : "text-muted hover:text-body"
                }`}
              >
                <ThumbsUpIcon />
              </button>
              <button
                onClick={() => setFeedback((f) => (f === "down" ? null : "down"))}
                aria-label="Bad response"
                className={`transition-colors ${
                  feedback === "down" ? "text-danger" : "text-muted hover:text-body"
                }`}
              >
                <ThumbsDownIcon />
              </button>
            </div>

            {traceEnabled && trace && (
              <div className="mt-2 border-t border-border pt-2">
                <button
                  onClick={() => setTraceOpen((v) => !v)}
                  className="font-mono text-xs text-muted transition-colors hover:text-body"
                >
                  {traceOpen ? "▼" : "▶"} Trace
                </button>

                {traceOpen && (
                  <div className="-mx-4 mt-2 space-y-1 border-t border-border bg-surface px-4 py-3 font-mono text-[11px] text-body">
                    <TraceRow label="Trace ID">{message.id}</TraceRow>
                    <TraceRow label="Pipeline">{trace.pipeline}</TraceRow>
                    <TraceRow label="OCR Latency">
                      {trace.pipeline === "OCR→105B" ? (
                        <span className={getLatencyColor(trace.ocrLatencyMs)}>{formatLatency(trace.ocrLatencyMs)}</span>
                      ) : (
                        "—"
                      )}
                    </TraceRow>
                    <TraceRow label="LLM Latency">
                      <span className={getLatencyColor(llmLatencyMs)}>{formatLatency(llmLatencyMs)}</span>
                    </TraceRow>
                    <TraceRow label="Total Latency">
                      <span className={getLatencyColor(totalLatencyMs)}>{formatLatency(totalLatencyMs)}</span>
                    </TraceRow>
                    <TraceRow label="Input Tokens">{estimateTokens(trace.inputChars)}</TraceRow>
                    <TraceRow label="Output Tokens">{estimateTokens(trace.outputChars)}</TraceRow>
                    <TraceRow label="Cost Estimate">
                      ₹{estimateCostInr(trace.inputChars, trace.outputChars).toFixed(6)}
                    </TraceRow>
                    <TraceRow label="Cross-language">{trace.crossLanguage ? "Yes" : "No"}</TraceRow>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
