"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import DocumentUploader from "@/components/DocumentUploader";
import ChatPanel from "@/components/ChatPanel";
import { scrollToSourcePage } from "@/lib/sourceNavigation";

type MobileTab = "chat" | "document";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [traceEnabled, setTraceEnabled] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("chat");
  const [pendingScrollPage, setPendingScrollPage] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    setExtractedText(null);
    setPageCount(null);
  }, [uploadedFile]);

  useEffect(() => {
    if (activeMobileTab === "document" && pendingScrollPage !== null) {
      const target = pendingScrollPage;
      setPendingScrollPage(null);
      requestAnimationFrame(() => scrollToSourcePage(target));
    }
  }, [activeMobileTab, pendingScrollPage]);

  const handleExtractedTextChange = (text: string | null, pages: number | null) => {
    setExtractedText(text);
    setPageCount(pages);
  };

  const handleSourceClick = (pageNumber: number) => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) {
      setActiveMobileTab("document");
      setPendingScrollPage(pageNumber);
    } else {
      scrollToSourcePage(pageNumber);
    }
  };

  if (status === "loading") {
    return (
      <main className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent-primary" />
      </main>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <main className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="font-serif text-xl font-semibold text-heading">DocuSamvad</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTraceEnabled((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              traceEnabled
                ? "border-accent-secondary text-accent-secondary"
                : "border-border text-muted hover:border-accent-secondary/50"
            }`}
          >
            Trace: {traceEnabled ? "ON" : "OFF"}
          </button>
          <span className="text-sm text-muted">{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-body hover:border-accent-primary/50"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row">
        <section
          className={`min-h-0 flex-col rounded-card border border-border bg-card p-4 transition-colors hover:border-accent-primary/30 md:flex md:w-[40%] ${
            activeMobileTab === "document" ? "flex" : "hidden"
          }`}
        >
          <DocumentUploader
            onFileReady={setUploadedFile}
            extractedText={extractedText}
            pageCount={pageCount}
          />
        </section>

        <section
          className={`min-h-0 flex-1 flex-col rounded-card border border-border bg-card p-4 transition-colors hover:border-accent-primary/30 md:flex md:w-[60%] ${
            activeMobileTab === "chat" ? "flex" : "hidden"
          }`}
        >
          <ChatPanel
            uploadedFile={uploadedFile}
            traceEnabled={traceEnabled}
            extractedText={extractedText}
            onExtractedTextChange={handleExtractedTextChange}
            onSourceClick={handleSourceClick}
          />
        </section>
      </div>

      {activeMobileTab === "document" && (
        <button
          onClick={() => setActiveMobileTab("chat")}
          className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-accent-primary bg-card px-4 py-2 text-sm font-medium text-accent-primary md:hidden"
        >
          ← Back to chat
        </button>
      )}
    </main>
  );
}
