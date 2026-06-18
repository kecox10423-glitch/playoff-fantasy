import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_USER_ID = "ae7339be-6503-45c1-91d0-eb09b9806a74";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalize a name for matching: lowercase, strip punctuation and suffixes
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

    // -----------------------------------------------------------------------
    // Step 1: Fetch all 18 weeks of 2025 season stats from Sleeper
    // -----------------------------------------------------------------------
    const weeklyStats: { [playerId: string]: any } = {};

    for (let week = 1; week <= 18; week++) {
      try {
        const res = await fetch(
          `https://api.sleeper.app/v1/stats/nfl/regular/2025/${week}`,
          { next: { revalidate: 0 } }
        );
        if (!res.ok) continue;
        const weekData = await res.json();

        for (const [sleeperId, stats] of Object.entries(weekData as any)) {
          if (!weeklyStats[sleeperId]) {
            weeklyStats[sleeperId] = {
              pass_yards: 0, pass_tds: 0, interceptions: 0,
              pass_attempts: 0, pass_completions: 0, pass_first_downs: 0,
              rush_yards: 0, rush_tds: 0, rush_attempts: 0, rush_first_downs: 0,
              receptions: 0, rec_yards: 0, rec_tds: 0, rec_first_downs: 0,
              fg_made: 0, fg_attempts: 0, xp_made: 0, pat_attempts: 0,
              fg_0_39: 0, fg_40_49: 0, fg_50_plus: 0,
              // DST
              dst_sacks: 0, dst_ints: 0, dst_fumbles_rec: 0,
              dst_tds: 0, dst_points_allowed: 0, dst_tackles: 0, dst_safety: 0,
              // Misc
              fumbles_lost: 0,
              // Track weeks played for DST points-allowed averaging
              dst_weeks: 0,
            };
          }
          const s = stats as any;

          // Passing
          weeklyStats[sleeperId].pass_yards       += s.pass_yd  || 0;
          weeklyStats[sleeperId].pass_tds         += s.pass_td  || 0;
          weeklyStats[sleeperId].interceptions    += s.pass_int || 0;
          weeklyStats[sleeperId].pass_attempts    += s.pass_att || 0;
          weeklyStats[sleeperId].pass_completions += s.pass_cmp || 0;
          weeklyStats[sleeperId].pass_first_downs += s.pass_fd  || 0;

          // Rushing
          weeklyStats[sleeperId].rush_yards       += s.rush_yd  || 0;
          weeklyStats[sleeperId].rush_tds         += s.rush_td  || 0;
          weeklyStats[sleeperId].rush_attempts    += s.rush_att || 0;
          weeklyStats[sleeperId].rush_first_downs += s.rush_fd  || 0;

          // Receiving
          weeklyStats[sleeperId].receptions       += s.rec    || 0;
          weeklyStats[sleeperId].rec_yards        += s.rec_yd || 0;
          weeklyStats[sleeperId].rec_tds          += s.rec_td || 0;
          weeklyStats[sleeperId].rec_first_downs  += s.rec_fd || 0;

          // Kicking
          weeklyStats[sleeperId].fg_made      += s.fgm  || 0;
          weeklyStats[sleeperId].fg_attempts  += s.fga  || 0;
          weeklyStats[sleeperId].xp_made      += s.xpm  || 0;
          weeklyStats[sleeperId].pat_attempts += s.xpa  || 0;
          // FIX: wrap each term in parens to avoid operator precedence bug
          weeklyStats[sleeperId].fg_0_39   += (s.fgm_0_19  || 0) + (s.fgm_20_29 || 0) + (s.fgm_30_39 || 0);
          weeklyStats[sleeperId].fg_40_49  += s.fgm_40_49 || 0;
          weeklyStats[sleeperId].fg_50_plus += s.fgm_50p  || 0;

          // DST — FIX: correct Sleeper field names
          // def_sack, def_int, def_fum_rec, def_td, def_safe are correct
          // dst_points_allowed maps to pts_allow in Sleeper
          // dst_tackles maps to def_tkl in Sleeper
          weeklyStats[sleeperId].dst_sacks       += s.def_sack    || 0;
          weeklyStats[sleeperId].dst_ints        += s.def_int     || 0;
          weeklyStats[sleeperId].dst_fumbles_rec += s.def_fum_rec || 0;
          weeklyStats[sleeperId].dst_tds         += (s.def_td || 0) + (s.def_st_td || 0);
          weeklyStats[sleeperId].dst_tackles     += s.def_tkl     || 0;
          weeklyStats[sleeperId].dst_safety      += s.def_safe    || 0;
          // FIX: pts_allow is the correct Sleeper field for points allowed
          if (s.pts_allow !== undefined && s.pts_allow !== null) {
            weeklyStats[sleeperId].dst_points_allowed += s.pts_allow;
            weeklyStats[sleeperId].dst_weeks += 1;
          }

          // Misc
          weeklyStats[sleeperId].fumbles_lost += s.fum_lost || 0;
        }
      } catch (e) {
        console.error(`Week ${week} failed:`, e);
      }
    }

    // -----------------------------------------------------------------------
    // Step 2: Fetch Sleeper player list to build name → sleeper_id map
    // -----------------------------------------------------------------------
    const sleeperPlayersRes = await fetch("https://api.sleeper.app/v1/players/nfl");
    const sleeperPlayers = await sleeperPlayersRes.json();

    // Primary map: exact normalized name → sleeper_id
    const nameToSleeperId: { [name: string]: string } = {};
    // Secondary map: normalized-no-suffix name → sleeper_id (for suffix mismatches)
    const normalizedToSleeperId: { [name: string]: string } = {};

    for (const [id, player] of Object.entries(sleeperPlayers as any)) {
      const p = player as any;
      if (p.first_name && p.last_name) {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        nameToSleeperId[fullName] = id;

        const normalized = normalizeName(`${p.first_name} ${p.last_name}`);
        // Don't overwrite if already set — first entry wins (usually the active player)
        if (!normalizedToSleeperId[normalized]) {
          normalizedToSleeperId[normalized] = id;
        }
      }
    }

    // DST: Sleeper uses team abbreviations as player IDs in the stats endpoint
    const dstTeamMap: { [abbr: string]: string } = {
      "BAL": "BAL", "BUF": "BUF", "LAC": "LAC", "NE": "NE",
      "KC": "KC",   "HOU": "HOU", "DEN": "DEN",
      "LAR": "LAR", "SEA": "SEA", "SF": "SF",
      "DET": "DET", "PHI": "PHI", "GB": "GB",  "DAL": "DAL",
    };

    // -----------------------------------------------------------------------
    // Step 3: Match each player and upsert stats
    // -----------------------------------------------------------------------
    let matched = 0;
    const unmatched: string[] = [];

    for (const player of players) {
      let stats: any = null;

      if (player.position === "DST") {
        const { data: teamData } = await supabaseAdmin
          .from("nfl_teams")
          .select("abbreviation")
          .eq("id", player.nfl_team_id)
          .single();

        const abbr = teamData?.abbreviation;
        const sleeperId = abbr ? dstTeamMap[abbr] : null;
        stats = sleeperId ? weeklyStats[sleeperId] : null;
      } else {
        // Try 1: exact lowercase match
        const nameLower = player.name.toLowerCase();
        let sleeperId = nameToSleeperId[nameLower];

        // Try 2: normalized match (strips Jr./Sr./suffixes, punctuation)
        if (!sleeperId) {
          const normalized = normalizeName(player.name);
          sleeperId = normalizedToSleeperId[normalized];
        }

        // Try 3: first-last word match only (handles middle names/initials)
        if (!sleeperId) {
          const parts = normalizeName(player.name).split(" ");
          if (parts.length > 2) {
            const firstLast = `${parts[0]} ${parts[parts.length - 1]}`;
            sleeperId = normalizedToSleeperId[firstLast];
          }
        }

        stats = sleeperId ? weeklyStats[sleeperId] : null;
      }

      if (!stats) {
        unmatched.push(player.name);
        continue;
      }

      // Calculate fantasy points (PPR)
      let fantasyPoints = 0;

      if (player.position === "DST") {
        fantasyPoints =
          (stats.dst_sacks       * 1) +
          (stats.dst_ints        * 2) +
          (stats.dst_fumbles_rec * 2) +
          (stats.dst_tds         * 6) +
          (stats.dst_safety      * 2);
        // Points-allowed bonus is per-week and varies; we store cumulative total
        // so skip the sliding-scale here — it's used per-game in actual scoring
      } else {
        fantasyPoints =
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
      }

      await supabaseAdmin
        .from("player_stats")
        .upsert({
          player_id: player.id,
          season: 2026,
          week: 0,
          pass_yards:        stats.pass_yards,
          pass_tds:          stats.pass_tds,
          interceptions:     stats.interceptions,
          pass_attempts:     stats.pass_attempts,
          pass_completions:  stats.pass_completions,
          pass_first_downs:  stats.pass_first_downs,
          rush_yards:        stats.rush_yards,
          rush_tds:          stats.rush_tds,
          rush_attempts:     stats.rush_attempts,
          rush_first_downs:  stats.rush_first_downs,
          receptions:        stats.receptions,
          rec_yards:         stats.rec_yards,
          rec_tds:           stats.rec_tds,
          rec_first_downs:   stats.rec_first_downs,
          fg_made:           stats.fg_made,
          fg_attempts:       stats.fg_attempts,
          xp_made:           stats.xp_made,
          pat_attempts:      stats.pat_attempts,
          fg_0_39:           stats.fg_0_39,
          fg_40_49:          stats.fg_40_49,
          fg_50_plus:        stats.fg_50_plus,
          dst_sacks:         stats.dst_sacks,
          dst_ints:          stats.dst_ints,
          dst_fumbles_rec:   stats.dst_fumbles_rec,
          dst_tds:           stats.dst_tds,
          dst_points_allowed: stats.dst_weeks > 0
            ? Math.round(stats.dst_points_allowed / stats.dst_weeks)
            : 0,
          dst_tackles:       stats.dst_tackles,
          dst_safety:        stats.dst_safety,
          fumbles_lost:      stats.fumbles_lost,
          fantasy_points:    Math.round(fantasyPoints * 10) / 10,
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