"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DraftPage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [positionFilter, setPositionFilter] = useState("ALL");
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

      const { data: playersData } = await supabase
        .from("players").select("*, nfl_teams(name, abbreviation, seed)").eq("season", 2026);

      const { data: picksData } = await supabase
        .from("draft_picks").select("*").eq("league_id", leagueId);

      setLeague(leagueData);
      setMembers(membersData || []);
      setPlayers(playersData || []);
      setPicks(picksData || []);
      setLoading(false);
    }
    load();

    // Real-time subscription
    const subscription = supabase
      .channel(`draft-${leagueId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "draft_picks",
        filter: `league_id=eq.${leagueId}`
      }, (payload) => {
        setPicks(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  function getCurrentPick() {
    return picks.length + 1;
  }

  function getPickOwner(pickNumber: number) {
    if (!members.length) return null;
    const numTeams = members.length;
    const round = Math.ceil(pickNumber / numTeams);
    const posInRound = ((pickNumber - 1) % numTeams);
    const index = round % 2 === 0 ? numTeams - 1 - posInRound : posInRound;
    return members[index];
  }

  function isMyTurn() {
    const owner = getPickOwner(getCurrentPick());
    return owner?.user_id === user?.id;
  }

  function getMyRoster() {
    return picks.filter(p => p.user_id === user?.id);
  }

  function isPickedAlready(playerId: number) {
    return picks.some(p => p.player_id === playerId);
  }

  async function makePick(playerId: number) {
    if (!isMyTurn()) return;
    const pickNumber = getCurrentPick();
    const numTeams = members.length;
    const round = Math.ceil(pickNumber / numTeams);
    const pickInRound = ((pickNumber - 1) % numTeams) + 1;

    await supabase.from("draft_picks").insert({
      league_id: leagueId,
      user_id: user.id,
      player_id: playerId,
      pick_number: pickNumber,
      round,
      pick_in_round: pickInRound,
    });
  }

  const filteredPlayers = players.filter(p => {
    if (isPickedAlready(p.id)) return false;
    if (positionFilter === "ALL") return true;
    return p.position === positionFilter;
  });

  const currentPickOwner = getPickOwner(getCurrentPick());
  const draftComplete = picks.length >= members.length * 15;

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading draft...</p>
    </main>
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{league?.name} — Draft</h1>
          <span className="text-gray-400">Pick #{getCurrentPick()}</span>
        </div>

        {/* Current pick banner */}
        <div className={`rounded-lg p-4 mb-4 text-center ${isMyTurn() ? "bg-green-800" : "bg-gray-800"}`}>
          {draftComplete ? (
            <p className="font-bold text-lg">Draft Complete!</p>
          ) : isMyTurn() ? (
            <p className="font-bold text-lg">⚡ It's your pick!</p>
          ) : (
            <p className="text-gray-300">Waiting for <span className="text-white font-bold">{currentPickOwner?.team_name}</span> to pick...</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Available Players */}
          <div className="lg:col-span-2 bg-gray-900 rounded-lg p-4">
            <h2 className="font-bold mb-3">Available Players</h2>
            <div className="flex gap-2 mb-4 flex-wrap">
              {["ALL", "QB", "RB", "WR", "TE", "K", "DST"].map(pos => (
                <button
                  key={pos}
                  onClick={() => setPositionFilter(pos)}
                  className={`px-3 py-1 rounded text-sm font-bold ${positionFilter === pos ? "bg-green-600" : "bg-gray-700 hover:bg-gray-600"}`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto max-h-96">
              {filteredPlayers.map(player => (
                <div
                  key={player.id}
                  className={`flex justify-between items-center p-3 mb-1 rounded ${isMyTurn() ? "hover:bg-gray-700 cursor-pointer" : "opacity-60"} bg-gray-800`}
                  onClick={() => makePick(player.id)}
                >
                  <div>
                    <span className="font-bold">{player.name}</span>
                    <span className="text-gray-400 text-sm ml-2">{player.nfl_teams?.abbreviation}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    player.position === "QB" ? "bg-red-900 text-red-300" :
                    player.position === "RB" ? "bg-blue-900 text-blue-300" :
                    player.position === "WR" ? "bg-yellow-900 text-yellow-300" :
                    "bg-gray-700 text-gray-300"
                  }`}>
                    {player.position}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* My Roster */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="font-bold mb-3">My Roster ({getMyRoster().length})</h2>
            {getMyRoster().length === 0 ? (
              <p className="text-gray-500 text-sm">No picks yet</p>
            ) : (
              getMyRoster().map(pick => {
                const player = players.find(p => p.id === pick.player_id);
                return (
                  <div key={pick.id} className="flex justify-between items-center p-2 mb-1 bg-gray-800 rounded">
                    <span className="text-sm">{player?.name}</span>
                    <span className="text-xs text-gray-400">{player?.position}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Draft Board */}
        <div className="mt-4 bg-gray-900 rounded-lg p-4">
          <h2 className="font-bold mb-3">Draft Board</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {members.map(member => (
                <div key={member.id} className="w-32">
                  <p className="text-xs text-gray-400 mb-2 truncate">{member.team_name}</p>
                  {picks
                    .filter(p => p.user_id === member.user_id)
                    .map(pick => {
                      const player = players.find(p => p.id === pick.player_id);
                      return (
                        <div key={pick.id} className="bg-gray-800 rounded p-1 mb-1">
                          <p className="text-xs truncate">{player?.name}</p>
                          <p className="text-xs text-gray-500">{player?.position}</p>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}