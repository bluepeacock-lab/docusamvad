import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { checkAuth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authError = await checkAuth();
  if (authError) return authError;

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfigured: missing SARVAM_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const urlRes = await fetch(
      `https://api.sarvam.ai/doc-ai/v1/job/${params.jobId}/download-url`,
      { headers: { "api-subscription-key": apiKey } }
    );

    if (!urlRes.ok) {
      const data = await urlRes.json().catch(() => null);
      const rawError = data?.error;
      const message =
        (typeof rawError === "string" ? rawError : rawError?.message) ||
        "Document processing failed. Try a different file.";
      return NextResponse.json({ error: message }, { status: urlRes.status });
    }

    const { url: signedUrl, headers: signedHeaders } = await urlRes.json();
    if (!signedUrl) {
      return NextResponse.json(
        { error: "Document processing failed. Try a different file." },
        { status: 500 }
      );
    }

    const fileRes = await fetch(signedUrl, { headers: signedHeaders ?? {} });
    if (!fileRes.ok) {
      return NextResponse.json(
        { error: "Document processing failed. Try a different file." },
        { status: 502 }
      );
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const zip = new AdmZip(Buffer.from(arrayBuffer));
    const entries = zip.getEntries();

    const mdEntry = entries.find((e) => e.entryName.toLowerCase().endsWith(".md"));
    if (!mdEntry) {
      return NextResponse.json(
        { error: "Document processing failed. Try a different file." },
        { status: 500 }
      );
    }

    const text = mdEntry.getData().toString("utf-8");

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "Document processing failed. Try a different file." },
      { status: 500 }
    );
  }
}
