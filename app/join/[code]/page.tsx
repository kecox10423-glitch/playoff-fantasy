"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function JoinLeague() {
  const [league, setLeague] = useState<any>(null);
  const [teamName, setTeamName] = useState("");
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const router = useRouter();
  const params = useParams();
  const code = params.code;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: leagueData } = await supabase
        .from("leagues")
        .select("*")
        .eq("invite_code", code)
        .single();

      setLeague(leagueData);
      setLoading(false);
    }
    load();
  }, []);

  async function handleJoin() {
    if (!teamName.trim()) {
      setError("Please enter a team name.");
      return;
    }

    setJoining(true);
    setError("");

    const { data: members } = await supabase
      .from("league_members")
      .select("*")
      .eq("league_id", league.id);

    if (!members) return;

    if (members.length >= league.num_teams) {
      setError("This league is full.");
      setJoining(false);
      return;
    }

    const alreadyJoined = members.find((m: any) => m.user_id === user.id);
    if (alreadyJoined) {
      router.push(`/league/${league.id}`);
      return;
    }

    const { error: insertError } = await supabase.from("league_members").insert({
      league_id: league.id,
      user_id: user.id,
      team_name: teamName.trim(),
      draft_position: members.length + 1,
    });

    if (insertError) {
      setError(insertError.message);
      setJoining(false);
      return;
    }

    // If league is now full, randomize draft order
    const newCount = members.length + 1;
    if (newCount >= league.num_teams) {
      await fetch("/api/randomize-draft-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: league.id }),
      });
    }

    router.push(`/league/${league.id}`);
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading...</p>
    </main>
  );

  if (!league) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-red-400">Invalid invite code.</p>
    </main>
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2">Join League</h1>
        <p className="text-gray-400 mb-8">You've been invited to join:</p>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-1">{league.name}</h2>
          <p className="text-gray-400">
            {league.scoring_format} · {league.draft_type} Draft · {league.num_teams} Teams
          </p>
        </div>

        <div className="flex flex-col gap-4">
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
          {error && <p className="text-red-400">{error}</p>}
          <button
            onClick={handleJoin}
            disabled={joining || !teamName.trim()}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-3 rounded-lg"
          >
            {joining ? "Joining..." : "Join League"}
          </button>
        </div>
      </div>
    </main>
  );
}