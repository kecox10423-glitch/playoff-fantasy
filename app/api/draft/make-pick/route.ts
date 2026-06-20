import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("make-pick body:", JSON.stringify(body));

    const { leagueId, userId, playerId, pickNumber, round, pickInRound, isAutoPick } = body;

    if (!leagueId || !userId || !playerId || !pickNumber) {
      console.log("make-pick missing fields:", { leagueId, userId, playerId, pickNumber });
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from("draft_picks").select("id")
      .eq("league_id", leagueId).eq("player_id", playerId).single();
    if (existing) return NextResponse.json({ error: "Player already picked" }, { status: 409 });

    const { data: existingPick } = await supabaseAdmin
      .from("draft_picks").select("id")
      .eq("league_id", leagueId).eq("pick_number", pickNumber).single();
    if (existingPick) return NextResponse.json({ error: "Pick already made" }, { status: 409 });

    const { error: insertError } = await supabaseAdmin
      .from("draft_picks")
      .insert({
        league_id: leagueId,
        user_id: userId,
        player_id: playerId,
        pick_number: pickNumber,
        round,
        pick_in_round: pickInRound,
        is_auto_pick: isAutoPick || false,
      });
    console.log("insert error:", insertError?.message, insertError?.details);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { data: league } = await supabaseAdmin
      .from("leagues").select("num_teams").eq("id", leagueId).single();
    const { count } = await supabaseAdmin
      .from("draft_picks").select("id", { count: "exact" }).eq("league_id", leagueId);
    const totalPicks = (league?.num_teams || 0) * 15;
    console.log("pick count:", count, "total needed:", totalPicks);

    if (count && count >= totalPicks) {
      await supabaseAdmin.from("leagues").update({ draft_status: "COMPLETED" }).eq("id", leagueId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.log("make-pick caught error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}