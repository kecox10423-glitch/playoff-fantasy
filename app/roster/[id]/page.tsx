"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Nav from "../../components/Nav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const AVATAR_COLORS = [
  { name: "green", hex: "#15803d" },
  { name: "blue", hex: "#1d4ed8" },
  { name: "purple", hex: "#7e22ce" },
  { name: "red", hex: "#b91c1c" },
  { name: "orange", hex: "#ea580c" },
  { name: "yellow", hex: "#ca8a04" },
  { name: "pink", hex: "#db2777" },
  { name: "teal", hex: "#0d9488" },
  { name: "indigo", hex: "#4338ca" },
  { name: "rose", hex: "#be123c" },
  { name: "cyan", hex: "#0891b2" },
  { name: "lime", hex: "#65a30d" },
];

function Avatar({ member, size = "md" }: { member: any; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-10 h-10 text-sm";
  const initials = member.team_name.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
  if (member.avatar_url) {
    return <img src={member.avatar_url} alt={member.team_name} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  const color = AVATAR_COLORS.find(c => c.name === member.avatar_color) || AVATAR_COLORS[0];
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-black flex-shrink-0`} style={{ backgroundColor: color.hex }}>
      {initials}
    </div>
  );
}

function getPositionBadge(position: string) {
  switch (position) {
    case "QB": return "bg-red-900 text-red-300";
    case "RB": return "bg-blue-900 text-blue-300";
    case "WR": return "bg-yellow-900 text-yellow-300";
    case "TE": return "bg-purple-900 text-purple-300";
    case "K": return "bg-gray-700 text-gray-300";
    case "DST": return "bg-orange-900 text-orange-300";
    default: return "bg-gray-700 text-gray-300";
  }
}

function fmt(val: any, decimals = 0): string {
  if (val == null || val === "") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
}

const MAX_STAT_COLS = 8;
const STAT_COL_WIDTH = "4rem";
const GRID_COLS = `3rem 14rem 6rem ${Array(MAX_STAT_COLS).fill(STAT_COL_WIDTH).join(" ")}`;

const POSITION_GROUPS = [
  {
    label: "QUARTERBACKS", positions: ["QB"],
    cols: [
      { header: "CMP", fn: (s: any) => fmt(s?.pass_completions) },
      { header: "ATT", fn: (s: any) => fmt(s?.pass_attempts) },
      { header: "PYDS", fn: (s: any) => fmt(s?.pass_yards) },
      { header: "PTD", fn: (s: any) => fmt(s?.pass_tds) },
      { header: "INT", fn: (s: any) => fmt(s?.interceptions) },
      { header: "RYDS", fn: (s: any) => fmt(s?.rush_yards) },
      { header: "RTD", fn: (s: any) => fmt(s?.rush_tds) },
      { header: "FPTS", fn: (s: any) => fmt(s?.fantasy_points, 1), highlight: true },
    ],
  },
  {
    label: "RUNNING BACKS", positions: ["RB"],
    cols: [
      { header: "CAR", fn: (s: any) => fmt(s?.rush_attempts) },
      { header: "RYDS", fn: (s: any) => fmt(s?.rush_yards) },
      { header: "RTD", fn: (s: any) => fmt(s?.rush_tds) },
      { header: "REC", fn: (s: any) => fmt(s?.receptions) },
      { header: "RECYDS", fn: (s: any) => fmt(s?.rec_yards) },
      { header: "RECTD", fn: (s: any) => fmt(s?.rec_tds) },
      { header: "", fn: () => "" },
      { header: "FPTS", fn: (s: any) => fmt(s?.fantasy_points, 1), highlight: true },
    ],
  },
  {
    label: "WIDE RECEIVERS", positions: ["WR"],
    cols: [
      { header: "REC", fn: (s: any) => fmt(s?.receptions) },
      { header: "RECYDS", fn: (s: any) => fmt(s?.rec_yards) },
      { header: "RECTD", fn: (s: any) => fmt(s?.rec_tds) },
      { header: "RYDS", fn: (s: any) => fmt(s?.rush_yards) },
      { header: "RTD", fn: (s: any) => fmt(s?.rush_tds) },
      { header: "", fn: () => "" },
      { header: "", fn: () => "" },
      { header: "FPTS", fn: (s: any) => fmt(s?.fantasy_points, 1), highlight: true },
    ],
  },
  {
    label: "TIGHT ENDS", positions: ["TE"],
    cols: [
      { header: "REC", fn: (s: any) => fmt(s?.receptions) },
      { header: "RECYDS", fn: (s: any) => fmt(s?.rec_yards) },
      { header: "RECTD", fn: (s: any) => fmt(s?.rec_tds) },
      { header: "", fn: () => "" },
      { header: "", fn: () => "" },
      { header: "", fn: () => "" },
      { header: "", fn: () => "" },
      { header: "FPTS", fn: (s: any) => fmt(s?.fantasy_points, 1), highlight: true },
    ],
  },
  {
    label: "KICKERS", positions: ["K"],
    cols: [
      { header: "FGM", fn: (s: any) => fmt(s?.fg_made) },
      { header: "FGA", fn: (s: any) => fmt(s?.fg_attempts) },
      { header: "0-39", fn: (s: any) => fmt(s?.fg_0_39) },
      { header: "40-49", fn: (s: any) => fmt(s?.fg_40_49) },
      { header: "50+", fn: (s: any) => fmt(s?.fg_50_plus) },
      { header: "XPM", fn: (s: any) => fmt(s?.xp_made) },
      { header: "XPA", fn: (s: any) => fmt(s?.pat_attempts) },
      { header: "FPTS", fn: (s: any) => fmt(s?.fantasy_points, 1), highlight: true },
    ],
  },
  {
    label: "DEFENSE / SPECIAL TEAMS", positions: ["DST"],
    cols: [
      { header: "SK", fn: (s: any) => fmt(s?.dst_sacks) },
      { header: "INT", fn: (s: any) => fmt(s?.dst_ints) },
      { header: "FR", fn: (s: any) => fmt(s?.dst_fumbles_rec) },
      { header: "SAF", fn: (s: any) => fmt(s?.dst_safety) },
      { header: "TK", fn: (s: any) => fmt(s?.dst_tackles) },
      { header: "PA", fn: (s: any) => fmt(s?.dst_points_allowed) },
      { header: "", fn: () => "" },
      { header: "FPTS", fn: (s: any) => fmt(s?.fantasy_points, 1), highlight: true },
    ],
  },
];

const WEEK_LABELS: { [k: number]: string } = {
  1: "Wild Card", 2: "Divisional", 3: "Conf. Championship", 4: "Super Bowl",
};

export default function RosterPage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [allStats, setAllStats] = useState<any[]>([]);
  const [playoffGames, setPlayoffGames] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"playoff" | "season">("season");
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const leagueId = params.id as string;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const teamParam = searchParams.get("team");

      const [
        { data: leagueData },
        { data: membersData },
        { data: playersData },
        { data: picksData },
        { data: statsData },
        { data: gamesData },
      ] = await Promise.all([
        supabase.from("leagues").select("*").eq("id", leagueId).single(),
        supabase.from("league_members").select("*").eq("league_id", leagueId).order("draft_position"),
        supabase.from("players").select("*, nfl_teams(name, abbreviation, seed, is_eliminated)").eq("season", 2026),
        supabase.from("draft_picks").select("*").eq("league_id", leagueId),
        supabase.from("player_stats").select("*").eq("season", 2026),
        supabase.from("playoff_games").select("*").eq("season", 2026),
      ]);

      setLeague(leagueData);
      setMembers(membersData || []);
      setPlayers(playersData || []);
      setPicks(picksData || []);
      setAllStats(statsData || []);
      setPlayoffGames(gamesData || []);
      setSelectedUserId(teamParam || user.id);
      setLoading(false);
    }
    load();
  }, []);

  function getRosterForUser(userId: string) {
    return picks
      .filter(p => p.user_id === userId)
      .map(p => {
        const player = players.find(pl => pl.id === p.player_id);
        const pick = picks.find(pk => pk.user_id === userId && pk.player_id === p.player_id);
        return player ? { ...player, round: pick?.round, pick_number: pick?.pick_number } : null;
      })
      .filter(Boolean);
  }

  function getStats(playerId: number, week: number | null) {
    if (week === null) {
      return allStats.find(s => s.player_id === playerId && s.week === 0) || null;
    }
    return allStats.find(s => s.player_id === playerId && s.week === week) || null;
  }

  function getPlayerSeasonTotal(playerId: number) {
    const weekStats = allStats.filter(s => s.player_id === playerId && s.week >= 1 && s.week <= 4);
    if (weekStats.length === 0) return null;
    return weekStats.reduce((sum, s) => sum + (parseFloat(s.fantasy_points) || 0), 0);
  }

  function getTeamTotal(userId: string) {
    const roster = getRosterForUser(userId);
    return roster.reduce((sum: number, p: any) => {
      const t = getPlayerSeasonTotal(p.id);
      return sum + (t || 0);
    }, 0);
  }

  function getCurrentRound(): string {
    const rounds = ["WC", "DIV", "CC", "SB"];
    for (const round of rounds) {
      const roundGames = playoffGames.filter(g => g.round === round);
      if (roundGames.length > 0 && roundGames.some(g => !g.winner_team_id)) return round;
      if (roundGames.length > 0 && roundGames.every(g => g.winner_team_id)) continue;
    }
    return "WC";
  }

  function getOpp(player: any): string {
    if (player.is_active === false) return "OUT";
    const teamId = player.nfl_team_id;
    const round = getCurrentRound();
    const game = playoffGames.find(g =>
      g.round === round && (g.home_team_id === teamId || g.away_team_id === teamId)
    );
    if (!game) return "BYE";
    const oppId = game.home_team_id === teamId ? game.away_team_id : game.home_team_id;
    const oppTeam = players.find(p => p.nfl_team_id === oppId)?.nfl_teams;
    return oppTeam?.abbreviation ? `vs ${oppTeam.abbreviation}` : "TBD";
  }

  const hasPlayoffStats = allStats.some(s => s.week >= 1 && s.week <= 4 && parseFloat(s.fantasy_points || "0") > 0);

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading roster...</p>
    </main>
  );

  const isCommissioner = user?.id === league?.commissioner_user_id;
  const roster = selectedUserId ? getRosterForUser(selectedUserId) : [];
  const activeCount = roster.filter((p: any) => p?.is_active !== false).length;
  const eliminatedCount = roster.filter((p: any) => p?.is_active === false).length;
  const teamTotal = selectedUserId ? getTeamTotal(selectedUserId) : 0;
  const hasTeamTotal = teamTotal > 0;
  const selectedMember = members.find(m => m.user_id === selectedUserId);
  const isSeasonTab = activeTab === "season";
  const weekOrNull = isSeasonTab ? null : selectedWeek;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Nav
        leagueId={leagueId}
        leagueName={league?.name}
        isCommissioner={isCommissioner}
        activePage="roster"
      />

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Controls Row */}
        <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <label className="text-gray-400 text-sm whitespace-nowrap">Team:</label>
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
              {selectedMember && <Avatar member={selectedMember} size="sm" />}
              <select
                value={selectedUserId || ""}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-gray-800 text-white text-sm font-bold focus:outline-none cursor-pointer"
              >
                {members.map(member => (
                  <option key={member.id} value={member.user_id} className="bg-gray-800 text-white">
                    {member.team_name}{member.user_id === user?.id ? " (You)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <p className={`text-2xl font-black ${hasTeamTotal ? "text-green-400" : "text-gray-500"}`}>
                {teamTotal.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">Total Pts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-green-400">{activeCount}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-black ${eliminatedCount > 0 ? "text-red-400" : "text-gray-500"}`}>
                {eliminatedCount}
              </p>
              <p className="text-xs text-gray-500">Eliminated</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-6 gap-1">
          <button
            onClick={() => setActiveTab("season")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "season" ? "border-green-500 text-green-400" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            2026 Season Stats
          </button>
          <button
            onClick={() => setActiveTab("playoff")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "playoff" ? "border-green-500 text-green-400" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Playoff Stats
          </button>

          {activeTab === "playoff" && (
            <div className="ml-auto flex items-center gap-2">
              <label className="text-gray-400 text-xs">Week:</label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="bg-gray-800 text-white px-3 py-1 rounded text-sm border border-gray-700 focus:outline-none focus:border-green-500"
              >
                {[1, 2, 3, 4].map(w => (
                  <option key={w} value={w} className="bg-gray-800 text-white">
                    Wk {w} — {WEEK_LABELS[w]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {activeTab === "season" && (
          <p className="text-gray-600 text-xs mb-4">Regular season stats shown for context. Points are based on playoff performance only.</p>
        )}

        {activeTab === "playoff" && !hasPlayoffStats && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center mb-6">
            <p className="text-gray-400 text-sm font-bold">No playoff stats yet</p>
            <p className="text-gray-600 text-xs mt-1">Playoff stats will update after Wild Card weekend (Jan 11).</p>
          </div>
        )}

        {roster.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-gray-300 text-lg font-bold mb-2">No players drafted yet</p>
            <p className="text-gray-500 text-sm">This roster will populate after the draft completes.</p>
          </div>
        ) : (
          <>
            {/* MOBILE: Card view */}
            <div className="md:hidden flex flex-col gap-3 mb-6">
              {POSITION_GROUPS.map(group => {
                const groupPlayers = roster.filter((p: any) => group.positions.includes(p.position));
                if (groupPlayers.length === 0) return null;
                return (
                  <div key={group.label}>
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 px-1">{group.label}</p>
                    {groupPlayers
                      .sort((a: any, b: any) => (a.pick_number || 0) - (b.pick_number || 0))
                      .map((player: any) => {
                        const stats = getStats(player.id, weekOrNull);
                        const isEliminated = player.is_active === false;
                        const opp = getOpp(player);
                        const fpts = group.cols.find(c => (c as any).highlight)?.fn(stats) || "—";
                        return (
                          <div
                            key={player.id}
                            className={`bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-2 flex items-center justify-between ${isEliminated ? "opacity-50" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-black px-1.5 py-0.5 rounded ${getPositionBadge(player.position)}`}>
                                {player.position}
                              </span>
                              <div>
                                <p className={`font-bold text-sm ${isEliminated ? "line-through text-gray-500" : "text-white"}`}>
                                  {player.name}
                                  {isEliminated && <span className="ml-2 text-xs bg-red-900 text-red-400 px-1.5 py-0.5 rounded">ELIM</span>}
                                </p>
                                <p className="text-xs text-gray-500">{player.nfl_teams?.abbreviation} · Seed {player.nfl_teams?.seed}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-sm font-bold ${fpts === "—" ? "text-gray-600" : "text-green-400"}`}>{fpts} pts</p>
                              <p className={`text-xs ${opp === "OUT" ? "text-red-400" : opp === "BYE" ? "text-blue-400" : "text-gray-400"}`}>{opp}</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>

            {/* DESKTOP: Full table view */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <div className="bg-gray-800 rounded-t-lg min-w-max">
                  <div className="grid px-4 py-2 text-xs text-gray-500 font-bold uppercase" style={{ gridTemplateColumns: GRID_COLS }}>
                    <span>POS</span>
                    <span>PLAYER</span>
                    <span>OPP</span>
                    {Array(MAX_STAT_COLS).fill(null).map((_, i) => <span key={i} className="text-right">—</span>)}
                  </div>
                </div>
                <div className="min-w-max">
                  {POSITION_GROUPS.map(group => {
                    const groupPlayers = roster.filter((p: any) => group.positions.includes(p.position));
                    if (groupPlayers.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <div className="px-4 py-1.5 border-t border-gray-700 bg-gray-850">
                          <span className="text-xs font-black text-gray-500 uppercase tracking-widest">{group.label}</span>
                        </div>
                        <div className="grid px-4 py-1.5 text-xs text-gray-600 font-bold uppercase bg-gray-900 border-b border-gray-800" style={{ gridTemplateColumns: GRID_COLS }}>
                          <span></span><span></span><span></span>
                          {group.cols.map((col, i) => (
                            <span key={i} className={`text-right ${(col as any).highlight ? "text-green-500" : ""}`}>{col.header}</span>
                          ))}
                        </div>
                        {groupPlayers
                          .sort((a: any, b: any) => (a.pick_number || 0) - (b.pick_number || 0))
                          .map((player: any) => {
                            const stats = getStats(player.id, weekOrNull);
                            const isEliminated = player.is_active === false;
                            const opp = getOpp(player);
                            return (
                              <div
                                key={player.id}
                                className={`grid px-4 py-3 border-b border-gray-800 hover:bg-gray-900 transition-colors items-center ${isEliminated ? "opacity-40" : ""}`}
                                style={{ gridTemplateColumns: GRID_COLS }}
                              >
                                <span className={`text-xs font-black px-1.5 py-0.5 rounded text-center w-fit ${getPositionBadge(player.position)}`}>
                                  {player.position}
                                </span>
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-2">
                                    <p className={`font-bold text-sm truncate ${isEliminated ? "line-through text-gray-500" : "text-white"}`}>{player.name}</p>
                                    {isEliminated && <span className="text-xs bg-red-900 text-red-400 px-1.5 py-0.5 rounded flex-shrink-0">ELIM</span>}
                                  </div>
                                  <p className="text-xs text-gray-500">{player.nfl_teams?.abbreviation} · Seed {player.nfl_teams?.seed}</p>
                                </div>
                                <span className={`text-xs font-bold whitespace-nowrap ${opp === "OUT" ? "text-red-500" : opp === "BYE" ? "text-blue-400" : "text-gray-300"}`}>
                                  {opp}
                                </span>
                                {group.cols.map((col, i) => {
                                  const val = col.fn(stats);
                                  return (
                                    <span key={i} className={`text-right text-sm font-mono tabular-nums ${
                                      (col as any).highlight
                                        ? val === "—" || val === "" ? "text-gray-600" : "text-green-400 font-bold"
                                        : val === "—" || val === "" ? "text-gray-600" : "text-gray-200"
                                    }`}>{val === "" ? "" : val}</span>
                                  );
                                })}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 flex justify-between items-center mt-4 sticky bottom-4 border border-gray-700">
              <div className="flex items-center gap-3">
                {selectedMember && <Avatar member={selectedMember} size="md" />}
                <div>
                  <p className="font-black text-lg">{selectedMember?.team_name}</p>
                  <p className="text-gray-400 text-sm">{activeCount} active · {eliminatedCount} eliminated</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-black ${hasTeamTotal ? "text-green-400" : "text-gray-500"}`}>{teamTotal.toFixed(1)}</p>
                <p className="text-xs text-gray-500">{isSeasonTab ? "2026 Season" : WEEK_LABELS[selectedWeek]}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}