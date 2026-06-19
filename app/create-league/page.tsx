"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default function CreateLeague() {
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [numTeams, setNumTeams] = useState(6);
  const [scoringFormat, setScoringFormat] = useState("PPR");
  const [draftType, setDraftType] = useState("LIVE");
  const [conferenceEnabled, setConferenceEnabled] = useState(false);
  const [conferenceAName, setConferenceAName] = useState("AFC");
  const [conferenceBName, setConferenceBName] = useState("NFC");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleNumTeamsChange(val: number) {
    setNumTeams(val);
    if (val >= 8) {
      setConferenceEnabled(true);
    } else {
      setConferenceEnabled(false);
    }
  }

  async function handleCreate() {
    if (!teamName.trim()) {
      setError("Please enter your team name.");
      return;
    }

    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const rosterConfig = { QB: 2, RB: 3, WR: 4, TE: 2, K: 2, DST: 2 };
    const inviteCode = generateInviteCode();

    const { data, error } = await supabase
      .from("leagues")
      .insert({
        name,
        commissioner_user_id: user.id,
        invite_code: inviteCode,
        num_teams: numTeams,
        roster_config: rosterConfig,
        scoring_format: scoringFormat,
        draft_type: draftType,
        conference_enabled: conferenceEnabled,
        conference_a_name: conferenceAName.trim() || "AFC",
        conference_b_name: conferenceBName.trim() || "NFC",
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await supabase.from("league_members").insert({
      league_id: data.id,
      user_id: user.id,
      team_name: teamName.trim(),
      draft_position: 1,
    });

    router.push(`/league/${data.id}`);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-gray-400 hover:text-white mb-6 block"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold mb-8">Create League</h1>
        <div className="flex flex-col gap-6">

          <div>
            <label className="block text-gray-400 mb-2">League Name</label>
            <input
              type="text"
              placeholder="e.g. The Championship League"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 text-white p-3 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Your Team Name</label>
            <input
              type="text"
              placeholder="e.g. The Goats"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full bg-gray-800 text-white p-3 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Number of Teams</label>
            <select
              value={numTeams}
              onChange={(e) => handleNumTeamsChange(Number(e.target.value))}
              className="w-full bg-gray-800 text-white p-3 rounded-lg"
            >
              <option value={2}>2 Teams (testing only)</option>
              <option value={3}>3 Teams (testing only)</option>
              <option value={4}>4 Teams</option>
              <option value={5}>5 Teams</option>
              <option value={6}>6 Teams</option>
              <option value={7}>7 Teams</option>
              <option value={8}>8 Teams</option>
              <option value={10}>10 Teams</option>
              <option value={12}>12 Teams</option>
              <option value={14}>14 Teams</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Scoring Format</label>
            <select
              value={scoringFormat}
              onChange={(e) => setScoringFormat(e.target.value)}
              className="w-full bg-gray-800 text-white p-3 rounded-lg"
            >
              <option value="PPR">PPR (1 point per reception)</option>
              <option value="HALF_PPR">Half PPR (0.5 per reception)</option>
              <option value="STANDARD">Standard (no reception points)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Draft Type</label>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value)}
              className="w-full bg-gray-800 text-white p-3 rounded-lg"
            >
              <option value="LIVE">Live Draft</option>
              <option value="MANUAL">Manual Upload</option>
            </select>
          </div>

          {/* Conference Format — auto-enabled for 8+ teams */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-bold text-white">Conference Format</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {numTeams >= 8
                    ? "Recommended for larger leagues — splits teams into two conferences."
                    : "Available for leagues with 8+ teams."}
                </p>
              </div>
              <button
                onClick={() => numTeams >= 8 && setConferenceEnabled(!conferenceEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  conferenceEnabled ? "bg-green-600" : "bg-gray-700"
                } ${numTeams < 8 ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  conferenceEnabled ? "left-7" : "left-1"
                }`} />
              </button>
            </div>

            {conferenceEnabled && (
              <div className="mt-4 flex gap-3">
                <div className="flex-1">
                  <label className="block text-gray-400 text-xs mb-1">Conference A Name</label>
                  <input
                    type="text"
                    value={conferenceAName}
                    onChange={(e) => setConferenceAName(e.target.value)}
                    maxLength={20}
                    className="w-full bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none focus:border-green-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-gray-400 text-xs mb-1">Conference B Name</label>
                  <input
                    type="text"
                    value={conferenceBName}
                    onChange={(e) => setConferenceBName(e.target.value)}
                    maxLength={20}
                    className="w-full bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-400">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading || !name || !teamName}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-3 rounded-lg"
          >
            {loading ? "Creating..." : "Create League"}
          </button>
        </div>
      </div>
    </main>
  );
}