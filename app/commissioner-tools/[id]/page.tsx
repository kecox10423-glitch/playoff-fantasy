"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";
import Nav from "../../components/Nav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CommissionerToolsPage() {
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

  if (!isCommissioner) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-red-400">Only the commissioner can access these tools.</p>
      </main>
    );
  }

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/join/${league.invite_code}` : "";
  const conferenceEnabled = league.conference_enabled;
  const confAName = league.conference_a_name || "AFC";
  const confBName = league.conference_b_name || "NFC";

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Nav
        leagueId={leagueId}
        leagueName={league.name}
        isCommissioner={isCommissioner}
        activePage="settings"
      />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push(`/league/${leagueId}`)}
          className="text-gray-400 hover:text-white text-sm block mb-4"
        >
          ← Back to League
        </button>

        <h1 className="text-2xl font-black mb-1">Commissioner Tools</h1>
        <p className="text-gray-400 text-sm mb-8">{league.name}</p>

        {/* Invite */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <p className="font-bold text-white mb-3">Invite Link</p>
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
          <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
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

        {/* Links to other tools */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          <button
            onClick={() => router.push(`/manual-draft/${leagueId}`)}
            className="w-full text-left px-6 py-4 hover:bg-gray-800 transition-colors flex items-center justify-between"
          >
            <div>
              <p className="font-bold text-white">Manual Draft Upload</p>
              <p className="text-gray-500 text-xs mt-0.5">Enter draft results if your league drafted offline</p>
            </div>
            <span className="text-gray-600">→</span>
          </button>

          <button
            onClick={() => router.push(`/league-settings/${leagueId}`)}
            className="w-full text-left px-6 py-4 hover:bg-gray-800 transition-colors flex items-center justify-between"
          >
            <div>
              <p className="font-bold text-white">Scoring Settings</p>
              <p className="text-gray-500 text-xs mt-0.5">Customize point values and conference names</p>
            </div>
            <span className="text-gray-600">→</span>
          </button>

          <button
            onClick={() => router.push(`/league-email/${leagueId}`)}
            className="w-full text-left px-6 py-4 hover:bg-gray-800 transition-colors flex items-center justify-between"
          >
            <div>
              <p className="font-bold text-white">✉ Email League</p>
              <p className="text-gray-500 text-xs mt-0.5">Send a message to your league members</p>
            </div>
            <span className="text-gray-600">→</span>
          </button>
        </div>
      </div>
    </main>
  );
}