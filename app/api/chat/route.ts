import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

// 300s is Vercel Hobby's actual default AND max duration (with Fluid
// Compute) — setting it any lower, as a previous version of this file
// mistakenly did (60s), silently caps requests below what the plan
// already allows. sarvam-105b's reasoning + a large document context can
// legitimately take longer than a minute, so this must stay at the max.
export const maxDuration = 300;

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
