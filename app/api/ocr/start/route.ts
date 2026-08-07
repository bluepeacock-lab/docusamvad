import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

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
    const formData = await req.formData();
    const file = formData.get("file");
    const language = (formData.get("language") as string) || "en-IN";
    const outputFormat = (formData.get("output_format") as string) || "md";

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const upstreamForm = new FormData();
    upstreamForm.append("file", file, (file as File).name ?? "document");
    upstreamForm.append("language", language);
    upstreamForm.append("output_format", outputFormat);

    const upstreamRes = await fetch("https://api.sarvam.ai/doc-ai/v1/job/digitise", {
      method: "POST",
      headers: { "api-subscription-key": apiKey },
      body: upstreamForm,
    });

    const data = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      const status = upstreamRes.status;
      const rawError = data?.error;
      const rawMessage = typeof rawError === "string" ? rawError : rawError?.message;

      let message = rawMessage || "Document processing failed. Try a different file.";
      if (status === 413) {
        message = "File exceeds size limit.";
      } else if (status === 400 && /page/i.test(rawMessage || "")) {
        message = "Maximum 10 pages supported.";
      }

      return NextResponse.json({ error: message }, { status });
    }

    const jobId = data?.job_id ?? data?.jobId;
    if (!jobId) {
      return NextResponse.json(
        { error: "Sarvam Doc AI did not return a job id" },
        { status: 500 }
      );
    }

    return NextResponse.json({ jobId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
