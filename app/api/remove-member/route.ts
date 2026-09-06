import { NextRequest, NextResponse } from "next/server";

// Temporarily disabled: this route's commissioner/admin check trusted a
// client-supplied requestingUserId with no verification it was the actual
// caller, so it was spoofable. Remove members manually via Supabase until
// real session-based auth replaces this check (tracked as a follow-up
// after the live beta).
// Original logic: see git history for this file prior to this commit.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Member removal is temporarily disabled. Contact the admin." },
    { status: 403 }
  );
}
