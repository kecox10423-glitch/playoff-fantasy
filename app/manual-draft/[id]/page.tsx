"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ManualDraft() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [picks, setPicks] = useState<{ [key: number]: number }>({});
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id;

  const ROUNDS = 15;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: leagueData } = await supabase
        .from("leagues").select("*").eq("id", leagueId).single();

      const { data: membersData } = await supabase
        .from("league_members").select("*").eq("league_id", leagueId)
        .order("draft_position");

      const { data: playersData } = await supabase
        .from("players").select("*, nfl_teams(abbreviation)")
        .eq("season", 2026).eq("is_active", true);

      setLeague(leagueData);
      setMembers(membersData || []);
      setPlayers(playersData || []);
      setLoading(false);
    }
    load();
  }, []);

  function getPickOwner(pickNumber: number) {
    if (!members.length) return null;
    const numTeams = members.length;
    const round = Math.ceil(pickNumber / numTeams);
    const posInRound = ((pickNumber - 1) % numTeams);
    const index = round % 2 === 0 ? numTeams - 1 - posInRound : posInRound;
    return members[index];
  }

  function getUsedPlayerIds() {
    return Object.values(picks);
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");

    const totalPicks = members.length * ROUNDS;
    for (let i = 1; i <= totalPicks; i++) {
      if (!picks[i]) {
        setError(`Pick #${i} is missing. Please fill in all picks.`);
        setSaving(false);
        return;
      }
    }

    const picksToInsert = [];
    const numTeams = members.length;

    for (let pickNumber = 1; pickNumber <= totalPicks; pickNumber++) {
      const round = Math.ceil(pickNumber / numTeams);
      const pickInRound = ((pickNumber - 1) % numTeams) + 1;
      const owner = getPickOwner(pickNumber);

      picksToInsert.push({
        league_id: leagueId,
        user_id: owner?.user_id,
        player_id: picks[pickNumber],
        pick_number: pickNumber,
        round,
        pick_in_round: pickInRound,
        is_auto_pick: false,
      });
    }

    const { error } = await supabase.from("draft_picks").insert(picksToInsert);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    await supabase.from("leagues").update({ draft_status: "COMPLETED" }).eq("id", leagueId);
    router.push(`/league/${leagueId}`);
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading...</p>
    </main>
  );

  const totalPicks = members.length * ROUNDS;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push(`/league/${leagueId}`)} className="text-gray-400 hover:text-white mb-6 block">
          ← Back to League
        </button>

        <h1 className="text-3xl font-bold mb-2">Manual Draft Upload</h1>
        <p className="text-gray-400 mb-8">Enter your draft results in order.</p>

        <div className="flex flex-col gap-3 mb-8">
          {Array.from({ length: totalPicks }, (_, i) => i + 1).map(pickNumber => {
            const owner = getPickOwner(pickNumber);
            const round = Math.ceil(pickNumber / members.length);
            const usedIds = getUsedPlayerIds().filter((_, idx) => Object.keys(picks)[idx] != String(pickNumber));

            return (
              <div key={pickNumber} className="flex items-center gap-4 bg-gray-800 p-3 rounded-lg">
                <div className="w-24 text-sm text-gray-400">
                  <p>Rd {round}</p>
                  <p className="text-xs">Pick #{pickNumber}</p>
                </div>
                <div className="w-32 text-sm font-bold truncate">
                  {owner?.team_name}
                </div>
                <select
                  value={picks[pickNumber] || ""}
                  onChange={(e) => setPicks(prev => ({ ...prev, [pickNumber]: Number(e.target.value) }))}
                  className="flex-1 bg-gray-700 text-white p-2 rounded"
                >
                  <option value="">Select player...</option>
                  {players
                    .filter(p => !usedIds.includes(p.id) || picks[pickNumber] === p.id)
                    .map(player => (
                      <option key={player.id} value={player.id}>
                        {player.name} ({player.position} - {player.nfl_teams?.abbreviation})
                      </option>
                    ))}
                </select>
              </div>
            );
          })}
        </div>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-4 rounded-lg text-lg"
        >
          {saving ? "Saving..." : "Submit Draft Results"}
        </button>
      </div>
    </main>
  );
}