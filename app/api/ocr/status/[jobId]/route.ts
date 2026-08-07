import { NextRequest, NextResponse } from "next/server";
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
    const upstreamRes = await fetch(
      `https://api.sarvam.ai/doc-ai/v1/job/${params.jobId}/status`,
      { headers: { "api-subscription-key": apiKey } }
    );

    const data = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      const rawError = data?.error;
      const message =
        (typeof rawError === "string" ? rawError : rawError?.message) ||
        "Document processing failed. Try a different file.";
      return NextResponse.json({ error: message }, { status: upstreamRes.status });
    }

    return NextResponse.json({
      status: data?.status,
      pagesTotal: data?.usage?.pages_total ?? 0,
      pagesSucceeded: data?.usage?.pages_succeeded ?? 0,
      pagesFailed: data?.usage?.pages_failed ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
