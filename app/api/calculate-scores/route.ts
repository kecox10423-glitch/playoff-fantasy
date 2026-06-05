import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Use service role key to bypass RLS for server-side writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function calculateFantasyPoints(stats: any, scoringFormat: string) {
  let points = 0;

  points += (stats.pass_yards || 0) / 20;
  points += (stats.pass_tds || 0) * 4;
  points -= (stats.interceptions || 0) * 1;

  points += (stats.rush_yards || 0) / 10;
  points += (stats.rush_tds || 0) * 6;

  points += (stats.rec_yards || 0) / 10;
  points += (stats.rec_tds || 0) * 6;

  if (scoringFormat === "PPR") {
    points += (stats.receptions || 0) * 1;
  } else if (scoringFormat === "HALF_PPR") {
    points += (stats.receptions || 0) * 0.5;
  }

  points += (stats.fg_made || 0) * 3;
  points += (stats.xp_made || 0) * 1;

  points += (stats.dst_sacks || 0) * 1;
  points += (stats.dst_ints || 0) * 2;
  points += (stats.dst_fumbles_rec || 0) * 2;
  points += (stats.dst_tds || 0) * 6;

  const pa = stats.dst_points_allowed || 0;
  if (pa === 0) points += 10;
  else if (pa <= 6) points += 7;
  else if (pa <= 13) points += 4;
  else if (pa <= 20) points += 1;
  else if (pa <= 27) points += 0;
  else points -= 1;

  points -= (stats.fumbles_lost || 0) * 2;

  return points;
}

export async function POST(request: Request) {
  const { week } = await request.json();

  const { data: leagues, error: leaguesError } = await supabase
    .from("leagues")
    .select("*")
    .eq("league_status", "ACTIVE");

  if (leaguesError) return NextResponse.json({ error: leaguesError.message });
  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ message: "No active leagues" });
  }

  const { data: playerStats } = await supabase
    .from("player_stats")
    .select("*")
    .eq("week", week);

  for (const league of leagues) {
    const { data: members } = await supabase
      .from("league_members")
      .select("*")
      .eq("league_id", league.id);

    if (!members) continue;

    for (const member of members) {
      const { data: picks } = await supabase
        .from("draft_picks")
        .select("player_id")
        .eq("league_id", league.id)
        .eq("user_id", member.user_id);

      if (!picks) continue;

      let weekPoints = 0;
      let activePlayers = 0;

      for (const pick of picks) {
        const { data: player } = await supabase
          .from("players")
          .select("is_active")
          .eq("id", pick.player_id)
          .single();

        if (!player?.is_active) continue;
        activePlayers++;

        const stats = playerStats?.find(s => s.player_id === pick.player_id);
        if (stats) {
          weekPoints += calculateFantasyPoints(stats, league.scoring_format);
        }
      }

      await supabase.from("scores").upsert({
        league_id: league.id,
        user_id: member.user_id,
        week,
        total_points: weekPoints,
        active_players: activePlayers,
      });

      const { data: allScores } = await supabase
        .from("scores")
        .select("*")
        .eq("league_id", league.id)
        .eq("user_id", member.user_id);

      const totalPoints = allScores?.reduce((sum, s) => sum + s.total_points, 0) || 0;

      await supabase.from("standings").upsert({
        league_id: league.id,
        user_id: member.user_id,
        total_points: totalPoints,
        week_1_points: allScores?.find(s => s.week === 1)?.total_points || 0,
        week_2_points: allScores?.find(s => s.week === 2)?.total_points || 0,
        week_3_points: allScores?.find(s => s.week === 3)?.total_points || 0,
        week_4_points: allScores?.find(s => s.week === 4)?.total_points || 0,
      });
    }
  }

  return NextResponse.json({ message: `Scores calculated for week ${week}` });
}