import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

// Vercel kills serverless functions after 10s by default. The chat route
// calls a reasoning model (sarvam-105b) and the client retries up to 3
// times on empty/language-mismatched responses, which can exceed that —
// extend to the max Vercel allows on the Hobby plan.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
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
    const body = await req.json();

    const upstreamRes = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      const status = upstreamRes.status;
      const message =
        data?.error ??
        (status === 429
          ? "Sarvam API rate limit exceeded"
          : status === 400
            ? "Invalid chat request"
            : "Sarvam chat completion failed");
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
