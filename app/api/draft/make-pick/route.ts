import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { leagueId, userId, playerId, pickNumber, round, pickInRound, isAutoPick } = await req.json();

    if (!leagueId || !userId || !playerId || !pickNumber) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Check player not already picked
    const { data: existing } = await supabaseAdmin
      .from("draft_picks")
      .select("id")
      .eq("league_id", leagueId)
      .eq("player_id", playerId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Player already picked" }, { status: 409 });
    }

    // Check pick number not already taken
    const { data: existingPick } = await supabaseAdmin
      .from("draft_picks")
      .select("id")
      .eq("league_id", leagueId)
      .eq("pick_number", pickNumber)
      .single();

    if (existingPick) {
      return NextResponse.json({ error: "Pick already made" }, { status: 409 });
    }

    // Insert the pick
    const { error } = await supabaseAdmin
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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check if draft is complete and update status
    const { data: league } = await supabaseAdmin
      .from("leagues")
      .select("num_teams")
      .eq("id", leagueId)
      .single();

    const { count } = await supabaseAdmin
      .from("draft_picks")
      .select("id", { count: "exact" })
      .eq("league_id", leagueId);

    const totalPicks = (league?.num_teams || 0) * 15;
    if (count && count >= totalPicks) {
      await supabaseAdmin
        .from("leagues")
        .update({ draft_status: "COMPLETED" })
        .eq("id", leagueId);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}