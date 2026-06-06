"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

interface NavProps {
  leagueId?: string;
  leagueName?: string;
  isCommissioner?: boolean;
  activePage?: "draft" | "standings" | "roster" | "settings" | "league";
}

export default function Nav({ leagueId, leagueName, isCommissioner, activePage }: NavProps) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">

          {/* Left: Logo + League Name */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <PFFLLogo size={32} />
            <div>
              <p className="text-xs text-gray-500 leading-none">Playoff Fantasy</p>
              {leagueName && <p className="text-sm font-bold text-white leading-none mt-0.5">{leagueName}</p>}
            </div>
          </div>

          {/* Center: League Tabs (only when in a league) */}
          {leagueId && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => router.push(`/draft/${leagueId}`)}
                className={`px-3 py-1.5 rounded text-sm font-bold ${activePage === "draft" ? "bg-green-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                Draft
              </button>
              <button
                onClick={() => router.push(`/standings/${leagueId}`)}
                className={`px-3 py-1.5 rounded text-sm font-bold ${activePage === "standings" ? "bg-green-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                Standings
              </button>
              <button
                onClick={() => router.push(`/roster/${leagueId}`)}
                className={`px-3 py-1.5 rounded text-sm font-bold ${activePage === "roster" ? "bg-green-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                Rosters
              </button>
              {isCommissioner && (
                <button
                  onClick={() => router.push(`/league-settings/${leagueId}`)}
                  className={`px-3 py-1.5 rounded text-sm font-bold ${activePage === "settings" ? "bg-green-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                >
                  ⚙ Settings
                </button>
              )}
            </div>
          )}

          {/* Right: Dashboard + Logout */}
          <div className="flex items-center gap-3">
            {leagueId && (
              <button
                onClick={() => router.push("/dashboard")}
                className="text-gray-400 hover:text-white text-sm"
              >
                My Leagues
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-white text-xs"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}