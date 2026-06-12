"use client";
import { useState } from "react";
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
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">

          {/* Left: Logo + League Name */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            <PFFLLogo size={32} />
            <div>
              <p className="text-xs text-gray-500 leading-none">Playoff Fantasy</p>
              {leagueName && (
                <p className="text-sm font-bold text-white leading-none mt-0.5 max-w-[140px] sm:max-w-none truncate">
                  {leagueName}
                </p>
              )}
            </div>
          </div>

          {/* Center: League Tabs — desktop only */}
          {leagueId && (
            <div className="hidden md:flex items-center gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.page}
                  onClick={() => navigate(tab.path)}
                  className={`px-3 py-1.5 rounded text-sm font-bold ${
                    activePage === tab.page
                      ? "bg-green-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Right: My Leagues + Logout (desktop) / Hamburger (mobile) */}
          <div className="flex items-center gap-3">
            {/* Desktop right side */}
            <div className="hidden md:flex items-center gap-3">
              {leagueId && (
                <button
                  onClick={() => navigate("/dashboard")}
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

            {/* Mobile hamburger */}
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

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-900 px-4 py-3 flex flex-col gap-1">
          {tabs.map(tab => (
            <button
              key={tab.page}
              onClick={() => navigate(tab.path)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold ${
                activePage === tab.page
                  ? "bg-green-600 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="border-t border-gray-800 mt-2 pt-2 flex flex-col gap-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full text-left px-4 py-3 rounded-lg text-sm text-gray-400 hover:bg-gray-800"
            >
              My Leagues
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 rounded-lg text-sm text-gray-500 hover:bg-gray-800"
            >
              Log Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}