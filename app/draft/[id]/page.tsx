"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ROSTER_SLOTS = { QB: 2, RB: 3, WR: 4, TE: 2, K: 2, DST: 2 };
const TOTAL_PICKS_PER_TEAM = 15;
const TIMER_SECONDS = 90;

export default function DraftPage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [queue, setQueue] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<"players" | "board" | "roster">("players");
  const timerRef = useRef<any>(null);
  const picksRef = useRef<any[]>([]);
  const membersRef = useRef<any[]>([]);
  const userRef = useRef<any>(null);
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id;

  useEffect(() => {
    picksRef.current = picks;
  }, [picks]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      userRef.current = user;

      const { data: leagueData } = await supabase
        .from("leagues").select("*").eq("id", leagueId).single();

      const { data: membersData } = await supabase
        .from("league_members").select("*").eq("league_id", leagueId)
        .order("draft_position");

      const { data: playersData } = await supabase
        .from("players").select("*, nfl_teams(name, abbreviation, seed)")
        .eq("season", 2026).order("position");

      const { data: picksData } = await supabase
        .from("draft_picks").select("*").eq("league_id", leagueId)
        .order("pick_number");

      setLeague(leagueData);
      setMembers(membersData || []);
      membersRef.current = membersData || [];
      setPlayers(playersData || []);
      setPicks(picksData || []);
      picksRef.current = picksData || [];
      setLoading(false);
    }
    load();

    // Real-time picks — only update for OTHER users' picks
    const picksSub = supabase
      .channel(`draft-picks-${leagueId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "draft_picks",
        filter: `league_id=eq.${leagueId}`
      }, (payload) => {
        const currentUser = userRef.current;
        // Only apply real-time update if it's not from the current user
        // (current user already has optimistic update)
        if (payload.new.user_id !== currentUser?.id) {
          setPicks(prev => {
            // Avoid duplicates
            if (prev.some(p => p.pick_number === payload.new.pick_number)) return prev;
            return [...prev, payload.new];
          });
          setTimeLeft(TIMER_SECONDS);
        }
      })
      .subscribe();

    // Real-time chat
    const chatSub = supabase
      .channel(`chat-${leagueId}`)
      .on("broadcast", { event: "chat" }, (payload) => {
        setChatMessages(prev => [...prev, payload.payload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(picksSub);
      supabase.removeChannel(chatSub);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (loading) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAutoPick();
          return TIMER_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [picks, loading, members]);

  function getCurrentPickNumber() {
    return picks.length + 1;
  }

  function getPickOwner(pickNumber: number) {
    const currentMembers = membersRef.current;
    if (!currentMembers.length) return null;
    const numTeams = currentMembers.length;
    const round = Math.ceil(pickNumber / numTeams);
    const posInRound = ((pickNumber - 1) % numTeams);
    const index = round % 2 === 0 ? numTeams - 1 - posInRound : posInRound;
    return currentMembers[index];
  }

  function isMyTurn() {
    const owner = getPickOwner(getCurrentPickNumber());
    return owner?.user_id === user?.id;
  }

  function isPickedAlready(playerId: number) {
    return picks.some(p => p.player_id === playerId);
  }

  function getMyRoster() {
    return picks
      .filter(p => p.user_id === user?.id)
      .map(p => players.find(pl => pl.id === p.player_id))
      .filter(Boolean);
  }

  function getRosterByPosition(position: string) {
    return getMyRoster().filter((p: any) => p.position === position);
  }

  function getRosterSlotsFilled(position: string) {
    return getRosterByPosition(position).length;
  }

  function toggleQueue(playerId: number) {
    setQueue(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  }

  async function makePick(playerId: number) {
    if (!isMyTurn()) return;
    const pickNumber = getCurrentPickNumber();
    const numTeams = members.length;
    const round = Math.ceil(pickNumber / numTeams);
    const pickInRound = ((pickNumber - 1) % numTeams) + 1;

    const optimisticPick = {
      id: `optimistic-${Date.now()}`,
      league_id: leagueId,
      user_id: user.id,
      player_id: playerId,
      pick_number: pickNumber,
      round,
      pick_in_round: pickInRound,
      is_auto_pick: false,
    };

    // Optimistic update — show immediately
    setPicks(prev => [...prev, optimisticPick]);
    setTimeLeft(TIMER_SECONDS);

    // Remove from queue if it was queued
    setQueue(prev => prev.filter(id => id !== playerId));

    // Save to database
    await supabase.from("draft_picks").insert({
      league_id: leagueId,
      user_id: user.id,
      player_id: playerId,
      pick_number: pickNumber,
      round,
      pick_in_round: pickInRound,
    });
  }

  async function handleAutoPick() {
    const currentPicks = picksRef.current;
    const currentMembers = membersRef.current;
    const currentUser = userRef.current;

    const pickNumber = currentPicks.length + 1;
    const owner = getPickOwner(pickNumber);
    if (!owner) return;

    // Only the owner should trigger auto-pick to avoid duplicates
    if (owner.user_id !== currentUser?.id) return;

    const pickedIds = currentPicks.map((p: any) => p.player_id);
    const available = players.find(p => !pickedIds.includes(p.id));
    if (!available) return;

    const numTeams = currentMembers.length;
    const round = Math.ceil(pickNumber / numTeams);
    const pickInRound = ((pickNumber - 1) % numTeams) + 1;

    const optimisticPick = {
      id: `optimistic-auto-${Date.now()}`,
      league_id: leagueId,
      user_id: owner.user_id,
      player_id: available.id,
      pick_number: pickNumber,
      round,
      pick_in_round: pickInRound,
      is_auto_pick: true,
    };

    setPicks(prev => [...prev, optimisticPick]);
    setTimeLeft(TIMER_SECONDS);

    await supabase.from("draft_picks").insert({
      league_id: leagueId,
      user_id: owner.user_id,
      player_id: available.id,
      pick_number: pickNumber,
      round,
      pick_in_round: pickInRound,
      is_auto_pick: true,
    });
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    const myMember = members.find(m => m.user_id === user?.id);
    const message = {
      text: chatInput.trim(),
      team: myMember?.team_name || "Unknown",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    await supabase.channel(`chat-${leagueId}`).send({
      type: "broadcast",
      event: "chat",
      payload: message
    });

    setChatMessages(prev => [...prev, message]);
    setChatInput("");
  }

  const totalPicks = members.length * TOTAL_PICKS_PER_TEAM;
  const draftComplete = picks.length >= totalPicks;
  const currentPickOwner = getPickOwner(getCurrentPickNumber());

  const queuedPlayers = queue
    .map(id => players.find(p => p.id === id))
    .filter(Boolean)
    .filter((p: any) => !isPickedAlready(p.id));

  const filteredPlayers = players.filter(p => {
    if (positionFilter !== "ALL" && p.position !== positionFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function getPositionColor(position: string) {
    switch (position) {
      case "QB": return "bg-red-900 text-red-300";
      case "RB": return "bg-blue-900 text-blue-300";
      case "WR": return "bg-yellow-900 text-yellow-300";
      case "TE": return "bg-purple-900 text-purple-300";
      default: return "bg-gray-700 text-gray-300";
    }
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading draft...</p>
    </main>
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Top Header Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button onClick={() => router.push(`/league/${leagueId}`)} className="text-gray-400 hover:text-white text-sm">← Leave</button>
          <div className="text-center">
            <p className="text-xs text-gray-400">{league?.name}</p>
            {!draftComplete && (
              <p className="text-xs text-gray-500">Pick #{getCurrentPickNumber()} of {totalPicks}</p>
            )}
          </div>
          <div className={`text-2xl font-mono font-bold ${timeLeft <= 10 ? "text-red-400" : "text-green-400"}`}>
            {draftComplete ? "✅" : `${timeLeft}s`}
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`px-4 py-3 text-center ${isMyTurn() && !draftComplete ? "bg-green-700" : "bg-gray-800"}`}>
        {draftComplete ? (
          <p className="font-bold">Draft Complete! Check your roster.</p>
        ) : isMyTurn() ? (
          <p className="font-bold text-lg">⚡ You're on the clock!</p>
        ) : (
          <p className="text-gray-300">
            Waiting on <span className="text-white font-bold">{currentPickOwner?.team_name}</span>
          </p>
        )}
      </div>

      {/* Team Strip */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {members.map((member, i) => {
            const memberPicks = picks.filter(p => p.user_id === member.user_id);
            const isOnClock = currentPickOwner?.user_id === member.user_id && !draftComplete;
            const isMe = member.user_id === user?.id;
            return (
              <div key={member.id} className={`flex flex-col items-center min-w-16 ${isOnClock ? "opacity-100" : "opacity-60"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-1 ${
                  isMe ? "bg-green-600" : "bg-gray-700"
                } ${isOnClock ? "ring-2 ring-yellow-400" : ""}`}>
                  {member.team_name.charAt(0).toUpperCase()}
                </div>
                <p className="text-xs text-gray-400 truncate max-w-16 text-center">{member.team_name}</p>
                <p className="text-xs text-gray-600">{memberPicks.length} picks</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-900 border-b border-gray-800 px-4">
        <div className="flex">
          {[
            { id: "players", label: "Players" },
            { id: "board", label: "Board" },
            { id: "roster", label: `My Roster (${getMyRoster().length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-bold border-b-2 ${
                activeTab === tab.id
                  ? "border-green-500 text-green-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">

        {/* Players Tab */}
        {activeTab === "players" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

            {/* Player List */}
            <div className="lg:col-span-3">
              {/* Queue */}
              {queuedPlayers.length > 0 && (
                <div className="bg-blue-900 rounded-lg p-3 mb-4">
                  <h3 className="text-sm font-bold text-blue-300 mb-2">Your Queue ({queuedPlayers.length})</h3>
                  <div className="flex flex-col gap-1">
                    {queuedPlayers.map((player: any) => (
                      <div key={player.id} className="flex justify-between items-center bg-blue-800 p-2 rounded">
                        <div>
                          <span className="font-bold text-sm">{player.name}</span>
                          <span className="text-blue-300 text-xs ml-2">{player.nfl_teams?.abbreviation} · {player.position}</span>
                        </div>
                        <div className="flex gap-2">
                          {isMyTurn() && (
                            <button
                              onClick={() => makePick(player.id)}
                              className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1 rounded"
                            >
                              Draft
                            </button>
                          )}
                          <button
                            onClick={() => toggleQueue(player.id)}
                            className="text-blue-300 hover:text-white text-xs px-2 py-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="flex gap-2 mb-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Search players..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-gray-800 text-white p-2 rounded text-sm flex-1 min-w-32"
                />
                {["ALL", "QB", "RB", "WR", "TE", "K", "DST"].map(pos => (
                  <button
                    key={pos}
                    onClick={() => setPositionFilter(pos)}
                    className={`px-3 py-2 rounded text-xs font-bold ${positionFilter === pos ? "bg-green-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              {/* Player Table Header */}
              <div className="grid grid-cols-12 text-xs text-gray-500 px-2 mb-1">
                <span className="col-span-1">RK</span>
                <span className="col-span-5">PLAYER</span>
                <span className="col-span-1">SEED</span>
                <span className="col-span-2">POS</span>
                <span className="col-span-3 text-right">ACTION</span>
              </div>

              {/* Player Rows */}
              <div className="flex flex-col gap-1">
                {filteredPlayers.map((player, index) => {
                  const picked = isPickedAlready(player.id);
                  const inQueue = queue.includes(player.id);
                  return (
                    <div
                      key={player.id}
                      className={`grid grid-cols-12 items-center p-2 rounded text-sm ${
                        picked ? "opacity-25 bg-gray-900" : "bg-gray-800 hover:bg-gray-750"
                      }`}
                    >
                      <span className="col-span-1 text-gray-500 text-xs">{index + 1}</span>
                      <div className="col-span-5">
                        <p className={`font-bold ${picked ? "line-through text-gray-500" : "text-white"}`}>
                          {player.name}
                        </p>
                        <p className="text-xs text-gray-400">{player.nfl_teams?.abbreviation}</p>
                      </div>
                      <span className="col-span-1 text-xs text-gray-400">{player.nfl_teams?.seed}</span>
                      <span className={`col-span-2 text-xs font-bold px-2 py-1 rounded w-fit ${getPositionColor(player.position)}`}>
                        {player.position}
                      </span>
                      <div className="col-span-3 flex gap-1 justify-end">
                        {!picked && (
                          <>
                            <button
                              onClick={() => toggleQueue(player.id)}
                              className={`text-xs px-2 py-1 rounded ${inQueue ? "bg-blue-700 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                            >
                              {inQueue ? "★" : "☆"}
                            </button>
                            {isMyTurn() && (
                              <button
                                onClick={() => makePick(player.id)}
                                className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1 rounded"
                              >
                                Draft
                              </button>
                            )}
                          </>
                        )}
                        {picked && <span className="text-xs text-gray-600">Drafted</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chat Panel */}
            <div className="lg:col-span-1">
              <div className="bg-gray-900 rounded-lg p-4 flex flex-col h-full">
                <h2 className="font-bold mb-3 text-sm">Smack Talk 💬</h2>
                <div className="overflow-y-auto flex-1 max-h-96 flex flex-col gap-2 mb-3">
                  {chatMessages.length === 0 ? (
                    <p className="text-gray-600 text-xs">No messages yet...</p>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className="text-xs">
                        <span className="text-green-400 font-bold">{msg.team}</span>
                        <span className="text-gray-500 ml-1">{msg.time}</span>
                        <p className="text-white mt-1">{msg.text}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Talk trash..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    className="w-full bg-gray-800 text-white p-2 rounded text-xs"
                  />
                  <button
                    onClick={sendChat}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold px-3 py-2 rounded text-xs"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Board Tab */}
        {activeTab === "board" && (
          <div className="overflow-x-auto">
            <div className="flex flex-col gap-1 min-w-max">
              {/* Header */}
              <div className="flex gap-1 mb-2">
                <div className="w-16 text-xs text-gray-500">Round</div>
                {members.map(member => (
                  <div key={member.id} className="w-32 text-xs text-gray-400 text-center truncate">
                    {member.team_name}
                  </div>
                ))}
              </div>
              {/* Rows per round */}
              {Array.from({ length: TOTAL_PICKS_PER_TEAM }, (_, roundIdx) => {
                const round = roundIdx + 1;
                const isEvenRound = round % 2 === 0;
                const roundMembers = isEvenRound ? [...members].reverse() : members;
                return (
                  <div key={round} className="flex gap-1 items-start">
                    <div className="w-16 text-xs text-gray-500 pt-2">Rd {round}</div>
                    {roundMembers.map((member, idx) => {
                      const pickNum = (round - 1) * members.length + idx + 1;
                      const pick = picks.find(p => p.pick_number === pickNum);
                      const player = pick ? players.find(pl => pl.id === pick.player_id) : null;
                      const isCurrent = pickNum === getCurrentPickNumber() && !draftComplete;
                      const isMe = member.user_id === user?.id;
                      return (
                        <div
                          key={member.id}
                          className={`w-32 p-2 rounded text-xs min-h-12 ${
                            isCurrent ? "bg-green-900 border border-green-500" :
                            player ? (isMe ? "bg-green-950 border border-green-800" : "bg-gray-800") :
                            "bg-gray-900 border border-dashed border-gray-800"
                          }`}
                        >
                          {player ? (
                            <>
                              <p className="font-bold text-white truncate">{player.name}</p>
                              <p className="text-gray-400">{player.position} · {player.nfl_teams?.abbreviation}</p>
                            </>
                          ) : isCurrent ? (
                            <p className="text-green-400 animate-pulse">On clock...</p>
                          ) : (
                            <p className="text-gray-700">—</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Roster Tab */}
        {activeTab === "roster" && (
          <div className="max-w-lg">
            <h2 className="font-bold mb-4 text-lg">My Roster</h2>
            {Object.entries(ROSTER_SLOTS).map(([pos, slots]) => (
              <div key={pos} className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span className={`font-bold px-2 py-1 rounded ${getPositionColor(pos)}`}>{pos}</span>
                  <span>{getRosterSlotsFilled(pos)}/{slots} filled</span>
                </div>
                {Array.from({ length: slots }, (_, i) => {
                  const player = getRosterByPosition(pos)[i];
                  return (
                    <div key={i} className={`p-3 rounded mb-1 ${player ? "bg-gray-800" : "bg-gray-900 border border-dashed border-gray-700"}`}>
                      {player ? (
                        <div className="flex justify-between items-center">
                          <span className="font-bold">{player.name}</span>
                          <span className="text-gray-400 text-xs">{player.nfl_teams?.abbreviation} · Seed {player.nfl_teams?.seed}</span>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">Empty slot</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}