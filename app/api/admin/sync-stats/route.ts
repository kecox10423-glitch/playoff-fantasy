import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_USER_ID = "ae7339be-6503-45c1-91d0-eb09b9806a74";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (userId !== ADMIN_USER_ID) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get all players from our database
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("season", 2026);

    if (!players?.length) {
      return NextResponse.json({ error: "No players found" }, { status: 400 });
    }

    // Fetch all 18 weeks of 2025 season stats from Sleeper
    const weeklyStats: { [playerId: string]: any } = {};

    for (let week = 1; week <= 18; week++) {
      try {
        const res = await fetch(
          `https://api.sleeper.app/v1/stats/nfl/regular/2025/${week}`,
          { next: { revalidate: 0 } }
        );
        if (!res.ok) continue;
        const weekData = await res.json();

        // Accumulate stats by Sleeper player ID
        for (const [sleeperId, stats] of Object.entries(weekData as any)) {
          if (!weeklyStats[sleeperId]) {
            weeklyStats[sleeperId] = {
              pass_yards: 0, pass_tds: 0, interceptions: 0,
              rush_yards: 0, rush_tds: 0,
              receptions: 0, rec_yards: 0, rec_tds: 0,
              fg_made: 0, xp_made: 0,
              dst_sacks: 0, dst_ints: 0, dst_fumbles_rec: 0,
              dst_tds: 0, dst_points_allowed: 0,
              fumbles_lost: 0,
            };
          }
          const s = stats as any;
          weeklyStats[sleeperId].pass_yards += s.pass_yd || 0;
          weeklyStats[sleeperId].pass_tds += s.pass_td || 0;
          weeklyStats[sleeperId].interceptions += s.pass_int || 0;
          weeklyStats[sleeperId].rush_yards += s.rush_yd || 0;
          weeklyStats[sleeperId].rush_tds += s.rush_td || 0;
          weeklyStats[sleeperId].receptions += s.rec || 0;
          weeklyStats[sleeperId].rec_yards += s.rec_yd || 0;
          weeklyStats[sleeperId].rec_tds += s.rec_td || 0;
          weeklyStats[sleeperId].fg_made += s.fgm || 0;
          weeklyStats[sleeperId].xp_made += s.xpm || 0;
          weeklyStats[sleeperId].dst_sacks += s.def_sack || 0;
          weeklyStats[sleeperId].dst_ints += s.def_int || 0;
          weeklyStats[sleeperId].dst_fumbles_rec += s.def_fum_rec || 0;
          weeklyStats[sleeperId].dst_tds += s.def_td || 0;
          weeklyStats[sleeperId].fumbles_lost += s.fum_lost || 0;
        }
      } catch (e) {
        console.error(`Week ${week} failed:`, e);
      }
    }

    // Now fetch Sleeper player list to map names to IDs
    const sleeperPlayersRes = await fetch(
      "https://api.sleeper.app/v1/players/nfl"
    );
    const sleeperPlayers = await sleeperPlayersRes.json();

    // Build name -> sleeper_id map
    const nameToSleeperId: { [name: string]: string } = {};
    for (const [id, player] of Object.entries(sleeperPlayers as any)) {
      const p = player as any;
      if (p.first_name && p.last_name) {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        nameToSleeperId[fullName] = id;
      }
    }

    // Match our players to Sleeper IDs and insert stats
    let matched = 0;
    let unmatched: string[] = [];

    for (const player of players) {
      if (player.position === "DST") {
        // DST uses team abbreviation in Sleeper
        // Skip for now — handle separately
        continue;
      }

      const nameLower = player.name.toLowerCase();
      const sleeperId = nameToSleeperId[nameLower];

      if (!sleeperId || !weeklyStats[sleeperId]) {
        unmatched.push(player.name);
        continue;
      }

      const stats = weeklyStats[sleeperId];

      // Calculate fantasy points (PPR)
      const fantasyPoints =
        (stats.pass_yards / 20) +
        (stats.pass_tds * 4) -
        (stats.interceptions * 1) +
        (stats.rush_yards / 10) +
        (stats.rush_tds * 6) +
        (stats.receptions * 1) +
        (stats.rec_yards / 10) +
        (stats.rec_tds * 6) +
        (stats.fg_made * 3) +
        (stats.xp_made * 1) -
        (stats.fumbles_lost * 2);

      // Upsert into player_stats (season total as week 0)
      await supabaseAdmin
        .from("player_stats")
        .upsert({
          player_id: player.id,
          season: 2026,
          week: 0, // 0 = full season total
          ...stats,
          fantasy_points: Math.round(fantasyPoints * 10) / 10,
        }, { onConflict: "player_id,season,week" });

      matched++;
    }

    return NextResponse.json({
      success: true,
      matched,
      unmatched,
      total: players.length,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}