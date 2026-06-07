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
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5 L90 20 L90 55 Q90 80 50 95 Q10 80 10 55 L10 20 Z" fill="#111827" stroke="#22c55e" strokeWidth="3"/>
      <path d="M50 12 L83 25 L83 54 Q83 75 50 88 Q17 75 17 54 L17 25 Z" fill="#1f2937"/>
      <ellipse cx="50" cy="50" rx="20" ry="13" fill="none" stroke="#22c55e" strokeWidth="2"/>
      <line x1="50" y1="37" x2="50" y2="63" stroke="#22c55e" strokeWidth="1.5"/>
      <line x1="45" y1="44" x2="55" y2="44" stroke="#22c55e" strokeWidth="1.5"/>
      <line x1="44" y1="50" x2="56" y2="50" stroke="#22c55e" strokeWidth="1.5"/>
      <line x1="45" y1="56" x2="55" y2="56" stroke="#22c55e" strokeWidth="1.5"/>
      <text x="50" y="78" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="bold" fontFamily="Arial">PFFL</text>
    </svg>
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