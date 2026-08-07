"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import DocumentViewer from "./DocumentViewer";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_PDF_PAGES = 10;
const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const TOAST_DURATION_MS = 4000;

interface DocumentUploaderProps {
  onFileReady: (file: File | null) => void;
  extractedText: string | null;
  pageCount: number | null;
}

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

export default function DocumentUploader({ onFileReady, extractedText, pageCount }: DocumentUploaderProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [isUploaded, setIsUploaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (documentPreview) URL.revokeObjectURL(documentPreview);
    };
  }, [documentPreview]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
  };

  const handleFile = useCallback(
    async (file: File) => {
      const ext = getExtension(file.name);

      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        showToast("Unsupported file type. Accepted: PDF, PNG, JPG, TIF");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast("File is too large. Maximum size is 50MB.");
        return;
      }

      if (ext === ".pdf") {
        try {
          const buffer = await file.arrayBuffer();
          const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
          if (pdf.getPageCount() > MAX_PDF_PAGES) {
            showToast("Maximum 10 pages supported.");
            return;
          }
        } catch {
          // Unable to parse locally — let the server validate instead.
        }
      }

      setDocumentPreview(IMAGE_EXTENSIONS.includes(ext) ? URL.createObjectURL(file) : null);
      setUploadedFile(file);
      setIsUploaded(true);
      onFileReady(file);
    },
    [onFileReady]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setUploadedFile(null);
    setDocumentPreview(null);
    setIsUploaded(false);
    onFileReady(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (isUploaded && uploadedFile && extractedText !== null) {
    return (
      <div className="-m-4 flex h-[calc(100%+2rem)] min-h-0 flex-col overflow-hidden rounded-card">
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex-shrink-0 text-base">📄</span>
            <span className="truncate text-sm text-heading">{uploadedFile.name}</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            <span className="whitespace-nowrap rounded-full border border-accent-secondary px-2 py-0.5 text-xs font-medium text-accent-secondary">
              {pageCount ?? 1} page{(pageCount ?? 1) === 1 ? "" : "s"} extracted
            </span>
            <button
              onClick={reset}
              className="text-xs font-medium text-accent-primary transition-opacity hover:opacity-80"
            >
              Replace
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <DocumentViewer extractedText={extractedText} />
        </div>
      </div>
    );
  }

  if (isUploaded && uploadedFile) {
    const isImage = IMAGE_EXTENSIONS.includes(getExtension(uploadedFile.name));

    return (
      <div className="flex h-full flex-col gap-3">
        {isImage && documentPreview ? (
          <div className="flex-1 overflow-hidden rounded-card border border-border bg-background">
            <img
              src={documentPreview}
              alt={uploadedFile.name}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-card border border-border bg-background p-4">
            <span className="text-2xl">📄</span>
            <p className="text-sm text-heading">{uploadedFile.name} — ready to process</p>
          </div>
        )}

        <button
          onClick={reset}
          className="self-start text-xs font-medium text-accent-primary transition-opacity hover:opacity-80"
        >
          Replace document
        </button>

        <p className="text-sm text-muted">Text will appear here after processing</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {toastMessage && (
        <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-button border border-accent-primary bg-card px-4 py-2 text-xs text-accent-primary">
          {toastMessage}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex h-full cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-accent-primary bg-accent-primary/5"
            : "border-border hover:border-accent-primary/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
          className="hidden"
          onChange={onSelect}
        />

        <p className="text-sm text-heading">Drag & drop a document here</p>
        <p className="text-xs text-muted">or click to browse · PDF, PNG, JPG, TIF · up to 50MB</p>
      </div>
    </div>
  );
}
