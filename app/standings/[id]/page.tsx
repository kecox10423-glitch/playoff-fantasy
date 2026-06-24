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
  const sizeClass = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-10 h-10 text-sm";
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

function RankBadge({ rank }: { rank: number }) {
  const styles: { [k: number]: string } = {
    1: "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/50 shadow-sm shadow-yellow-900/30",
    2: "bg-gray-400/15 text-gray-300 ring-1 ring-gray-400/30",
    3: "bg-orange-600/20 text-orange-400 ring-1 ring-orange-500/30",
  };
  const style = styles[rank] ?? "bg-gray-800 text-gray-500 ring-1 ring-gray-700";
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${style}`}>
      {rank}
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={() => setShow(v => !v)}
        className="text-gray-600 hover:text-gray-400 text-xs leading-none"
      >ⓘ</button>
      {show && (
        <span className="absolute z-50 bottom-full right-0 mb-1 w-48 bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-gray-600">
          {text}
        </span>
      )}
    </span>
  );
}

function StandingsTable({
  rows, user, members, scores, picks, players, leagueId, router, anyScoresExist,
}: {
  rows: any[]; user: any; members: any[]; scores: any[];
  picks: any[]; players: any[]; leagueId: string; router: any; anyScoresExist: boolean;
}) {
  function getMember(userId: string) {
    return members.find(m => m.user_id === userId);
  }

  function getWeekScore(userId: string, week: number) {
    const score = scores.find(s => s.user_id === userId && s.week === week);
    return score ? parseFloat(score.total_points) : null;
  }

  function getRosterForUser(userId: string) {
    return picks
      .filter(p => p.user_id === userId)
      .map(p => players.find(pl => pl.id === p.player_id))
      .filter(Boolean);
  }

  function getPlayersRemaining(userId: string) {
    return getRosterForUser(userId).filter((p: any) => p?.is_active !== false).length;
  }

  function getPlayersEliminated(userId: string) {
    return getRosterForUser(userId).filter((p: any) => p?.is_active === false).length;
  }

  function getProjected(userId: string, total: number): number | null {
    if (!anyScoresExist) return null;
    const weeksWithScores = [1, 2, 3, 4].filter(w => getWeekScore(userId, w) !== null);
    if (weeksWithScores.length === 0) return null;
    const avg = total / weeksWithScores.length;
    return avg * 4;
  }

  const leaderTotal = rows.length > 0 ? (parseFloat(rows[0].total_points) || 0) : 0;
  const anyTeamHasScore = anyScoresExist && leaderTotal > 0;

  if (rows.length === 0) return (
    <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-700">
      <p className="text-gray-500 text-sm">No teams yet.</p>
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-xl">
      {!anyScoresExist && (
        <div className="px-4 py-3 bg-gray-800/60 border-b border-gray-700 text-center">
          <p className="text-gray-400 text-xs">Scores update after each playoff week. Check back after Wild Card weekend (Jan 11).</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800/80 text-gray-400 text-xs uppercase tracking-widest">
              <th className="text-left px-4 py-3 sticky left-0 bg-gray-800 z-10 w-14">Rank</th>
              <th className="text-left px-4 py-3 sticky left-14 bg-gray-800 z-10 min-w-[150px]">Team</th>
              <th className="text-right px-4 py-3 w-14">WC</th>
              <th className="text-right px-4 py-3 w-14">DIV</th>
              <th className="text-right px-4 py-3 w-14">CC</th>
              <th className="text-right px-4 py-3 w-14">SB</th>
              <th className="text-right px-4 py-3 w-20 text-white font-black">Total</th>
              <th className="text-right px-4 py-3 w-16">
                PBL<Tooltip text="Points Behind Leader. How far behind 1st place you are." />
              </th>
              <th className="text-right px-4 py-3 w-16">
                PROJ<Tooltip text="Projected final score based on your average points per week so far." />
              </th>
              <th className="text-right px-4 py-3 w-12">
                REM<Tooltip text="Players remaining — how many of your drafted players are still active." />
              </th>
              <th className="text-right px-4 py-3 w-12">
                ELIM<Tooltip text="Players eliminated — how many of your players' teams have been knocked out." />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isMe = row.user_id === user?.id;
              const member = getMember(row.user_id);
              const total = parseFloat(row.total_points) || 0;
              const pbl = !anyTeamHasScore ? null : i === 0 ? null : total - leaderTotal;
              const proj = getProjected(row.user_id, total);
              const rem = getPlayersRemaining(row.user_id);
              const elim = getPlayersEliminated(row.user_id);

              const wc = getWeekScore(row.user_id, 1);
              const div = getWeekScore(row.user_id, 2);
              const cc = getWeekScore(row.user_id, 3);
              const sb = getWeekScore(row.user_id, 4);

              return (
                <tr
                  key={row.user_id}
                  onClick={() => router.push(`/roster/${leagueId}?team=${row.user_id}`)}
                  className={`border-t border-gray-800 cursor-pointer transition-all duration-150 ${
                    isMe ? "bg-green-950/60 hover:bg-green-900/40" : "hover:bg-gray-800/60"
                  }`}
                >
                  <td className={`px-4 py-4 w-14 sticky left-0 z-10 ${isMe ? "bg-green-950/80" : "bg-gray-900"}`}>
                    <RankBadge rank={i + 1} />
                  </td>
                  <td className={`px-4 py-4 sticky left-14 z-10 min-w-[150px] ${isMe ? "bg-green-950/80" : "bg-gray-900"}`}>
                    <div className="flex items-center gap-2">
                      {member && <Avatar member={member} size="sm" />}
                      <div>
                        <span className={`font-bold tracking-tight ${isMe ? "text-green-400" : "text-white"}`}>
                          {member?.team_name || "Unknown"}
                        </span>
                        {isMe && <span className="text-xs text-gray-500 ml-1">(You)</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-gray-300 text-sm w-14 tabular-nums">{wc != null ? wc.toFixed(1) : "—"}</td>
                  <td className="px-4 py-4 text-right text-gray-300 text-sm w-14 tabular-nums">{div != null ? div.toFixed(1) : "—"}</td>
                  <td className="px-4 py-4 text-right text-gray-300 text-sm w-14 tabular-nums">{cc != null ? cc.toFixed(1) : "—"}</td>
                  <td className="px-4 py-4 text-right text-gray-300 text-sm w-14 tabular-nums">{sb != null ? sb.toFixed(1) : "—"}</td>
                  <td className="px-4 py-4 text-right w-20 tabular-nums">
                    <span className={`font-black text-xl tracking-tight ${anyTeamHasScore && total > 0 ? "text-green-400" : "text-gray-500"}`}>
                      {total.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right text-sm w-16 tabular-nums">
                    {pbl === null
                      ? <span className="text-gray-600">—</span>
                      : <span className="text-red-400">{pbl.toFixed(1)}</span>
                    }
                  </td>
                  <td className="px-4 py-4 text-right text-sm w-16 tabular-nums">
                    {proj != null
                      ? <span className="text-blue-400">{proj.toFixed(1)}</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-4 text-right text-sm w-12 tabular-nums">
                    <span className="text-green-400 font-bold">{rem}</span>
                  </td>
                  <td className="px-4 py-4 text-right text-sm w-12 tabular-nums">
                    <span className={elim > 0 ? "text-red-400" : "text-gray-600"}>{elim}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StandingsPage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id as string;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const [
        { data: leagueData },
        { data: membersData },
        { data: standingsData },
        { data: scoresData },
        { data: picksData },
        { data: playersData },
      ] = await Promise.all([
        supabase.from("leagues").select("*").eq("id", leagueId).single(),
        supabase.from("league_members").select("*").eq("league_id", leagueId),
        supabase.from("standings").select("*").eq("league_id", leagueId).order("total_points", { ascending: false }),
        supabase.from("scores").select("*").eq("league_id", leagueId),
        supabase.from("draft_picks").select("*").eq("league_id", leagueId),
        supabase.from("players").select("*, nfl_teams(name, abbreviation, seed, is_eliminated)").eq("season", 2026),
      ]);

      setLeague(leagueData);
      setMembers(membersData || []);
      setPlayers(playersData || []);
      setPicks(picksData || []);
      setScores(scoresData || []);

      const allMembers = membersData || [];
      const standingsMap: { [userId: string]: any } = {};
      (standingsData || []).forEach((s: any) => { standingsMap[s.user_id] = s; });

      const allRows = allMembers.map(m => ({
        user_id: m.user_id,
        total_points: standingsMap[m.user_id]?.total_points || 0,
      })).sort((a, b) => b.total_points - a.total_points);

      setStandings(allRows);
      setLoading(false);
    }
    load();
  }, []);

  const isCommissioner = user?.id === league?.commissioner_user_id;
  const conferenceEnabled = league?.conference_enabled;
  const confAName = league?.conference_a_name || "AFC";
  const confBName = league?.conference_b_name || "NFC";
  const anyScoresExist = scores.some(s => s.week >= 1 && s.week <= 4 && parseFloat(s.total_points) > 0);

  function getMemberConference(userId: string) {
    return members.find(m => m.user_id === userId)?.conference || null;
  }

  const tableProps = { user, members, scores, picks, players, leagueId, router, anyScoresExist };

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </main>
  );

  const myRow = standings.find(s => s.user_id === user?.id);
  const myRank = myRow ? standings.indexOf(myRow) + 1 : null;
  const ordinal = (n: number) => n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

  const confAStandings = standings.filter(s => getMemberConference(s.user_id) === "A");
  const confBStandings = standings.filter(s => getMemberConference(s.user_id) === "B");
  const unassigned = standings.filter(s => !getMemberConference(s.user_id));

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Nav leagueId={leagueId} leagueName={league?.name} isCommissioner={isCommissioner} activePage="standings" />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-black mb-1 tracking-tight">{league?.name}</h1>
        <p className="text-gray-400 text-sm mb-2">Standings · Updates after each playoff week</p>
        {myRank && (
          <div className="inline-flex items-center gap-2 bg-green-950/60 border border-green-800/50 rounded-full px-4 py-1.5 mb-4">
            <RankBadge rank={myRank} />
            <p className="text-green-400 text-sm font-bold">You are in {ordinal(myRank)} place</p>
          </div>
        )}
        <p className="text-gray-600 text-xs mb-8">Tap any team to view their roster →</p>

        {conferenceEnabled ? (
          <div className="flex flex-col gap-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-black tracking-tight">{confAName}</h2>
                <span className="text-xs bg-blue-900/60 text-blue-300 px-2.5 py-1 rounded-full font-bold ring-1 ring-blue-700/40">Conference</span>
              </div>
              <StandingsTable rows={confAStandings} {...tableProps} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-black tracking-tight">{confBName}</h2>
                <span className="text-xs bg-purple-900/60 text-purple-300 px-2.5 py-1 rounded-full font-bold ring-1 ring-purple-700/40">Conference</span>
              </div>
              <StandingsTable rows={confBStandings} {...tableProps} />
            </div>
            {unassigned.length > 0 && (
              <div>
                <h2 className="text-lg font-black text-gray-500 mb-4">Unassigned</h2>
                <StandingsTable rows={unassigned} {...tableProps} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-black tracking-tight">Overall</h2>
                <span className="text-xs bg-green-900/60 text-green-400 px-2.5 py-1 rounded-full font-bold ring-1 ring-green-700/40">All Teams</span>
              </div>
              <StandingsTable rows={standings} {...tableProps} />
            </div>
          </div>
        ) : (
          <StandingsTable rows={standings} {...tableProps} />
        )}
      </div>
    </main>
  );
}