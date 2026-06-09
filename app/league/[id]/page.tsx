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
  const [assigningConferences, setAssigningConferences] = useState(false);
  const [manualConferences, setManualConferences] = useState<{ [userId: string]: string }>({});
  const [savingConferences, setSavingConferences] = useState(false);
  const [conferencesSaved, setConferencesSaved] = useState(false);
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

      // Pre-fill manual conference assignments from existing data
      const existing: { [userId: string]: string } = {};
      (membersData || []).forEach((m: any) => {
        if (m.conference) existing[m.user_id] = m.conference;
      });
      setManualConferences(existing);

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

  async function randomlyAssignConferences() {
    setAssigningConferences(true);
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);

    const updates: { [userId: string]: string } = {};
    shuffled.forEach((m, i) => {
      updates[m.user_id] = i < half ? "A" : "B";
    });

    for (const [userId, conference] of Object.entries(updates)) {
      await supabase
        .from("league_members")
        .update({ conference })
        .eq("league_id", leagueId)
        .eq("user_id", userId);
    }

    setManualConferences(updates);
    setMembers(prev => prev.map(m => ({ ...m, conference: updates[m.user_id] })));
    setAssigningConferences(false);
    setConferencesSaved(true);
    setTimeout(() => setConferencesSaved(false), 3000);
  }

  async function saveManualConferences() {
    setSavingConferences(true);
    for (const [userId, conference] of Object.entries(manualConferences)) {
      await supabase
        .from("league_members")
        .update({ conference })
        .eq("league_id", leagueId)
        .eq("user_id", userId);
    }
    setMembers(prev => prev.map(m => ({
      ...m,
      conference: manualConferences[m.user_id] || m.conference
    })));
    setSavingConferences(false);
    setConferencesSaved(true);
    setTimeout(() => setConferencesSaved(false), 3000);
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
  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/join/${league.invite_code}` : "";
  const draftComplete = league.draft_status === "COMPLETED";
  const conferenceEnabled = league.conference_enabled;
  const confAName = league.conference_a_name || "AFC";
  const confBName = league.conference_b_name || "NFC";

  function getConferenceBadge(member: any) {
    if (!conferenceEnabled || !member.conference) return null;
    const isA = member.conference === "A";
    return (
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
        isA ? "bg-blue-900 text-blue-300" : "bg-purple-900 text-purple-300"
      }`}>
        {isA ? confAName : confBName}
      </span>
    );
  }

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
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-black mb-1">{league.name}</h1>
              <div className="flex flex-wrap gap-2 text-sm text-gray-400">
                <span>{league.scoring_format}</span>
                <span>·</span>
                <span>{league.draft_type} Draft</span>
                <span>·</span>
                <span>{league.num_teams} Teams</span>
                {conferenceEnabled && (
                  <>
                    <span>·</span>
                    <span className="text-green-400">{confAName} / {confBName}</span>
                  </>
                )}
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
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
                  {getConferenceBadge(member)}
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
                  className="flex-1 bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none min-w-0"
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

            {/* Conference Assignment */}
            {conferenceEnabled && (
              <div className="mb-6 bg-gray-800 rounded-xl p-5">
                <p className="font-bold text-white mb-1">Conference Assignment</p>
                <p className="text-gray-400 text-xs mb-4">
                  Randomly assign teams to {confAName} and {confBName}, or set manually.
                </p>

                <button
                  onClick={randomlyAssignConferences}
                  disabled={assigningConferences}
                  className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-2 px-5 rounded-lg text-sm mb-4 transition-colors"
                >
                  {assigningConferences ? "Assigning..." : "🎲 Randomly Assign Conferences"}
                </button>

                <p className="text-gray-500 text-xs mb-3">Or assign manually:</p>
                <div className="flex flex-col gap-2">
                  {members.map(member => (
                    <div key={member.user_id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{member.team_name}</span>
                      <select
                        value={manualConferences[member.user_id] || ""}
                        onChange={(e) => setManualConferences(prev => ({
                          ...prev,
                          [member.user_id]: e.target.value
                        }))}
                        className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded-lg border border-gray-600 focus:outline-none focus:border-green-500"
                      >
                        <option value="">Unassigned</option>
                        <option value="A">{confAName}</option>
                        <option value="B">{confBName}</option>
                      </select>
                    </div>
                  ))}
                </div>

                <button
                  onClick={saveManualConferences}
                  disabled={savingConferences}
                  className={`mt-4 w-full font-bold py-2 rounded-lg text-sm transition-colors ${
                    conferencesSaved
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  }`}
                >
                  {savingConferences ? "Saving..." : conferencesSaved ? "✓ Saved!" : "Save Conference Assignments"}
                </button>
              </div>
            )}

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