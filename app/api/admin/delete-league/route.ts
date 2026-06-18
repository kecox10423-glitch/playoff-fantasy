import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_USER_ID = "ae7339be-6503-45c1-91d0-eb09b9806a74";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, leagueId } = await req.json();

    if (userId !== ADMIN_USER_ID) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (!leagueId) {
      return NextResponse.json({ error: "Missing leagueId" }, { status: 400 });
    }

    // Delete in order to respect foreign key constraints
    await supabaseAdmin.from("draft_chat_messages").delete().eq("league_id", leagueId);
    await supabaseAdmin.from("draft_picks").delete().eq("league_id", leagueId);
    await supabaseAdmin.from("scores").delete().eq("league_id", leagueId);
    await supabaseAdmin.from("standings").delete().eq("league_id", leagueId);
    await supabaseAdmin.from("league_members").delete().eq("league_id", leagueId);
    await supabaseAdmin.from("leagues").delete().eq("id", leagueId);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}