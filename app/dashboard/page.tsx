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
    <img src="/apple-touch-icon.png" alt="PFFL Logo" width={size} height={size} style={{ borderRadius: "20%" }} />
  );
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: memberData } = await supabase
        .from("league_members")
        .select("league_id, team_name")
        .eq("user_id", user.id);

      const firstName = memberData?.[0]?.team_name;
      setDisplayName(firstName || user.email?.split("@")[0] || "");

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
      <p className="text-gray-400">Loading...</p>
    </main>
  );

  function getDraftStatusBadge(league: any) {
    if (league.draft_status === "COMPLETED") return { label: "Draft Complete", color: "bg-green-900/60 text-green-400 ring-1 ring-green-700/50" };
    if (league.draft_status === "IN_PROGRESS") return { label: "Drafting Now 🔴", color: "bg-yellow-900/60 text-yellow-400 ring-1 ring-yellow-700/50 animate-pulse" };
    return { label: "Draft Pending", color: "bg-gray-800 text-gray-400 ring-1 ring-gray-700" };
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      <nav className="bg-gray-900/80 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50 shadow-[0_1px_0_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.4)]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PFFLLogo size={32} />
            <div>
              <p className="text-xs text-gray-500 leading-none tracking-wide">Playoff Fantasy</p>
              <p className="text-sm font-bold text-white leading-none mt-0.5">My Leagues</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {displayName && <span className="text-xs text-gray-400 font-medium hidden sm:block">{displayName}</span>}
            <button onClick={handleLogout} className="text-gray-500 hover:text-white text-xs transition-colors">
              Log Out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="mb-8">
          <h1 className="text-3xl font-black mb-1">Welcome back{displayName ? `, ${displayName}` : ""}</h1>
          <p className="text-gray-500 text-sm">Manage your playoff fantasy leagues</p>
        </div>

        <div className="flex gap-3 mb-8">
          <button
            onClick={() => router.push("/create-league")}
            className="bg-gradient-to-b from-green-500 to-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-green-900/40 hover:shadow-green-900/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150"
          >
            + Create League
          </button>
          <button
            onClick={() => router.push("/join-league")}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-xl border border-gray-600 hover:border-gray-500 transition-all duration-150"
          >
            Join League
          </button>
        </div>

        {leagues.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-12 text-center border border-gray-700 shadow-xl">
            <p className="text-5xl mb-4">🏈</p>
            <p className="text-gray-200 text-xl font-black mb-2">No leagues yet</p>
            <p className="text-gray-500 text-sm mb-6">Create a league and invite your friends to get started.</p>
            <button
              onClick={() => router.push("/create-league")}
              className="bg-gradient-to-b from-green-500 to-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-green-900/40 hover:shadow-green-900/60 hover:-translate-y-0.5 transition-all duration-150"
            >
              Create Your First League
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs text-gray-500 uppercase tracking-widest font-bold">Your Leagues</h2>
            {leagues.map(league => {
              const badge = getDraftStatusBadge(league);
              return (
                <div
                  key={league.id}
                  onClick={() => router.push(`/league/${league.id}`)}
                  className="bg-gray-900 hover:bg-gray-800/80 cursor-pointer rounded-2xl p-5 flex justify-between items-center border border-gray-700 hover:border-gray-600 shadow-lg hover:shadow-xl transition-all duration-150"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-green-600 to-green-800 flex items-center justify-center text-xl font-black text-white shadow-md shadow-green-900/40">
                      {league.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight">{league.name}</h2>
                      <p className="text-gray-500 text-sm">
                        {league.scoring_format} · {league.draft_type} Draft · {league.num_teams} Teams
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.color}`}>
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