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

function StandingsTable({
  rows,
  user,
  members,
  scores,
  standings,
}: {
  rows: any[];
  user: any;
  members: any[];
  scores: any[];
  standings: any[];
}) {
  function getMember(userId: string) {
    return members.find((m) => m.user_id === userId);
  }

  function getMemberName(userId: string) {
    return getMember(userId)?.team_name || "Unknown";
  }

  function getWeekScore(userId: string, week: number) {
    const score = scores.find((s) => s.user_id === userId && s.week === week);
    return score ? score.total_points.toFixed(1) : "—";
  }

  if (rows.length === 0) return (
    <div className="bg-gray-900 rounded-xl p-8 text-center border border-gray-800">
      <p className="text-gray-500 text-sm">No teams assigned yet.</p>
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Rank</th>
              <th className="text-left px-4 py-3">Team</th>
              <th className="text-right px-3 py-3">WC</th>
              <th className="text-right px-3 py-3">Div</th>
              <th className="text-right px-3 py-3">CC</th>
              <th className="text-right px-3 py-3">SB</th>
              <th className="text-right px-4 py-3 text-white">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((standing, i) => {
              const isMe = standing.user_id === user?.id;
              const member = getMember(standing.user_id);
              return (
                <tr
                  key={standing.id}
                  className={`border-t border-gray-800 ${isMe ? "bg-green-950" : "hover:bg-gray-800"}`}
                >
                  <td className="px-4 py-4">
                    <span className={`font-black text-lg ${
                      i === 0 ? "text-yellow-400" :
                      i === 1 ? "text-gray-300" :
                      i === 2 ? "text-orange-400" :
                      "text-gray-600"
                    }`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {member && <Avatar member={member} size="sm" />}
                      <span className={`font-bold ${isMe ? "text-green-400" : "text-white"}`}>
                        {getMemberName(standing.user_id)}
                      </span>
                      {isMe && <span className="text-xs text-gray-500">(You)</span>}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right text-gray-300 text-sm">{getWeekScore(standing.user_id, 1)}</td>
                  <td className="px-3 py-4 text-right text-gray-300 text-sm">{getWeekScore(standing.user_id, 2)}</td>
                  <td className="px-3 py-4 text-right text-gray-300 text-sm">{getWeekScore(standing.user_id, 3)}</td>
                  <td className="px-3 py-4 text-right text-gray-300 text-sm">{getWeekScore(standing.user_id, 4)}</td>
                  <td className="px-4 py-4 text-right font-black text-green-400 text-lg">{standing.total_points.toFixed(1)}</td>
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

      const { data: leagueData } = await supabase
        .from("leagues").select("*").eq("id", leagueId).single();

      const { data: membersData } = await supabase
        .from("league_members").select("*").eq("league_id", leagueId);

      const { data: standingsData } = await supabase
        .from("standings").select("*").eq("league_id", leagueId)
        .order("total_points", { ascending: false });

      const { data: scoresData } = await supabase
        .from("scores").select("*").eq("league_id", leagueId);

      setLeague(leagueData);
      setMembers(membersData || []);
      setStandings(standingsData || []);
      setScores(scoresData || []);
      setLoading(false);
    }
    load();
  }, []);

  function getMemberConference(userId: string) {
    return members.find((m) => m.user_id === userId)?.conference || null;
  }

  const isCommissioner = user?.id === league?.commissioner_user_id;
  const conferenceEnabled = league?.conference_enabled;
  const confAName = league?.conference_a_name || "AFC";
  const confBName = league?.conference_b_name || "NFC";

  const confAStandings = standings.filter((s) => getMemberConference(s.user_id) === "A");
  const confBStandings = standings.filter((s) => getMemberConference(s.user_id) === "B");
  const unassigned = standings.filter((s) => !getMemberConference(s.user_id));

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading...</p>
    </main>
  );

  const tableProps = { user, members, scores, standings };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Nav
        leagueId={leagueId}
        leagueName={league?.name}
        isCommissioner={isCommissioner}
        activePage="standings"
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black mb-1">{league?.name}</h1>
        <p className="text-gray-400 text-sm mb-8">Standings · Updates after each playoff week</p>

        {standings.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
            <p className="text-4xl mb-4">🏆</p>
            <p className="text-gray-300 text-lg font-bold mb-2">No scores yet</p>
            <p className="text-gray-500 text-sm">Standings update automatically after each playoff week.</p>
          </div>
        ) : conferenceEnabled ? (
          <div className="flex flex-col gap-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-black text-white">{confAName}</h2>
                <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded-full font-bold">Conference</span>
              </div>
              <StandingsTable rows={confAStandings} {...tableProps} />
            </div>

            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-black text-white">{confBName}</h2>
                <span className="text-xs bg-purple-900 text-purple-300 px-2 py-1 rounded-full font-bold">Conference</span>
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
                <h2 className="text-xl font-black text-white">Overall</h2>
                <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded-full font-bold">All Teams</span>
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