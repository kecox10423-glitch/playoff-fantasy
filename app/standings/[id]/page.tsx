"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";

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
  const leagueId = params.id;

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
    return score ? score.total_points.toFixed(1) : "-";
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading...</p>
    </main>
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push(`/league/${leagueId}`)}
          className="text-gray-400 hover:text-white mb-6 block"
        >
          ← Back to League
        </button>

        <h1 className="text-3xl font-bold mb-2">{league?.name}</h1>
        <p className="text-gray-400 mb-8">Standings</p>

        {standings.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 text-lg">No scores yet.</p>
            <p className="text-gray-500 mt-2">Standings will update after each playoff week.</p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800 text-gray-400 text-sm">
                  <th className="text-left p-4">Rank</th>
                  <th className="text-left p-4">Team</th>
                  <th className="text-right p-4">Wk 1</th>
                  <th className="text-right p-4">Wk 2</th>
                  <th className="text-right p-4">Wk 3</th>
                  <th className="text-right p-4">Wk 4</th>
                  <th className="text-right p-4 text-white font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing, i) => (
                  <tr
                    key={standing.id}
                    className={`border-t border-gray-800 ${standing.user_id === user?.id ? "bg-gray-800" : ""}`}
                  >
                    <td className="p-4 text-gray-400">#{i + 1}</td>
                    <td className="p-4 font-bold">{getMemberName(standing.user_id)}</td>
                    <td className="p-4 text-right text-gray-300">{getWeekScore(standing.user_id, 1)}</td>
                    <td className="p-4 text-right text-gray-300">{getWeekScore(standing.user_id, 2)}</td>
                    <td className="p-4 text-right text-gray-300">{getWeekScore(standing.user_id, 3)}</td>
                    <td className="p-4 text-right text-gray-300">{getWeekScore(standing.user_id, 4)}</td>
                    <td className="p-4 text-right font-bold text-green-400">{standing.total_points.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}