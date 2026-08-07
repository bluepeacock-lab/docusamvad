import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";

export async function checkAuth(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
