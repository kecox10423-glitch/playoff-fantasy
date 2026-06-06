"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";
import Nav from "../../components/Nav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

  function getMemberName(userId: string) {
    return members.find(m => m.user_id === userId)?.team_name || "Unknown";
  }

  function getWeekScore(userId: string, week: number) {
    const score = scores.find(s => s.user_id === userId && s.week === week);
    return score ? score.total_points.toFixed(1) : "—";
  }

  const isCommissioner = user?.id === league?.commissioner_user_id;

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading...</p>
    </main>
  );

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
        ) : (
          <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Rank</th>
                  <th className="text-left px-4 py-3">Team</th>
                  <th className="text-right px-4 py-3">Wild Card</th>
                  <th className="text-right px-4 py-3">Divisional</th>
                  <th className="text-right px-4 py-3">Conf. Champ</th>
                  <th className="text-right px-4 py-3">Super Bowl</th>
                  <th className="text-right px-4 py-3 text-white">Total</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing, i) => {
                  const isMe = standing.user_id === user?.id;
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
                          <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-black">
                            {getMemberName(standing.user_id).charAt(0)}
                          </div>
                          <span className={`font-bold ${isMe ? "text-green-400" : "text-white"}`}>
                            {getMemberName(standing.user_id)}
                          </span>
                          {isMe && <span className="text-xs text-gray-500">(You)</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-300 text-sm">{getWeekScore(standing.user_id, 1)}</td>
                      <td className="px-4 py-4 text-right text-gray-300 text-sm">{getWeekScore(standing.user_id, 2)}</td>
                      <td className="px-4 py-4 text-right text-gray-300 text-sm">{getWeekScore(standing.user_id, 3)}</td>
                      <td className="px-4 py-4 text-right text-gray-300 text-sm">{getWeekScore(standing.user_id, 4)}</td>
                      <td className="px-4 py-4 text-right font-black text-green-400 text-lg">{standing.total_points.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}