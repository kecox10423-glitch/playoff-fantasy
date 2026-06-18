import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_USER_ID = "ae7339be-6503-45c1-91d0-eb09b9806a74";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SLEEPER_ID_OVERRIDES: { [nameLower: string]: string } = {
  "lamar jackson": "4881",
  "devonta smith": "7525",
};

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

    const { data: players } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("season", 2026);

    if (!players?.length) {
      return NextResponse.json({ error: "No players found" }, { status: 400 });
    }

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
              // DST display stats
              dst_sacks: 0, dst_ints: 0, dst_fumbles_rec: 0,
              dst_tds: 0, dst_points_allowed: 0, dst_tackles: 0, dst_safety: 0,
              // DST scoring — Sleeper calculates this for us
              dst_fantasy_points: 0,
              fumbles_lost: 0,
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
          weeklyStats[sleeperId].fg_0_39      += (s.fgm_0_19  || 0) + (s.fgm_20_29 || 0) + (s.fgm_30_39 || 0);
          weeklyStats[sleeperId].fg_40_49     += s.fgm_40_49 || 0;
          weeklyStats[sleeperId].fg_50_plus   += s.fgm_50p   || 0;

          // DST display stats (tackles shown in UI but not scored)
          weeklyStats[sleeperId].dst_sacks       += s.sack    || 0;
          weeklyStats[sleeperId].dst_ints        += s.int     || 0;
          weeklyStats[sleeperId].dst_fumbles_rec += s.fum_rec || 0;
          weeklyStats[sleeperId].dst_tackles     += s.tkl     || 0;
          weeklyStats[sleeperId].dst_safety      += s.safe    || 0;
          weeklyStats[sleeperId].dst_points_allowed += s.pts_allow || 0;

          // DST fantasy points — use Sleeper's pre-calculated value (pts_std)
          // This already includes sacks, ints, TDs, safeties, fumbles, points allowed
          weeklyStats[sleeperId].dst_fantasy_points += s.pts_std || 0;

          // Misc
          weeklyStats[sleeperId].fumbles_lost += s.fum_lost || 0;
        }
      } catch (e) {
        console.error(`Week ${week} failed:`, e);
      }
    }

    const sleeperPlayersRes = await fetch("https://api.sleeper.app/v1/players/nfl");
    const sleeperPlayers = await sleeperPlayersRes.json();

    const nameToSleeperId: { [name: string]: string } = {};
    const normalizedToSleeperId: { [name: string]: string } = {};

    for (const [id, player] of Object.entries(sleeperPlayers as any)) {
      const p = player as any;
      if (p.first_name && p.last_name) {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        nameToSleeperId[fullName] = id;
        const normalized = normalizeName(`${p.first_name} ${p.last_name}`);
        if (!normalizedToSleeperId[normalized]) {
          normalizedToSleeperId[normalized] = id;
        }
      }
    }

    const dstTeamMap: { [abbr: string]: string } = {
      "BAL": "BAL", "BUF": "BUF", "LAC": "LAC", "NE": "NE",
      "KC": "KC",   "HOU": "HOU", "DEN": "DEN",
      "LAR": "LAR", "SEA": "SEA", "SF": "SF",
      "DET": "DET", "PHI": "PHI", "GB": "GB",  "DAL": "DAL",
    };

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
        const nameLower = player.name.toLowerCase();
        let sleeperId = SLEEPER_ID_OVERRIDES[nameLower];
        if (!sleeperId) sleeperId = nameToSleeperId[nameLower];
        if (!sleeperId) {
          const normalized = normalizeName(player.name);
          sleeperId = normalizedToSleeperId[normalized];
        }
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

      let fantasyPoints = 0;

      if (player.position === "DST") {
        // Use Sleeper's pre-calculated DST fantasy points — already accounts for
        // sacks, ints, fumble recoveries, TDs, safeties, and points allowed scale
        fantasyPoints = stats.dst_fantasy_points;
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
          pass_yards:         stats.pass_yards,
          pass_tds:           stats.pass_tds,
          interceptions:      stats.interceptions,
          pass_attempts:      stats.pass_attempts,
          pass_completions:   stats.pass_completions,
          pass_first_downs:   stats.pass_first_downs,
          rush_yards:         stats.rush_yards,
          rush_tds:           stats.rush_tds,
          rush_attempts:      stats.rush_attempts,
          rush_first_downs:   stats.rush_first_downs,
          receptions:         stats.receptions,
          rec_yards:          stats.rec_yards,
          rec_tds:            stats.rec_tds,
          rec_first_downs:    stats.rec_first_downs,
          fg_made:            stats.fg_made,
          fg_attempts:        stats.fg_attempts,
          xp_made:            stats.xp_made,
          pat_attempts:       stats.pat_attempts,
          fg_0_39:            stats.fg_0_39,
          fg_40_49:           stats.fg_40_49,
          fg_50_plus:         stats.fg_50_plus,
          dst_sacks:          stats.dst_sacks,
          dst_ints:           stats.dst_ints,
          dst_fumbles_rec:    stats.dst_fumbles_rec,
          dst_tds:            0,
          dst_points_allowed: stats.dst_points_allowed,
          dst_tackles:        stats.dst_tackles,
          dst_safety:         stats.dst_safety,
          fumbles_lost:       stats.fumbles_lost,
          fantasy_points:     Math.round(fantasyPoints * 10) / 10,
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