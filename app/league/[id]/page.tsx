"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LeaguePage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
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

      setLeague(leagueData);
      setMembers(membersData || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading...</p>
    </main>
  );

  if (!league) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>League not found.</p>
    </main>
  );

  const isCommissioner = user?.id === league.commissioner_user_id;
  const spotsLeft = league.num_teams - members.length;
  const inviteLink = `${window.location.origin}/join/${league.invite_code}`;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white mb-6 block">
          ← Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mb-2">{league.name}</h1>
        <p className="text-gray-400 mb-8">
          {league.scoring_format} · {league.draft_type} Draft · {league.num_teams} Teams
        </p>

        <div className="flex gap-4 mb-6 flex-wrap">
          {isCommissioner && (
            <>
              <button
                onClick={() => router.push(`/draft/${league.id}`)}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg"
              >
                Draft Room
              </button>
              <button
                onClick={() => router.push(`/manual-draft/${league.id}`)}
                className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg"
              >
                Manual Draft
              </button>
            </>
          )}
          <button
            onClick={() => router.push(`/standings/${league.id}`)}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Standings
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-2">Invite Friends</h2>
          <p className="text-gray-400 mb-4">
            {members.length}/{league.num_teams} teams joined · {spotsLeft} spots left
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 bg-gray-700 text-white p-3 rounded-lg text-sm"
            />
            <button
              onClick={() => navigator.clipboard.writeText(inviteLink)}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg"
            >
              Copy
            </button>
          </div>
          <p className="text-gray-500 mt-2 text-sm">
            Invite code: <span className="text-white font-mono">{league.invite_code}</span>
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">Teams ({members.length}/{league.num_teams})</h2>
          {members.map((member, i) => (
            <div key={member.id} className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0">
              <span className="text-gray-500">#{i + 1}</span>
              <span>{member.team_name}</span>
              {member.user_id === league.commissioner_user_id && (
                <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded">Commissioner</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}