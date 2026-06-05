"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: memberData } = await supabase
        .from("league_members")
        .select("league_id")
        .eq("user_id", user.id);

      if (memberData && memberData.length > 0) {
        const leagueIds = memberData.map((m: any) => m.league_id);
        const { data: leagueData } = await supabase
          .from("leagues")
          .select("*")
          .in("id", leagueIds);
        setLeagues(leagueData || []);
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Leagues</h1>
          <button onClick={handleLogout} className="text-gray-400 hover:text-white">
            Log Out
          </button>
        </div>
        <p className="text-gray-400 mb-8">Welcome, {user.email}</p>
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => router.push("/create-league")}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg"
          >
            + Create League
          </button>
          <button
            onClick={() => router.push("/join-league")}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg"
          >
            Join League
          </button>
        </div>

        {leagues.length === 0 ? (
          <p className="text-gray-400">No leagues yet. Create one to get started.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {leagues.map(league => (
              <div
                key={league.id}
                onClick={() => router.push(`/league/${league.id}`)}
                className="bg-gray-800 hover:bg-gray-700 cursor-pointer rounded-lg p-6 flex justify-between items-center"
              >
                <div>
                  <h2 className="text-xl font-bold">{league.name}</h2>
                  <p className="text-gray-400">{league.scoring_format} · {league.draft_type} Draft · {league.num_teams} Teams</p>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}