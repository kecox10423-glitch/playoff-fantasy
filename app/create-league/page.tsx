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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
              onChange={(e) => setNumTeams(Number(e.target.value))}
              className="w-full bg-gray-800 text-white p-3 rounded-lg"
            >
              <option value={6}>6 Teams</option>
              <option value={8}>8 Teams</option>
              <option value={10}>10 Teams</option>
              <option value={12}>12 Teams</option>
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