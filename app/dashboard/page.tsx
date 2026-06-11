"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function PFFLLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/apple-touch-icon.png"
      alt="PFFL Logo"
      width={size}
      height={size}
      style={{ borderRadius: "20%" }}
    />
  );
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading...</p>
    </main>
  );

  function getDraftStatusBadge(league: any) {
    if (league.draft_status === "COMPLETED") return { label: "Draft Complete", color: "bg-green-900 text-green-400" };
    if (league.draft_status === "IN_PROGRESS") return { label: "Drafting Now", color: "bg-yellow-900 text-yellow-400 animate-pulse" };
    return { label: "Draft Pending", color: "bg-gray-700 text-gray-400" };
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Nav */}
      <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PFFLLogo size={32} />
            <div>
              <p className="text-xs text-gray-500 leading-none">Playoff Fantasy</p>
              <p className="text-sm font-bold text-white leading-none mt-0.5">My Leagues</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-white text-xs"
          >
            Log Out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-black mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm">{user?.email}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => router.push("/create-league")}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg"
          >
            + Create League
          </button>
          <button
            onClick={() => router.push("/join-league")}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Join League
          </button>
        </div>

        {/* Leagues */}
        {leagues.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
            <p className="text-4xl mb-4">🏈</p>
            <p className="text-gray-300 text-lg font-bold mb-2">No leagues yet</p>
            <p className="text-gray-500 text-sm mb-6">Create a league and invite your friends to get started.</p>
            <button
              onClick={() => router.push("/create-league")}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg"
            >
              Create Your First League
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs text-gray-500 uppercase tracking-wider font-bold">Your Leagues</h2>
            {leagues.map(league => {
              const badge = getDraftStatusBadge(league);
              return (
                <div
                  key={league.id}
                  onClick={() => router.push(`/league/${league.id}`)}
                  className="bg-gray-900 hover:bg-gray-800 cursor-pointer rounded-xl p-5 flex justify-between items-center border border-gray-800 hover:border-gray-700 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-900 flex items-center justify-center text-xl font-black text-green-400">
                      {league.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">{league.name}</h2>
                      <p className="text-gray-500 text-sm">
                        {league.scoring_format} · {league.draft_type} Draft · {league.num_teams} Teams
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-gray-600">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}