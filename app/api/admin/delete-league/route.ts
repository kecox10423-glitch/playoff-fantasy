import { NextRequest, NextResponse } from "next/server";

// Temporarily disabled: this route's auth trusted a client-supplied userId
// with no verification, and the admin ID it checked against is exposed
// client-side (see app/admin/leagues/page.tsx), so it was spoofable by
// anyone. Delete leagues manually via Supabase until real session-based
// auth replaces this check (tracked as a follow-up after the live beta).
// Original logic: see git history for this file prior to this commit.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "League deletion is temporarily disabled. Contact the admin." },
    { status: 403 }
  );
}
