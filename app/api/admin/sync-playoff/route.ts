import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSettings, calcPlayerPoints } from "../../../lib/scoring";

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

// Confirmed via Vercel logs: sync-playoff's "No players found" 500 is an
// intermittent, self-recovering transient blip on this query, not a real
// empty table (the 126-row 2026 player pool is static during the beta -
// nothing deletes/recreates it). The original guard didn't even destructure
// Supabase's `error`, so a failed query and a genuinely empty one looked
// identical and left zero trace in the logs. This retries once, logs the
// real error (or the empty-result case) either way, and only gives up
// after both attempts fail.
async function fetchPlayers(season: number) {
  const { data, error } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("season", season);
  return { data, error };
}

// ── Live beta poller ──────────────────────────────────────────────────────
// Scoped to the WC round only (real NFL Week 1, standing in for the mock
// bracket's opening round during the Sept 9 beta). No completeness gate:
// every call re-pulls whatever Sleeper currently has and overwrites
// player_stats, then rescores. Safe to call every 1-2 min — everything here
// is upsert-by-unique-key, so a rerun just overwrites with the latest values.
async function runLiveSync() {
  const season = 2026;
  const round = "WC";
  const nflWeek = ROUND_TO_NFL_WEEK[round];
  const dbWeek = ROUND_TO_DB_WEEK[round];

  const errors: { stage: string; id?: number | string; error: string }[] = [];

  let { data: players, error: playersError } = await fetchPlayers(season);

  if (playersError || !players?.length) {
    console.error(
      `[live-sync] players query empty/errored on first attempt` +
      (playersError ? ` - error: ${playersError.message}` : " - 0 rows, no error") +
      ` - retrying once`
    );
    ({ data: players, error: playersError } = await fetchPlayers(season));
  }

  if (playersError || !players?.length) {
    const reason = playersError
      ? `players query errored twice: ${playersError.message}`
      : "players query returned 0 rows twice";
    console.error(`[live-sync] ${reason} - skipping this poll, next one in ~1-2 min will retry`);
    return NextResponse.json({ success: true, skipped: true, reason }, { status: 200 });
  }

  // Name-matching against Sleeper is precomputed ahead of time (see
  // admin/sync-sleeper-ids, which already populates players.sleeper_id and
  // is also what the headshot feature relies on) and read straight off the
  // player row below — no re-downloading Sleeper's ~15MB players/nfl list
  // on every poll. That single fetch was ~7.5s of the ~8s total runtime;
  // the live poller must never touch it. If a non-DST player is missing
  // sleeper_id, its stats are silently skipped here (same as an unmatched
  // name would have been before) — rerun sync-sleeper-ids to fill it in.
  const { data: nflTeams } = await supabaseAdmin
    .from("nfl_teams")
    .select("id, abbreviation, seed")
    .eq("season", season);
  const teamAbbrById = new Map((nflTeams || []).map(t => [t.id, t.abbreviation]));
  const seedByTeamId = new Map((nflTeams || []).map(t => [t.id, t.seed]));

  const dstTeamMap: { [abbr: string]: string } = {
    BAL: "BAL", BUF: "BUF", LAC: "LAC", NE: "NE",
    KC: "KC", HOU: "HOU", DEN: "DEN",
    LAR: "LAR", SEA: "SEA", SF: "SF",
    DET: "DET", PHI: "PHI", GB: "GB", DAL: "DAL",
  };

  // Pull whatever Sleeper currently has for this week — no completeness gate,
  // no "already have a row" bail-out. Values are overwritten, not accumulated,
  // so a corrected/updated stat on the next poll just replaces the old one.
  let sleeperWeekData: any = {};
  try {
    const res = await fetch(
      `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${nflWeek}`,
      { next: { revalidate: 0 } }
    );
    if (res.ok) sleeperWeekData = await res.json();
  } catch (e: any) {
    errors.push({ stage: "sleeper-fetch", error: e.message });
  }

  const sleeperEntries = Object.entries(sleeperWeekData);
  const sampleEntries = sleeperEntries.slice(0, 3);

  console.log(
    `[live-sync] sleeper week ${nflWeek} response: ${sleeperEntries.length} players, ` +
    `${JSON.stringify(sleeperWeekData).length} bytes`
  );
  console.log(`[live-sync] sample:`, JSON.stringify(sampleEntries));

  const playerStatRows = players.map(player => {
    let rawStats: any = null;

    if (player.position === "DST") {
      const abbr = teamAbbrById.get(player.nfl_team_id);
      const sleeperId = abbr ? dstTeamMap[abbr] : null;
      rawStats = sleeperId ? sleeperWeekData[sleeperId] : null;
    } else {
      rawStats = player.sleeper_id ? sleeperWeekData[player.sleeper_id] : null;
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

    return {
      player_id: player.id,
      season,
      week: dbWeek,
      ...(stats || {}),
      fantasy_points: 0,
    };
  });

  const { error: statsUpsertErr } = await supabaseAdmin
    .from("player_stats")
    .upsert(playerStatRows, { onConflict: "player_id,season,week" });

  if (statsUpsertErr) {
    errors.push({ stage: "player_stats", error: statsUpsertErr.message });
  }

  // ── Batch-recalc scores + standings from current player_stats ───────────
  // One read of the week's stats instead of one per (member, pick).
  const { data: currentStats } = await supabaseAdmin
    .from("player_stats")
    .select("*")
    .eq("season", season)
    .eq("week", dbWeek);

  const statsByPlayerId = new Map((currentStats || []).map(s => [s.player_id, s]));
  const playersById = new Map(players.map(p => [p.id, p]));

  const { data: leagues } = await supabaseAdmin
    .from("leagues")
    .select("*")
    .eq("draft_status", "COMPLETED");

  for (const league of leagues || []) {
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

    const scoreRows = leagueMembers.map(member => {
      const memberPicks = leaguePicks.filter(p => p.user_id === member.user_id);
      let weekTotal = 0;
      let activePlayers = 0;

      for (const pick of memberPicks) {
        const player = playersById.get(pick.player_id);
        if (!player || player.is_active === false) continue;
        activePlayers++;
        const isByeThisRound = seedByTeamId.get(player.nfl_team_id) === 1 && dbWeek === 1;
        weekTotal += calcPlayerPoints(statsByPlayerId.get(pick.player_id), player.position, scoringSettings, isByeThisRound);
      }

      return {
        league_id: league.id,
        user_id: member.user_id,
        week: dbWeek,
        total_points: Math.round(weekTotal * 10) / 10,
        active_players: activePlayers,
      };
    });

    const { error: scoresErr } = await supabaseAdmin
      .from("scores")
      .upsert(scoreRows, { onConflict: "league_id,user_id,week" });
    if (scoresErr) errors.push({ stage: "scores", id: league.id, error: scoresErr.message });

    const { data: allScores } = await supabaseAdmin
      .from("scores")
      .select("*")
      .eq("league_id", league.id);

    const standingsRows = leagueMembers.map(member => {
      const memberScores = (allScores || []).filter(s => s.user_id === member.user_id);
      const total = memberScores.reduce((sum, s) => sum + parseFloat(s.total_points || "0"), 0);
      return {
        league_id: league.id,
        user_id: member.user_id,
        total_points: Math.round(total * 10) / 10,
        week_1_points: memberScores.find(s => s.week === 1)?.total_points || 0,
        week_2_points: memberScores.find(s => s.week === 2)?.total_points || 0,
        week_3_points: memberScores.find(s => s.week === 3)?.total_points || 0,
        week_4_points: memberScores.find(s => s.week === 4)?.total_points || 0,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: standingsErr } = await supabaseAdmin
      .from("standings")
      .upsert(standingsRows, { onConflict: "league_id,user_id" });
    if (standingsErr) errors.push({ stage: "standings", id: league.id, error: standingsErr.message });
  }

  // ── Persist real ESPN scores onto the WC round's bracket games ──────────
  // Live, every poll, regardless of finality - this is display-only for now
  // (winner determination is a separate, later piece). Each bracket team's
  // score comes from THEIR OWN real NFL game this week, not from the two
  // teams playing each other (the WC pairings here are fictional).
  let scoresUpdated = 0;
  const { data: wcGames } = await supabaseAdmin
    .from("playoff_games")
    .select("id, home_team_id, away_team_id")
    .eq("season", season)
    .eq("round", round);

  if (wcGames?.length) {
    try {
      const espnRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${nflWeek}&season=${season}`,
        { next: { revalidate: 0 } }
      );
      if (espnRes.ok) {
        const espnData = await espnRes.json();
        const scoreByAbbr: { [abbr: string]: number } = {};

        for (const event of (espnData.events || [])) {
          const comp = event.competitions?.[0];
          if (!comp) continue;
          const home = comp.competitors?.find((c: any) => c.homeAway === "home");
          const away = comp.competitors?.find((c: any) => c.homeAway === "away");
          if (home?.team?.abbreviation) {
            const abbr = ESPN_ABR_MAP[home.team.abbreviation] || home.team.abbreviation;
            scoreByAbbr[abbr] = parseFloat(home.score || "0");
          }
          if (away?.team?.abbreviation) {
            const abbr = ESPN_ABR_MAP[away.team.abbreviation] || away.team.abbreviation;
            scoreByAbbr[abbr] = parseFloat(away.score || "0");
          }
        }

        const scoreUpdates = wcGames
          .map(game => {
            const homeAbbr = teamAbbrById.get(game.home_team_id);
            const awayAbbr = teamAbbrById.get(game.away_team_id);
            const homeScore = homeAbbr ? scoreByAbbr[homeAbbr] : undefined;
            const awayScore = awayAbbr ? scoreByAbbr[awayAbbr] : undefined;
            return {
              id: game.id,
              ...(homeScore !== undefined ? { home_score: homeScore } : {}),
              ...(awayScore !== undefined ? { away_score: awayScore } : {}),
            };
          })
          .filter(g => "home_score" in g || "away_score" in g);

        // These rows always already exist (ids came from the SELECT above),
        // so this is a plain per-row UPDATE, not an upsert - upsert's
        // INSERT ... ON CONFLICT form still validates NOT NULL constraints
        // (conference, round, etc.) on the hypothetical insert row even
        // when it's guaranteed to hit the conflict branch, which fails here
        // since these partial objects only carry id + the score fields.
        // Only 6 rows max, so no batching needed.
        for (const { id, ...fields } of scoreUpdates) {
          const { error: scoreUpdateErr } = await supabaseAdmin
            .from("playoff_games")
            .update(fields)
            .eq("id", id);
          if (scoreUpdateErr) {
            errors.push({ stage: "playoff_game_scores", id, error: scoreUpdateErr.message });
          } else {
            scoresUpdated++;
          }
        }
      }
    } catch (e: any) {
      errors.push({ stage: "espn-scores", error: e.message });
    }
  }

  return NextResponse.json({
    success: true,
    live: true,
    round,
    nflWeek,
    sleeperPlayerCount: sleeperEntries.length,
    sampleSleeperEntries: sampleEntries,
    playersProcessed: players.length,
    leaguesProcessed: leagues?.length || 0,
    scoresUpdated,
    errors,
  });
}

async function runSync(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = body;

    const authHeader = req.headers.get("authorization");
    const isAdmin = userId === ADMIN_USER_ID;
    const isCron  = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    // Live beta mode: skip real-matchup winner/elimination/advancement entirely
    // and just re-poll + rescore the current round on every call. Gated
    // separately so LIVE_POLL_TOKEN (handed to the external cron-job.org
    // scheduler) can only ever reach runLiveSync() — it is never accepted
    // below for the real-playoff (January) path.
    if (new URL(req.url).searchParams.get("live") === "true") {
      const isLiveScheduler = authHeader === `Bearer ${process.env.LIVE_POLL_TOKEN}`;
      if (!isAdmin && !isCron && !isLiveScheduler) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      return runLiveSync();
    }

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