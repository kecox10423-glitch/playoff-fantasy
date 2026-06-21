import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_USER_ID = "ae7339be-6503-45c1-91d0-eb09b9806a74";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ROUND_ORDER = ["WC", "DIV", "CC", "SB"];
const NEXT_ROUND: { [k: string]: string } = { WC: "DIV", DIV: "CC", CC: "SB" };

const DIV_TIMES = ["3:30 PM ET", "7:15 PM ET", "3:30 PM ET", "7:15 PM ET"];
const CC_TIMES  = ["3:00 PM ET", "6:30 PM ET"];
const SB_TIME   = "6:30 PM ET";

const DIV_DATES = { AFC: "2027-01-18", NFC: "2027-01-19" };
const CC_DATE   = "2027-01-26";
const SB_DATE   = "2027-02-02";

const ROUND_TO_NFL_WEEK: { [r: string]: number } = {
  WC: 1, DIV: 2, CC: 3, SB: 4,
};
const ROUND_TO_DB_WEEK: { [r: string]: number } = {
  WC: 1, DIV: 2, CC: 3, SB: 4,
};

const ESPN_ABR_MAP: { [k: string]: string } = {
  BAL: "BAL", BUF: "BUF", LAC: "LAC", NE: "NE",
  KC: "KC", HOU: "HOU", DEN: "DEN",
  LAR: "LAR", SEA: "SEA", SF: "SF",
  DET: "DET", PHI: "PHI", GB: "GB", DAL: "DAL",
};

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

const DEFAULT_SETTINGS = {
  passing_yards_per_point: 20,
  passing_td: 4,
  interception: -1,
  passing_2pt: 2,
  rushing_yards_per_point: 10,
  rushing_td: 6,
  rushing_fumble_lost: -2,
  rushing_100_bonus: 0,
  rushing_150_bonus: 0,
  rushing_200_bonus: 0,
  receiving_yards_per_point: 10,
  receiving_td: 6,
  receiving_reception: 1,
  receiving_fumble_lost: -2,
  receiving_100_bonus: 0,
  receiving_150_bonus: 0,
  receiving_200_bonus: 0,
  fg_0_39: 3,
  fg_40_49: 4,
  fg_50_59: 5,
  fg_60_plus: 6,
  fg_miss_0_39: -1,
  fg_miss_40_plus: 0,
  xp_made: 1,
  xp_missed: -1,
  dst_sack: 1,
  dst_interception: 2,
  dst_fumble_recovery: 2,
  dst_td: 6,
  dst_safety: 2,
  dst_blocked_kick: 2,
  dst_return_td: 6,
  dst_pa_0: 10,
  dst_pa_1_6: 7,
  dst_pa_7_13: 4,
  dst_pa_14_20: 1,
  dst_pa_21_27: 0,
  dst_pa_28_plus: -1,
};

function getSettings(league: any) {
  return { ...DEFAULT_SETTINGS, ...(league.scoring_settings || {}) };
}

function calcPlayerPoints(stats: any, position: string, s: any): number {
  if (!stats) return 0;

  if (position === "DST") {
    let pts = 0;
    pts += (stats.dst_sacks || 0) * s.dst_sack;
    pts += (stats.dst_ints || 0) * s.dst_interception;
    pts += (stats.dst_fumbles_rec || 0) * s.dst_fumble_recovery;
    pts += (stats.dst_tds || 0) * s.dst_td;
    pts += (stats.dst_safety || 0) * s.dst_safety;
    const pa = stats.dst_points_allowed || 0;
    if (pa === 0)      pts += s.dst_pa_0;
    else if (pa <= 6)  pts += s.dst_pa_1_6;
    else if (pa <= 13) pts += s.dst_pa_7_13;
    else if (pa <= 20) pts += s.dst_pa_14_20;
    else if (pa <= 27) pts += s.dst_pa_21_27;
    else               pts += s.dst_pa_28_plus;
    return pts;
  }

  if (position === "K") {
    let pts = 0;
    pts += (stats.fg_0_39   || 0) * s.fg_0_39;
    pts += (stats.fg_40_49  || 0) * s.fg_40_49;
    pts += (stats.fg_50_plus || 0) * s.fg_50_59;
    pts += (stats.xp_made   || 0) * s.xp_made;
    return pts;
  }

  let pts = 0;
  pts += (stats.pass_yards    || 0) / s.passing_yards_per_point;
  pts += (stats.pass_tds      || 0) * s.passing_td;
  pts += (stats.interceptions || 0) * s.interception;
  pts += (stats.rush_yards    || 0) / s.rushing_yards_per_point;
  pts += (stats.rush_tds      || 0) * s.rushing_td;
  if      ((stats.rush_yards || 0) >= 200) pts += s.rushing_200_bonus;
  else if ((stats.rush_yards || 0) >= 150) pts += s.rushing_150_bonus;
  else if ((stats.rush_yards || 0) >= 100) pts += s.rushing_100_bonus;
  pts += (stats.receptions || 0) * s.receiving_reception;
  pts += (stats.rec_yards  || 0) / s.receiving_yards_per_point;
  pts += (stats.rec_tds    || 0) * s.receiving_td;
  if      ((stats.rec_yards || 0) >= 200) pts += s.receiving_200_bonus;
  else if ((stats.rec_yards || 0) >= 150) pts += s.receiving_150_bonus;
  else if ((stats.rec_yards || 0) >= 100) pts += s.receiving_100_bonus;
  pts += (stats.fumbles_lost || 0) * s.rushing_fumble_lost;
  return pts;
}

function buildFloatingMatchups(
  byeTeam: { id: number; seed: number },
  wcWinners: { id: number; seed: number }[]
): [number, number][] {
  const sorted = [...wcWinners].sort((a, b) => a.seed - b.seed);
  return [
    [byeTeam.id, sorted[sorted.length - 1].id],
    [sorted[0].id, sorted[sorted.length - 2].id],
    [sorted[1].id, sorted[sorted.length - 3].id],
  ];
}

async function runSync(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = body;

    const cronSecret = req.headers.get("authorization");
    const isAdmin = userId === ADMIN_USER_ID;
    const isCron  = cronSecret === `Bearer ${process.env.CRON_SECRET}`;
    if (!isAdmin && !isCron) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const season = 2026;

    // ── 1. Load DB state ──────────────────────────────────────────────────
    const { data: dbGames } = await supabaseAdmin
      .from("playoff_games")
      .select("*")
      .eq("season", season);

    const { data: allTeams } = await supabaseAdmin
      .from("nfl_teams")
      .select("*")
      .eq("season", season);

    if (!allTeams?.length) {
      return NextResponse.json({ error: "No teams found" }, { status: 500 });
    }

    const teamByAbbr: { [abbr: string]: any } = {};
    const teamById:   { [id: number]: any }   = {};
    allTeams.forEach(t => {
      teamByAbbr[t.abbreviation] = t;
      teamById[t.id] = t;
    });

    // ── 2. Pull real NFL team scores from ESPN ────────────────────────────
    const teamScoresByWeek: { [week: number]: { [abbr: string]: number } } = {};
    const weekIsComplete: { [week: number]: boolean } = {};

    for (const round of ROUND_ORDER) {
      const nflWeek = ROUND_TO_NFL_WEEK[round];

      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${nflWeek}&season=${season}`;
        const res = await fetch(url, { next: { revalidate: 0 } });
        if (!res.ok) continue;
        const data = await res.json();

        if (!teamScoresByWeek[nflWeek]) teamScoresByWeek[nflWeek] = {};

        let allFinal = true;
        let anyGames = false;

        for (const event of (data.events || [])) {
          const comp = event.competitions?.[0];
          if (!comp) continue;
          anyGames = true;

          const isFinal = comp.status?.type?.completed === true;
          if (!isFinal) allFinal = false;

          const home = comp.competitors?.find((c: any) => c.homeAway === "home");
          const away = comp.competitors?.find((c: any) => c.homeAway === "away");
          if (!home || !away) continue;

          const homeAbbr = ESPN_ABR_MAP[home.team?.abbreviation] || home.team?.abbreviation;
          const awayAbbr = ESPN_ABR_MAP[away.team?.abbreviation] || away.team?.abbreviation;

          if (teamByAbbr[homeAbbr]) {
            teamScoresByWeek[nflWeek][homeAbbr] = parseFloat(home.score || "0");
          }
          if (teamByAbbr[awayAbbr]) {
            teamScoresByWeek[nflWeek][awayAbbr] = parseFloat(away.score || "0");
          }
        }

        weekIsComplete[nflWeek] = anyGames && allFinal;
      } catch (e) {
        console.error(`ESPN week ${nflWeek} failed:`, e);
      }
    }

    // ── 3. Determine bracket winners by NFL team scores ───────────────────
    const newlyEliminated: number[] = [];
    const processedRounds = new Set<string>();

    for (const round of ROUND_ORDER) {
      const nflWeek = ROUND_TO_NFL_WEEK[round];
      if (!weekIsComplete[nflWeek]) continue;

      const bracketGames = (dbGames || []).filter(g => g.round === round);
      if (bracketGames.length === 0) continue;

      let allGamesDecided = true;

      for (const game of bracketGames) {
        if (game.winner_team_id) continue;

        const homeTeam = teamById[game.home_team_id];
        const awayTeam = teamById[game.away_team_id];
        if (!homeTeam || !awayTeam) continue;

        const homeNflScore = teamScoresByWeek[nflWeek]?.[homeTeam.abbreviation] ?? null;
        const awayNflScore = teamScoresByWeek[nflWeek]?.[awayTeam.abbreviation] ?? null;

        if (homeNflScore === null || awayNflScore === null) {
          allGamesDecided = false;
          continue;
        }

        let winnerId: number;
        let loserId: number;

        if (homeNflScore > awayNflScore) {
          winnerId = homeTeam.id;
          loserId  = awayTeam.id;
        } else if (awayNflScore > homeNflScore) {
          winnerId = awayTeam.id;
          loserId  = homeTeam.id;
        } else {
          // Tie — higher seed (lower seed number) wins
          winnerId = homeTeam.seed <= awayTeam.seed ? homeTeam.id : awayTeam.id;
          loserId  = homeTeam.seed <= awayTeam.seed ? awayTeam.id : homeTeam.id;
        }

        await supabaseAdmin
          .from("playoff_games")
          .update({ winner_team_id: winnerId })
          .eq("id", game.id);

        newlyEliminated.push(loserId);
      }

      if (allGamesDecided || bracketGames.every(g => g.winner_team_id)) {
        processedRounds.add(round);
      }
    }

    // ── 4. Eliminate losing teams + their players ─────────────────────────
    for (const teamId of newlyEliminated) {
      const lostGame = (dbGames || []).find(g =>
        (g.home_team_id === teamId || g.away_team_id === teamId) &&
        g.winner_team_id && g.winner_team_id !== teamId
      );

      await supabaseAdmin
        .from("nfl_teams")
        .update({ is_eliminated: true, eliminated_round: lostGame?.round || "WC" })
        .eq("id", teamId)
        .eq("season", season);

      await supabaseAdmin
        .from("players")
        .update({ is_active: false })
        .eq("nfl_team_id", teamId);
    }

    // ── 5. Pull player stats from Sleeper ────────────────────────────────
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("season", season);

    if (!players?.length) {
      return NextResponse.json({ error: "No players found" }, { status: 500 });
    }

    const sleeperPlayersRes = await fetch("https://api.sleeper.app/v1/players/nfl");
    const sleeperPlayersData = await sleeperPlayersRes.json();

    const nameToSleeperId: { [name: string]: string } = {};
    const normalizedToSleeperId: { [name: string]: string } = {};

    for (const [id, player] of Object.entries(sleeperPlayersData as any)) {
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
      BAL: "BAL", BUF: "BUF", LAC: "LAC", NE: "NE",
      KC: "KC", HOU: "HOU", DEN: "DEN",
      LAR: "LAR", SEA: "SEA", SF: "SF",
      DET: "DET", PHI: "PHI", GB: "GB", DAL: "DAL",
    };

    for (const round of ROUND_ORDER) {
      const nflWeek = ROUND_TO_NFL_WEEK[round];
      const dbWeek  = ROUND_TO_DB_WEEK[round];

      if (!weekIsComplete[nflWeek]) continue;

      const { data: existingStats } = await supabaseAdmin
        .from("player_stats")
        .select("id")
        .eq("season", season)
        .eq("week", dbWeek)
        .limit(1);

      if (existingStats?.length) {
        processedRounds.add(round);
        continue;
      }

      let sleeperWeekData: any = {};
      try {
        const res = await fetch(
          `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${nflWeek}`,
          { next: { revalidate: 0 } }
        );
        if (res.ok) sleeperWeekData = await res.json();
      } catch (e) {
        console.error(`Sleeper week ${nflWeek} failed:`, e);
      }

      for (const player of players) {
        let rawStats: any = null;

        if (player.position === "DST") {
          const { data: teamData } = await supabaseAdmin
            .from("nfl_teams")
            .select("abbreviation")
            .eq("id", player.nfl_team_id)
            .single();
          const abbr = teamData?.abbreviation;
          const sleeperId = abbr ? dstTeamMap[abbr] : null;
          rawStats = sleeperId ? sleeperWeekData[sleeperId] : null;
        } else {
          const nameLower = player.name.toLowerCase();
          let sleeperId = SLEEPER_ID_OVERRIDES[nameLower];
          if (!sleeperId) sleeperId = nameToSleeperId[nameLower];
          if (!sleeperId) {
            const normalized = normalizeName(player.name);
            sleeperId = normalizedToSleeperId[normalized];
          }
          rawStats = sleeperId ? sleeperWeekData[sleeperId] : null;
        }

        const stats = rawStats ? {
          pass_yards:         rawStats.pass_yd   || 0,
          pass_tds:           rawStats.pass_td   || 0,
          interceptions:      rawStats.pass_int  || 0,
          pass_attempts:      rawStats.pass_att  || 0,
          pass_completions:   rawStats.pass_cmp  || 0,
          rush_yards:         rawStats.rush_yd   || 0,
          rush_tds:           rawStats.rush_td   || 0,
          rush_attempts:      rawStats.rush_att  || 0,
          receptions:         rawStats.rec       || 0,
          rec_yards:          rawStats.rec_yd    || 0,
          rec_tds:            rawStats.rec_td    || 0,
          fg_made:            rawStats.fgm       || 0,
          fg_attempts:        rawStats.fga       || 0,
          fg_0_39:            (rawStats.fgm_0_19 || 0) + (rawStats.fgm_20_29 || 0) + (rawStats.fgm_30_39 || 0),
          fg_40_49:           rawStats.fgm_40_49 || 0,
          fg_50_plus:         rawStats.fgm_50p   || 0,
          xp_made:            rawStats.xpm       || 0,
          pat_attempts:       rawStats.xpa       || 0,
          dst_sacks:          rawStats.sack      || 0,
          dst_ints:           rawStats.int       || 0,
          dst_fumbles_rec:    rawStats.fum_rec   || 0,
          dst_tds:            rawStats.def_td    || 0,
          dst_safety:         rawStats.safe      || 0,
          dst_points_allowed: rawStats.pts_allow || 0,
          dst_tackles:        rawStats.tkl       || 0,
          fumbles_lost:       rawStats.fum_lost  || 0,
        } : null;

        await supabaseAdmin
          .from("player_stats")
          .upsert({
            player_id: player.id,
            season,
            week: dbWeek,
            ...(stats || {}),
            fantasy_points: 0,
          }, { onConflict: "player_id,season,week" });
      }

      processedRounds.add(round);
    }

    // ── 6. Calculate per-league fantasy scores ────────────────────────────
    const { data: leagues } = await supabaseAdmin
      .from("leagues")
      .select("*")
      .eq("draft_status", "COMPLETED");

    if (leagues?.length) {
      for (const league of leagues) {
        const scoringSettings = getSettings(league);

        const { data: leagueMembers } = await supabaseAdmin
          .from("league_members")
          .select("user_id")
          .eq("league_id", league.id);

        const { data: leaguePicks } = await supabaseAdmin
          .from("draft_picks")
          .select("user_id, player_id")
          .eq("league_id", league.id);

        if (!leagueMembers?.length || !leaguePicks?.length) continue;

        for (const round of processedRounds) {
          const dbWeek = ROUND_TO_DB_WEEK[round];

          for (const member of leagueMembers) {
            const memberPicks = leaguePicks.filter(p => p.user_id === member.user_id);
            let weekTotal = 0;

            for (const pick of memberPicks) {
              const player = players.find(p => p.id === pick.player_id);
              if (!player || player.is_active === false) continue;

              const { data: statRow } = await supabaseAdmin
                .from("player_stats")
                .select("*")
                .eq("player_id", pick.player_id)
                .eq("season", season)
                .eq("week", dbWeek)
                .single();

              weekTotal += calcPlayerPoints(statRow, player.position, scoringSettings);
            }

            weekTotal = Math.round(weekTotal * 10) / 10;

            await supabaseAdmin
              .from("scores")
              .upsert({
                league_id: league.id,
                user_id: member.user_id,
                week: dbWeek,
                total_points: weekTotal,
                active_players: memberPicks.filter(p => {
                  const pl = players.find(pl => pl.id === p.player_id);
                  return pl?.is_active !== false;
                }).length,
              }, { onConflict: "league_id,user_id,week" });
          }

          const { data: allScores } = await supabaseAdmin
            .from("scores")
            .select("*")
            .eq("league_id", league.id);

          for (const member of leagueMembers) {
            const memberScores = (allScores || []).filter(s => s.user_id === member.user_id);
            const total = memberScores.reduce((sum, s) => sum + parseFloat(s.total_points || "0"), 0);
            const w1 = memberScores.find(s => s.week === 1)?.total_points || 0;
            const w2 = memberScores.find(s => s.week === 2)?.total_points || 0;
            const w3 = memberScores.find(s => s.week === 3)?.total_points || 0;
            const w4 = memberScores.find(s => s.week === 4)?.total_points || 0;

            await supabaseAdmin
              .from("standings")
              .upsert({
                league_id: league.id,
                user_id: member.user_id,
                total_points: Math.round(total * 10) / 10,
                week_1_points: w1,
                week_2_points: w2,
                week_3_points: w3,
                week_4_points: w4,
                updated_at: new Date().toISOString(),
              }, { onConflict: "league_id,user_id" });
          }
        }
      }
    }

    // ── 7. Auto-advance bracket ───────────────────────────────────────────
    const { data: freshGames } = await supabaseAdmin
      .from("playoff_games")
      .select("*")
      .eq("season", season);

    for (const round of ROUND_ORDER) {
      if (round === "SB") continue;
      const nextRound = NEXT_ROUND[round];

      const roundGames = (freshGames || []).filter(g => g.round === round);
      if (roundGames.length === 0) continue;
      if (roundGames.some(g => !g.winner_team_id)) continue;

      const nextRoundGames = (freshGames || []).filter(g => g.round === nextRound);
      if (nextRoundGames.length > 0) continue;

      const eliminatedIds = new Set<number>();
      for (const game of (freshGames || [])) {
        if (game.winner_team_id) {
          const loserId = game.home_team_id === game.winner_team_id
            ? game.away_team_id
            : game.home_team_id;
          eliminatedIds.add(loserId);
        }
      }
      const survivors = allTeams.filter(t => !eliminatedIds.has(t.id));
      const newGames: any[] = [];

      if (nextRound === "DIV") {
        for (const conf of ["AFC", "NFC"]) {
          const confSurvivors = survivors.filter(t => t.conference === conf);
          const byeTeam   = confSurvivors.find(t => t.seed === 1);
          const wcWinners = confSurvivors.filter(t => t.seed !== 1);
          if (!byeTeam || wcWinners.length !== 3) continue;
          buildFloatingMatchups(byeTeam, wcWinners).forEach(([homeId, awayId], i) => {
            newGames.push({
              season, conference: conf, round: "DIV",
              home_team_id: homeId, away_team_id: awayId,
              game_date: DIV_DATES[conf as "AFC" | "NFC"],
              game_time: DIV_TIMES[i],
            });
          });
        }
      } else if (nextRound === "CC") {
        for (const conf of ["AFC", "NFC"]) {
          const confSurvivors = survivors
            .filter(t => t.conference === conf)
            .sort((a, b) => a.seed - b.seed);
          if (confSurvivors.length !== 2) continue;
          newGames.push({
            season, conference: conf, round: "CC",
            home_team_id: confSurvivors[0].id,
            away_team_id: confSurvivors[1].id,
            game_date: CC_DATE,
            game_time: conf === "AFC" ? CC_TIMES[0] : CC_TIMES[1],
          });
        }
      } else if (nextRound === "SB") {
        const afcChamp = survivors.find(t => t.conference === "AFC");
        const nfcChamp = survivors.find(t => t.conference === "NFC");
        if (afcChamp && nfcChamp) {
          newGames.push({
            season, conference: "SB", round: "SB",
            home_team_id: afcChamp.id,
            away_team_id: nfcChamp.id,
            game_date: SB_DATE,
            game_time: SB_TIME,
          });
        }
      }

      if (newGames.length > 0) {
        await supabaseAdmin.from("playoff_games").insert(newGames);
      }
    }

    return NextResponse.json({
      success: true,
      processedRounds: [...processedRounds],
      newlyEliminated: newlyEliminated.length,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return runSync(req);
}

export async function GET(req: NextRequest) {
  return runSync(req);
}