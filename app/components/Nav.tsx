"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

interface NavProps {
  leagueId?: string;
  leagueName?: string;
  isCommissioner?: boolean;
  activePage?: "draft" | "standings" | "roster" | "settings" | "league";
}

export default function Nav({ leagueId, leagueName, isCommissioner, activePage }: NavProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    async function loadName() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (leagueId) {
        const { data: member } = await supabase
          .from("league_members")
          .select("team_name")
          .eq("league_id", leagueId)
          .eq("user_id", user.id)
          .single();
        if (member?.team_name) { setDisplayName(member.team_name); return; }
      }
      const { data: anyMember } = await supabase
        .from("league_members")
        .select("team_name")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (anyMember?.team_name) setDisplayName(anyMember.team_name);
      else setDisplayName(user.email?.split("@")[0] || null);
    }
    loadName();
  }, [leagueId]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function navigate(path: string) {
    setMenuOpen(false);
    router.push(path);
  }

  const tabs = leagueId ? [
    { label: "League", page: "league", path: `/league/${leagueId}` },
    { label: "Draft", page: "draft", path: `/draft/${leagueId}` },
    { label: "Standings", page: "standings", path: `/standings/${leagueId}` },
    { label: "Rosters", page: "roster", path: `/roster/${leagueId}` },
    ...(isCommissioner ? [{ label: "⚙ Settings", page: "settings", path: `/commissioner-tools/${leagueId}` }] : []),
  ] : [];

  return (
    <nav className="bg-gray-900/80 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50 shadow-[0_1px_0_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.4)]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">

          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <PFFLLogo size={32} />
            <div>
              <p className="text-xs text-gray-500 leading-none tracking-wide">Playoff Fantasy</p>
              {leagueName && (
                <p className="text-sm font-bold text-white leading-none mt-0.5 max-w-[140px] sm:max-w-none truncate">
                  {leagueName}
                </p>
              )}
            </div>
          </div>

          {leagueId && (
            <div className="hidden md:flex items-center gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.page}
                  onClick={() => navigate(tab.path)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-150 ${
                    activePage === tab.page
                      ? "bg-gradient-to-b from-green-500 to-green-700 text-white shadow-md shadow-green-900/40"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              {displayName && (
                <span className="text-xs text-gray-400 font-medium">{displayName}</span>
              )}
              {leagueId && (
                <button onClick={() => navigate("/dashboard")} className="text-gray-400 hover:text-white text-sm transition-colors">
                  My Leagues
                </button>
              )}
              <button onClick={handleLogout} className="text-gray-500 hover:text-white text-xs transition-colors">
                Log Out
              </button>
            </div>

            <button
              className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <span className={`block w-5 h-0.5 bg-gray-400 transition-all duration-200 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
              <span className={`block w-5 h-0.5 bg-gray-400 transition-all duration-200 ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-0.5 bg-gray-400 transition-all duration-200 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-700 bg-gray-900/95 backdrop-blur-md px-4 py-3 flex flex-col gap-1">
          {displayName && (
            <p className="text-xs text-gray-500 px-4 py-2 font-medium">{displayName}</p>
          )}
          {tabs.map(tab => (
            <button
              key={tab.page}
              onClick={() => navigate(tab.path)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                activePage === tab.page
                  ? "bg-gradient-to-b from-green-500 to-green-700 text-white shadow-md shadow-green-900/40"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="border-t border-gray-700 mt-2 pt-2 flex flex-col gap-1">
            <button onClick={() => navigate("/dashboard")} className="w-full text-left px-4 py-3 rounded-lg text-sm text-gray-400 hover:bg-gray-800">
              My Leagues
            </button>
            <button onClick={handleLogout} className="w-full text-left px-4 py-3 rounded-lg text-sm text-gray-500 hover:bg-gray-800">
              Log Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}