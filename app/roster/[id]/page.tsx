"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";
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
  const initials = member.team_name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.team_name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  const color = AVATAR_COLORS.find(c => c.name === member.avatar_color) || AVATAR_COLORS[0];

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-black flex-shrink-0`}
      style={{ backgroundColor: color.hex }}
    >
      {initials}
    </div>
  );
}

const POSITION_GROUPS = [
  {
    label: "QUARTERBACKS",
    positions: ["QB"],
    statCols: ["COMP/ATT", "PASS YDS", "PASS TD", "INT", "RUSH YDS", "RUSH TD", "FPTS"],
  },
  {
    label: "BACKS & RECEIVERS",
    positions: ["RB", "WR", "TE"],
    statCols: ["CAR", "RUSH YDS", "RUSH TD", "REC", "REC YDS", "REC TD", "FPTS"],
  },
  {
    label: "KICKERS",
    positions: ["K"],
    statCols: ["FG MADE", "FG ATT", "XP MADE", "XP ATT", "LONG", "PCT", "FPTS"],
  },
  {
    label: "DEFENSE / SPECIAL TEAMS",
    positions: ["DST"],
    statCols: ["SACKS", "INT", "FR", "TD", "PA", "YDS ALLOW", "FPTS"],
  },
];

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

export default function RosterPage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"playoff" | "season">("playoff");
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id as string;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      setSelectedUserId(user.id);

      const { data: leagueData } = await supabase
        .from("leagues").select("*").eq("id", leagueId).single();

      const { data: membersData } = await supabase
        .from("league_members").select("*").eq("league_id", leagueId)
        .order("draft_position");

      const { data: playersData } = await supabase
        .from("players")
        .select("*, nfl_teams(name, abbreviation, seed, is_eliminated)")
        .eq("season", 2026);

      const { data: picksData } = await supabase
        .from("draft_picks").select("*").eq("league_id", leagueId);

      const { data: scoresData } = await supabase
        .from("player_stats").select("*").eq("season", 2026);

      setLeague(leagueData);
      setMembers(membersData || []);
      setPlayers(playersData || []);
      setPicks(picksData || []);
      setScores(scoresData || []);
      setLoading(false);
    }
    load();
  }, []);

  function getRosterForUser(userId: string) {
    return picks
      .filter(p => p.user_id === userId)
      .map(p => players.find(pl => pl.id === p.player_id))
      .filter(Boolean);
  }

  function getPlayerWeekStats(playerId: number, week: number) {
    return scores.find(s => s.player_id === playerId && s.week === week) || null;
  }

  function getPlayerTotal(playerId: number) {
    const playerScores = scores.filter(s => s.player_id === playerId);
    if (!playerScores.length) return null;
    return playerScores.reduce((sum, s) => sum + (s.fantasy_points || 0), 0);
  }

  function formatVal(val: any) {
    if (val === null || val === undefined || val === 0) return <span className="text-gray-600">—</span>;
    return <span className="text-white">{val}</span>;
  }

  function formatScore(score: number | null) {
    if (score === null) return <span className="text-gray-600">—</span>;
    return <span className={score > 0 ? "text-green-400 font-bold" : "text-gray-500"}>{score.toFixed(1)}</span>;
  }

  function getStatCells(player: any, stats: any) {
    switch (player.position) {
      case "QB":
        return [
          formatVal(stats ? `${stats.pass_yards ? Math.round(stats.pass_yards / 20) : 0}/${stats.pass_yards || 0}` : null),
          formatVal(stats?.pass_yards),
          formatVal(stats?.pass_tds),
          formatVal(stats?.interceptions),
          formatVal(stats?.rush_yards),
          formatVal(stats?.rush_tds),
          formatScore(stats?.fantasy_points ?? null),
        ];
      case "RB":
        return [
          formatVal(stats?.rush_yards ? Math.round(stats.rush_yards / 4) : null),
          formatVal(stats?.rush_yards),
          formatVal(stats?.rush_tds),
          formatVal(stats?.receptions),
          formatVal(stats?.rec_yards),
          formatVal(stats?.rec_tds),
          formatScore(stats?.fantasy_points ?? null),
        ];
      case "WR":
      case "TE":
        return [
          formatVal(null),
          formatVal(stats?.rush_yards),
          formatVal(stats?.rush_tds),
          formatVal(stats?.receptions),
          formatVal(stats?.rec_yards),
          formatVal(stats?.rec_tds),
          formatScore(stats?.fantasy_points ?? null),
        ];
      case "K":
        return [
          formatVal(stats?.fg_made),
          formatVal(stats?.fg_made !== undefined && stats?.fg_made !== null ? stats.fg_made + 1 : null),
          formatVal(stats?.xp_made),
          formatVal(stats?.xp_made !== undefined && stats?.xp_made !== null ? stats.xp_made : null),
          formatVal(null),
          formatVal(null),
          formatScore(stats?.fantasy_points ?? null),
        ];
      case "DST":
        return [
          formatVal(stats?.dst_sacks),
          formatVal(stats?.dst_ints),
          formatVal(stats?.dst_fumbles_rec),
          formatVal(stats?.dst_tds),
          formatVal(stats?.dst_points_allowed),
          formatVal(null),
          formatScore(stats?.fantasy_points ?? null),
        ];
      default:
        return Array(7).fill(<span className="text-gray-600">—</span>);
    }
  }

  function getTeamTotal(userId: string) {
    const roster = getRosterForUser(userId);
    let total = 0;
    roster.forEach((p: any) => {
      const playerTotal = getPlayerTotal(p.id);
      if (playerTotal) total += playerTotal;
    });
    return total;
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading roster...</p>
    </main>
  );

  const isCommissioner = user?.id === league?.commissioner_user_id;
  const roster = selectedUserId ? getRosterForUser(selectedUserId) : [];
  const activeCount = roster.filter((p: any) => p.is_active).length;
  const eliminatedCount = roster.filter((p: any) => !p.is_active).length;
  const teamTotal = selectedUserId ? getTeamTotal(selectedUserId) : 0;
  const selectedMember = members.find(m => m.user_id === selectedUserId);

  const WEEK_LABELS: { [key: number]: string } = {
    1: "Wild Card",
    2: "Divisional",
    3: "Conf. Championship",
    4: "Super Bowl",
  };

  const getGridCols = (group: any) =>
    `3rem 1fr 7rem 5rem ${group.statCols.map(() => "5rem").join(" ")} 7rem`;

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
                className="bg-transparent text-white text-sm font-bold focus:outline-none"
              >
                {members.map(member => (
                  <option key={member.id} value={member.user_id}>
                    {member.team_name}{member.user_id === user?.id ? " (You)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-black text-green-400">{teamTotal.toFixed(1)}</p>
              <p className="text-xs text-gray-500">Total Pts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-green-400">{activeCount}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-red-400">{eliminatedCount}</p>
              <p className="text-xs text-gray-500">Eliminated</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-4 gap-1">
          <button
            onClick={() => setActiveTab("playoff")}
            className={`px-4 py-2 text-sm font-bold border-b-2 ${
              activeTab === "playoff"
                ? "border-green-500 text-green-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Playoff Stats
          </button>
          <button
            onClick={() => setActiveTab("season")}
            className={`px-4 py-2 text-sm font-bold border-b-2 ${
              activeTab === "season"
                ? "border-green-500 text-green-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            2026 Season Stats
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
                  <option key={w} value={w}>Wk {w} — {WEEK_LABELS[w]}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedUserId && (
          <>
            {POSITION_GROUPS.map(group => {
              const groupPlayers = roster.filter((p: any) =>
                group.positions.includes(p.position)
              );
              if (groupPlayers.length === 0) return null;

              const gridCols = getGridCols(group);

              return (
                <div key={group.label} className="mb-8 overflow-x-auto">
                  <div
                    className="grid text-xs text-gray-500 font-bold uppercase px-3 py-2 border-b border-gray-700 bg-gray-900 rounded-t min-w-max"
                    style={{ gridTemplateColumns: gridCols }}
                  >
                    <span>POS</span>
                    <span className="pl-2">{group.label}</span>
                    <span className="text-center">OPP</span>
                    <span className="text-center">PROJ</span>
                    {group.statCols.map(col => (
                      <span key={col} className="text-right">{col}</span>
                    ))}
                    <span className="text-right">STATUS</span>
                  </div>

                  {groupPlayers.map((player: any) => {
                    const stats = activeTab === "playoff"
                      ? getPlayerWeekStats(player.id, selectedWeek)
                      : null;
                    const statCells = getStatCells(player, stats);

                    return (
                      <div
                        key={player.id}
                        className={`grid items-center px-3 py-3 border-b border-gray-800 hover:bg-gray-900 transition-colors min-w-max ${
                          !player.is_active ? "opacity-40" : ""
                        }`}
                        style={{ gridTemplateColumns: gridCols }}
                      >
                        <span className={`text-xs font-black px-1.5 py-0.5 rounded text-center w-fit ${getPositionBadge(player.position)}`}>
                          {player.position}
                        </span>

                        <div className="pl-2">
                          <div className="flex items-center gap-2">
                            <p className={`font-bold text-sm ${!player.is_active ? "line-through text-gray-500" : "text-white"}`}>
                              {player.name}
                            </p>
                            {!player.is_active && (
                              <span className="text-xs bg-red-900 text-red-400 px-1.5 py-0.5 rounded">OUT</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {player.nfl_teams?.abbreviation} · Seed {player.nfl_teams?.seed}
                          </p>
                        </div>

                        <div className="text-center">
                          <p className="text-xs font-bold text-gray-500">—</p>
                          <p className="text-xs text-gray-700">TBD</p>
                        </div>

                        <div className="text-center">
                          <p className="text-xs text-blue-600">—</p>
                        </div>

                        {statCells.map((cell, i) => (
                          <span key={i} className="text-right text-sm">{cell}</span>
                        ))}

                        <span className={`text-right text-xs font-bold ${player.is_active ? "text-green-400" : "text-red-400"}`}>
                          {player.is_active ? "✓ Active" : "✗ Out"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {activeTab === "playoff" && roster.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 flex justify-between items-center mt-4 sticky bottom-4">
                <div className="flex items-center gap-3">
                  {selectedMember && <Avatar member={selectedMember} size="md" />}
                  <div>
                    <p className="font-black text-lg">{selectedMember?.team_name}</p>
                    <p className="text-gray-400 text-sm">{WEEK_LABELS[selectedWeek]} · {activeCount} active players</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-green-400">{teamTotal.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">Total Points</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}