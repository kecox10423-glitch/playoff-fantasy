"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";
import Nav from "../../components/Nav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LeaguePage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id as string;

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

  function copyInvite() {
    const inviteLink = `${window.location.origin}/join/${league.invite_code}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openDraftRoom() {
    window.open(
      `/draft/${leagueId}`,
      'draftroom',
      'width=1400,height=900,scrollbars=no,resizable=yes'
    );
  }

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
  const draftComplete = league.draft_status === "COMPLETED";

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Nav
        leagueId={leagueId}
        leagueName={league.name}
        isCommissioner={isCommissioner}
        activePage="league"
      />

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* League Header Card */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-black mb-1">{league.name}</h1>
              <div className="flex gap-3 text-sm text-gray-400">
                <span>{league.scoring_format}</span>
                <span>·</span>
                <span>{league.draft_type} Draft</span>
                <span>·</span>
                <span>{league.num_teams} Teams</span>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              draftComplete
                ? "bg-green-900 text-green-400"
                : "bg-yellow-900 text-yellow-400"
            }`}>
              {draftComplete ? "Draft Complete" : "Draft Pending"}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{members.length}/{league.num_teams}</p>
              <p className="text-xs text-gray-500 mt-1">Teams Joined</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-green-400">{spotsLeft}</p>
              <p className="text-xs text-gray-500 mt-1">Spots Left</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-white">4</p>
              <p className="text-xs text-gray-500 mt-1">Playoff Weeks</p>
            </div>
          </div>

          {/* Draft Room Button */}
          <button
            onClick={openDraftRoom}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-lg text-lg transition-colors"
          >
            🏈 Enter Draft Room
          </button>
        </div>

        {/* Teams List */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <h2 className="font-bold mb-4 text-gray-300 uppercase text-xs tracking-wider">
            Teams ({members.length}/{league.num_teams})
          </h2>
          <div className="flex flex-col gap-1">
            {members.map((member, i) => (
              <div key={member.id} className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-black flex-shrink-0">
                  {member.team_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold">{member.team_name}</span>
                  {member.user_id === user?.id && (
                    <span className="text-xs text-gray-500 ml-2">(You)</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {member.user_id === league.commissioner_user_id && (
                    <span className="text-xs bg-green-900 text-green-400 px-2 py-0.5 rounded-full">Commissioner</span>
                  )}
                  <span className="text-xs text-gray-600">#{i + 1}</span>
                </div>
              </div>
            ))}
            {spotsLeft > 0 && (
              <div className="flex items-center gap-3 py-2.5 opacity-40">
                <div className="w-8 h-8 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-gray-600 text-sm flex-shrink-0">+</div>
                <span className="text-gray-600 text-sm">{spotsLeft} spot{spotsLeft > 1 ? "s" : ""} remaining</span>
              </div>
            )}
          </div>
        </div>

        {/* Commissioner Panel */}
        {isCommissioner && (
          <div className="bg-gray-900 rounded-xl p-6 border border-dashed border-gray-700">
            <h2 className="font-bold mb-4 text-gray-400 uppercase text-xs tracking-wider">
              ⚙ Commissioner Tools
            </h2>

            {/* Invite */}
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-2">Invite Link</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  className="flex-1 bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none"
                />
                <button
                  onClick={copyInvite}
                  className={`font-bold py-2.5 px-5 rounded-lg text-sm transition-colors flex-shrink-0 ${
                    copied ? "bg-blue-600 text-white" : "bg-green-600 hover:bg-green-500 text-white"
                  }`}
                >
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-gray-600 text-xs mt-1.5">
                Invite code: <span className="font-mono text-gray-400">{league.invite_code}</span>
              </p>
            </div>

            {/* Commissioner Actions */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => router.push(`/manual-draft/${leagueId}`)}
                className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors"
              >
                Manual Draft Upload
              </button>
              <button
                onClick={() => router.push(`/league-settings/${leagueId}`)}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors"
              >
                Scoring Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}