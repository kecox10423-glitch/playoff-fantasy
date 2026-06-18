"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_USER_ID = "ae7339be-6503-45c1-91d0-eb09b9806a74";

export default function AdminLeaguesPage() {
  const [user, setUser] = useState<any>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [leagueMembers, setLeagueMembers] = useState<{ [leagueId: string]: any[] }>({});
  const [expandedLeagueId, setExpandedLeagueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [syncingStats, setSyncingStats] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ leagueId: string; userId: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      if (user.id !== ADMIN_USER_ID) { router.push("/dashboard"); return; }
      setUser(user);

      const { data: leaguesData } = await supabase
        .from("leagues")
        .select("*, league_members(count)")
        .order("created_at", { ascending: false });

      setLeagues(leaguesData || []);
      setLoading(false);
    }
    load();
  }, []);

  async function loadMembers(leagueId: string) {
    if (leagueMembers[leagueId]) return; // already loaded
    const { data } = await supabase
      .from("league_members")
      .select("*")
      .eq("league_id", leagueId);
    setLeagueMembers(prev => ({ ...prev, [leagueId]: data || [] }));
  }

  async function toggleExpand(leagueId: string) {
    if (expandedLeagueId === leagueId) {
      setExpandedLeagueId(null);
    } else {
      setExpandedLeagueId(leagueId);
      await loadMembers(leagueId);
    }
  }

  async function handleDelete(leagueId: string) {
    setDeletingId(leagueId);
    const res = await fetch("/api/admin/delete-league", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, leagueId }),
    });

    if (res.ok) {
      setLeagues(prev => prev.filter(l => l.id !== leagueId));
    } else {
      const data = await res.json();
      alert(`Failed to delete: ${data.error}`);
    }

    setDeletingId(null);
    setConfirmId(null);
  }

  async function handleSyncStats() {
    setSyncingStats(true);
    setSyncResult(null);
    const res = await fetch("/api/admin/sync-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    const data = await res.json();
    setSyncResult(data);
    setSyncingStats(false);
  }

  async function handleRemoveMember(leagueId: string, targetUserId: string) {
    setRemovingMemberId(targetUserId);
    const res = await fetch("/api/commissioner/remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId,
        requestingUserId: user.id,
        targetUserId,
      }),
    });

    if (res.ok) {
      setLeagueMembers(prev => ({
        ...prev,
        [leagueId]: (prev[leagueId] || []).filter(m => m.user_id !== targetUserId),
      }));
      setLeagues(prev => prev.map(l =>
        l.id === leagueId
          ? { ...l, league_members: [{ count: (l.league_members?.[0]?.count || 1) - 1 }] }
          : l
      ));
    } else {
      const data = await res.json();
      alert(`Failed to remove: ${data.error}`);
    }

    setRemovingMemberId(null);
    setConfirmRemove(null);
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading...</p>
    </main>
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-gray-400 hover:text-white text-sm block mb-4"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-2xl font-black mb-1">Admin</h1>
        <p className="text-gray-400 text-sm mb-8">{leagues.length} total leagues</p>

        {/* Sync Stats */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
          <p className="font-bold text-white mb-1">Player Stats Sync</p>
          <p className="text-gray-500 text-xs mb-4">
            Pulls 2025 full season stats from Sleeper API for all players and stores them in the database.
          </p>
          <button
            onClick={handleSyncStats}
            disabled={syncingStats}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            {syncingStats ? "Syncing... (this may take 30-60 seconds)" : "🔄 Sync 2025 Player Stats"}
          </button>

          {syncResult && (
            <div className={`mt-4 p-4 rounded-lg text-sm ${syncResult.success ? "bg-green-900 border border-green-700" : "bg-red-900 border border-red-700"}`}>
              {syncResult.success ? (
                <>
                  <p className="text-green-400 font-bold mb-1">✓ Sync complete</p>
                  <p className="text-green-300">Matched: {syncResult.matched} players</p>
                  <p className="text-green-300">Total players: {syncResult.total}</p>
                  {syncResult.unmatched?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-yellow-400 font-bold">Unmatched ({syncResult.unmatched.length}):</p>
                      <p className="text-yellow-300 text-xs">{syncResult.unmatched.join(", ")}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-red-400 font-bold">Error: {syncResult.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Leagues List */}
        <h2 className="font-bold text-gray-300 uppercase text-xs tracking-wider mb-3">All Leagues</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          {leagues.map(league => {
            const memberCount = league.league_members?.[0]?.count ?? 0;
            const isConfirming = confirmId === league.id;
            const isDeleting = deletingId === league.id;
            const isExpanded = expandedLeagueId === league.id;
            const members = leagueMembers[league.id] || [];

            return (
              <div key={league.id}>
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">{league.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {memberCount}/{league.num_teams} teams · {league.draft_status} · {league.draft_type}
                    </p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Created {new Date(league.created_at).toLocaleDateString()} · Invite: {league.invite_code}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleExpand(league.id)}
                      className="text-xs text-gray-400 hover:text-white border border-gray-700 px-2.5 py-1.5 rounded font-bold"
                    >
                      {isExpanded ? "Hide Members" : "Members"}
                    </button>

                    {isConfirming ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(league.id)}
                          disabled={isDeleting}
                          className="bg-red-700 hover:bg-red-600 disabled:bg-gray-700 text-white font-bold text-xs px-3 py-1.5 rounded"
                        >
                          {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs px-3 py-1.5 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(league.id)}
                        className="bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-300 font-bold text-xs px-3 py-1.5 rounded transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded members list */}
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-800 bg-gray-950">
                    {members.length === 0 ? (
                      <p className="text-gray-600 text-xs py-3">No members yet.</p>
                    ) : (
                      <div className="divide-y divide-gray-800">
                        {members.map(member => {
                          const isCommissioner = member.user_id === league.commissioner_user_id;
                          const isConfirmingThisRemove = confirmRemove?.leagueId === league.id && confirmRemove?.userId === member.user_id;
                          const isRemovingThis = removingMemberId === member.user_id;

                          return (
                            <div key={member.id} className="flex items-center justify-between py-2 gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-white truncate">{member.team_name}</p>
                                <p className="text-xs text-gray-600 truncate">{member.user_id}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {isCommissioner && (
                                  <span className="text-xs bg-green-900 text-green-400 px-2 py-0.5 rounded-full font-bold">Commish</span>
                                )}
                                {!isCommissioner && (
                                  isConfirmingThisRemove ? (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleRemoveMember(league.id, member.user_id)}
                                        disabled={isRemovingThis}
                                        className="text-xs bg-red-700 hover:bg-red-600 disabled:bg-gray-700 text-white font-bold px-2 py-1 rounded"
                                      >
                                        {isRemovingThis ? "..." : "Confirm"}
                                      </button>
                                      <button
                                        onClick={() => setConfirmRemove(null)}
                                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white font-bold px-2 py-1 rounded"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmRemove({ leagueId: league.id, userId: member.user_id })}
                                      className="text-xs text-gray-600 hover:text-red-400 font-bold px-1.5 py-1 rounded hover:bg-red-950 transition-colors"
                                    >
                                      Remove
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {leagues.length === 0 && (
            <p className="text-gray-600 text-sm px-4 py-6 text-center">No leagues found.</p>
          )}
        </div>
      </div>
    </main>
  );
}