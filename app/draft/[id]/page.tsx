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
const TIMER_SECONDS = 60;

function parseUTCTimestamp(raw: string): Date {
  if (raw.endsWith("Z") || raw.includes("+")) return new Date(raw);
  return new Date(raw.replace(" ", "T") + "Z");
}

function createBeep(frequency: number, duration: number, volume: number = 0.3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playOnClockAlert() {
  setTimeout(() => createBeep(440, 0.2, 0.7), 0);
  setTimeout(() => createBeep(550, 0.2, 0.7), 200);
  setTimeout(() => createBeep(660, 0.4, 0.8), 400);
}
function playUrgentBeep() { createBeep(880, 0.25, 0.7); }
function playTickBeep() { createBeep(660, 0.1, 0.4); }
function playPickMadeSound() {
  setTimeout(() => createBeep(523, 0.15, 0.6), 0);
  setTimeout(() => createBeep(659, 0.15, 0.6), 120);
  setTimeout(() => createBeep(784, 0.15, 0.6), 240);
  setTimeout(() => createBeep(1047, 0.3, 0.7), 360);
}
function playDraftOpeningAlert() {
  setTimeout(() => createBeep(523, 0.2, 0.7), 0);
  setTimeout(() => createBeep(659, 0.2, 0.7), 200);
  setTimeout(() => createBeep(784, 0.2, 0.7), 400);
  setTimeout(() => createBeep(1047, 0.4, 0.8), 600);
}

function PFFLLogo({ size = 28 }: { size?: number }) {
  return <img src="/apple-touch-icon.png" alt="PFFL Logo" width={size} height={size} style={{ borderRadius: "20%" }} />;
}

function PlayerAvatar({ name, position }: { name: string; position: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  const colors: { [key: string]: string } = {
    QB: "bg-red-800 text-red-200", RB: "bg-blue-800 text-blue-200",
    WR: "bg-yellow-800 text-yellow-200", TE: "bg-purple-800 text-purple-200",
    K: "bg-gray-700 text-gray-300", DST: "bg-orange-800 text-orange-200",
  };
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${colors[position] || "bg-gray-700 text-gray-300"}`}>
      {initials}
    </div>
  );
}

function getPositionBadge(position: string) {
  switch (position) {
    case "QB": return "bg-red-900 text-red-300";
    case "RB": return "bg-blue-900 text-blue-300";
    case "WR": return "bg-yellow-900 text-yellow-300";
    case "TE": return "bg-purple-900 text-purple-300";
    case "K": return "bg-gray-700 text-gray-300";
    case "DST": return "bg-orange-900 text-orange-300";
    default: return "bg-gray-700 text-gray-300";
  }
}

type StatCol = { key: string; label: string; field: string };

const STAT_COLS: { [pos: string]: StatCol[] } = {
  QB: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "pass_yards", label: "PY", field: "pass_yards" },
    { key: "pass_tds", label: "PTD", field: "pass_tds" },
    { key: "interceptions", label: "INT", field: "interceptions" },
    { key: "rush_yards", label: "RY", field: "rush_yards" },
    { key: "rush_tds", label: "RTD", field: "rush_tds" },
  ],
  RB: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "rush_yards", label: "RY", field: "rush_yards" },
    { key: "rush_tds", label: "RTD", field: "rush_tds" },
    { key: "receptions", label: "REC", field: "receptions" },
    { key: "rec_yards", label: "REY", field: "rec_yards" },
    { key: "rec_tds", label: "RETD", field: "rec_tds" },
  ],
  WR: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "receptions", label: "REC", field: "receptions" },
    { key: "rec_yards", label: "REY", field: "rec_yards" },
    { key: "rec_tds", label: "RETD", field: "rec_tds" },
    { key: "rush_yards", label: "RY", field: "rush_yards" },
  ],
  TE: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "receptions", label: "REC", field: "receptions" },
    { key: "rec_yards", label: "REY", field: "rec_yards" },
    { key: "rec_tds", label: "RETD", field: "rec_tds" },
  ],
  K: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "fg_made", label: "FG", field: "fg_made" },
    { key: "fg_attempts", label: "FGA", field: "fg_attempts" },
    { key: "fg_50_plus", label: "FG50+", field: "fg_50_plus" },
    { key: "xp_made", label: "XP", field: "xp_made" },
  ],
  DST: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "dst_sacks", label: "SK", field: "dst_sacks" },
    { key: "dst_ints", label: "INT", field: "dst_ints" },
    { key: "dst_fumbles_rec", label: "FR", field: "dst_fumbles_rec" },
    { key: "dst_tds", label: "TD", field: "dst_tds" },
  ],
  ALL: [{ key: "proj", label: "FPTS", field: "fantasy_points" }],
};

type SortKey = string;
type SortDir = "asc" | "desc";
type MobileTab = "roster" | "players" | "board";

export default function DraftPage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [showAvailableOnly, setShowAvailableOnly] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("fantasy_points");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [countdown, setCountdown] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [countdownWarning, setCountdownWarning] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [queue, setQueue] = useState<number[]>([]);
  const [allQueues, setAllQueues] = useState<{ [userId: string]: number[] }>({});
  const [rightPanel, setRightPanel] = useState<"board" | "chat">("board");
  const [mobileTab, setMobileTab] = useState<MobileTab>("players");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [startingDraft, setStartingDraft] = useState(false);
  const [autoPickEnabled, setAutoPickEnabled] = useState(false);
  const [rosterEmailSent, setRosterEmailSent] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [draftedFlash, setDraftedFlash] = useState<{ name: string; position: string } | null>(null);

  const timerRef = useRef<any>(null);
  const countdownRef = useRef<any>(null);
  const picksRef = useRef<any[]>([]);
  const membersRef = useRef<any[]>([]);
  const leagueRef = useRef<any>(null);
  const userRef = useRef<any>(null);
  const playersRef = useRef<any[]>([]);
  const onlineUserIdsRef = useRef<string[]>([]);
  const allQueuesRef = useRef<{ [userId: string]: number[] }>({});
  const chatEndRef = useRef<any>(null);
  const wasMyTurnRef = useRef(false);
  const autoPickEnabledRef = useRef(false);
  const pickStartTimeRef = useRef<string | null>(null);
  const autoPickFiredRef = useRef(false);
  const lastOfflineAutoPickRef = useRef<number>(-1);

  const router = useRouter();
  const params = useParams();
  const leagueId = params.id as string;

  useEffect(() => { picksRef.current = picks; }, [picks]);
  useEffect(() => { membersRef.current = members; }, [members]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { leagueRef.current = league; }, [league]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { autoPickEnabledRef.current = autoPickEnabled; }, [autoPickEnabled]);
  useEffect(() => { onlineUserIdsRef.current = onlineUserIds; }, [onlineUserIds]);
  useEffect(() => { allQueuesRef.current = allQueues; }, [allQueues]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  function getTimeLeftFromServer(pickStartTime: string | null): number {
    if (!pickStartTime) return TIMER_SECONDS;
    const start = parseUTCTimestamp(pickStartTime).getTime();
    const elapsed = Math.floor((Date.now() - start) / 1000);
    return Math.max(0, TIMER_SECONDS - elapsed);
  }

  async function savePick(payload: {
    leagueId: string; userId: string; playerId: number;
    pickNumber: number; round: number; pickInRound: number; isAutoPick: boolean;
  }) {
    const res = await fetch("/api/draft/make-pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error("Pick save failed:", await res.json());
    return res.ok;
  }

  async function saveQueueToDB(userId: string, playerIds: number[]) {
    await supabase.from("draft_queue").delete()
      .eq("league_id", leagueId).eq("user_id", userId);
    if (playerIds.length === 0) return;
    await supabase.from("draft_queue").insert(
      playerIds.map((playerId, i) => ({
        league_id: leagueId, user_id: userId,
        player_id: playerId, queue_order: i,
      }))
    );
  }

  function getBestAutoPick(userId: string, pickedIds: number[], userPicks: any[]): any {
    const currentPlayers = playersRef.current;
    const positionCounts: { [pos: string]: number } = {};
    userPicks.forEach((p: any) => {
      const pl = currentPlayers.find((pl: any) => pl.id === p.player_id);
      if (pl) positionCounts[pl.position] = (positionCounts[pl.position] || 0) + 1;
    });

    const available = currentPlayers.filter(p =>
      !pickedIds.includes(p.id) &&
      (positionCounts[p.position] || 0) < (ROSTER_SLOTS[p.position as keyof typeof ROSTER_SLOTS] || 0)
    );

    const userQueue = allQueuesRef.current[userId] || [];
    for (const queuedId of userQueue) {
      const queued = available.find(p => p.id === queuedId);
      if (queued) return queued;
    }

    return available.sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0))[0];
  }

  async function executeAutoPick(userId: string) {
    const currentPicks = picksRef.current;
    const currentMembers = membersRef.current;
    if (!currentMembers.length) return;

    const pickNumber = currentPicks.length + 1;
    if (currentPicks.some(p => p.pick_number === pickNumber)) return;

    const numTeams = currentMembers.length;
    const round = Math.ceil(pickNumber / numTeams);
    const posInRound = (pickNumber - 1) % numTeams;
    const index = round % 2 === 0 ? numTeams - 1 - posInRound : posInRound;
    const owner = currentMembers[index];
    if (!owner || owner.user_id !== userId) return;

    const pickedIds = currentPicks.map((p: any) => p.player_id);
    const userPicks = currentPicks.filter((p: any) => p.user_id === userId);
    const available = getBestAutoPick(userId, pickedIds, userPicks);
    if (!available) return;

    const pickInRound = ((pickNumber - 1) % numTeams) + 1;
    const pickStartTime = new Date().toISOString();

    const newPick = {
      id: `optimistic-auto-${Date.now()}`,
      league_id: leagueId, user_id: userId,
      player_id: available.id, pick_number: pickNumber,
      round, pick_in_round: pickInRound,
      is_auto_pick: true, pick_start_time: pickStartTime,
    };

    setPicks(prev => {
      if (prev.some(p => p.pick_number === pickNumber)) return prev;
      return [...prev, newPick];
    });
    pickStartTimeRef.current = pickStartTime;
    setTimeLeft(TIMER_SECONDS);

    if (userId === userRef.current?.id) {
      setQueue(prev => {
        const updated = prev.filter(id => id !== available.id);
        saveQueueToDB(userId, updated);
        return updated;
      });
    } else {
      setAllQueues(prev => ({
        ...prev,
        [userId]: (prev[userId] || []).filter(id => id !== available.id),
      }));
    }

    await supabase.channel(`picks-broadcast-${leagueId}`).send({
      type: "broadcast", event: "pick", payload: newPick,
    });

    await savePick({
      leagueId, userId, playerId: available.id,
      pickNumber, round, pickInRound, isAutoPick: true,
    });
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      userRef.current = user;

      const { data: leagueData } = await supabase
        .from("leagues").select("*").eq("id", leagueId).single();
      const { data: membersData } = await supabase
        .from("league_members").select("*").eq("league_id", leagueId).order("draft_position");
      const { data: playersData } = await supabase
        .from("players").select("*, nfl_teams(name, abbreviation, seed)").eq("season", 2026);
      const { data: statsData } = await supabase
        .from("player_stats").select("*").eq("season", 2026).eq("week", 0);
      const { data: picksData } = await supabase
        .from("draft_picks").select("*").eq("league_id", leagueId).order("pick_number");
      const { data: chatData } = await supabase
        .from("draft_chat_messages").select("*").eq("league_id", leagueId).order("created_at");
      const { data: queueData } = await supabase
        .from("draft_queue").select("*").eq("league_id", leagueId).order("queue_order");

      const statsMap: { [playerId: number]: any } = {};
      (statsData || []).forEach((s: any) => { statsMap[s.player_id] = s; });

      const playersWithStats = (playersData || []).map((p: any) => {
        const stats = statsMap[p.id] || {};
        return {
          ...p,
          fantasy_points: parseFloat(stats.fantasy_points) || 0,
          pass_completions: stats.pass_completions,
          pass_attempts: stats.pass_attempts,
          pass_yards: stats.pass_yards,
          pass_tds: stats.pass_tds,
          pass_first_downs: stats.pass_first_downs,
          interceptions: stats.interceptions,
          rush_attempts: stats.rush_attempts,
          rush_yards: stats.rush_yards,
          rush_tds: stats.rush_tds,
          rush_first_downs: stats.rush_first_downs,
          receptions: stats.receptions,
          rec_yards: stats.rec_yards,
          rec_tds: stats.rec_tds,
          rec_first_downs: stats.rec_first_downs,
          fg_made: stats.fg_made,
          fg_attempts: stats.fg_attempts,
          fg_0_39: stats.fg_0_39,
          fg_40_49: stats.fg_40_49,
          fg_50_plus: stats.fg_50_plus,
          xp_made: stats.xp_made,
          pat_attempts: stats.pat_attempts,
          dst_sacks: stats.dst_sacks,
          dst_ints: stats.dst_ints,
          dst_fumbles_rec: stats.dst_fumbles_rec,
          dst_tds: stats.dst_tds,
          dst_safety: stats.dst_safety,
          dst_tackles: stats.dst_tackles,
          dst_points_allowed: stats.dst_points_allowed,
        };
      });

      const queuesMap: { [userId: string]: number[] } = {};
      (queueData || []).forEach((q: any) => {
        if (!queuesMap[q.user_id]) queuesMap[q.user_id] = [];
        queuesMap[q.user_id].push(q.player_id);
      });

      setLeague(leagueData);
      leagueRef.current = leagueData;
      setMembers(membersData || []);
      membersRef.current = membersData || [];
      setPlayers(playersWithStats);
      playersRef.current = playersWithStats;
      setPicks(picksData || []);
      picksRef.current = picksData || [];
      setAllQueues(queuesMap);
      allQueuesRef.current = queuesMap;
      setQueue(queuesMap[user.id] || []);
      setChatMessages((chatData || []).map((m: any) => ({
        text: m.message, team: m.team_name,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })));

      if (leagueData?.draft_status === "IN_PROGRESS" && leagueData?.pick_start_time) {
        pickStartTimeRef.current = leagueData.pick_start_time;
        setTimeLeft(getTimeLeftFromServer(leagueData.pick_start_time));
      }

      const totalP = (membersData || []).length * TOTAL_PICKS_PER_TEAM;
      if (leagueData?.draft_status === "IN_PROGRESS" && (picksData || []).length >= totalP && totalP > 0) {
        await supabase.from("leagues").update({ draft_status: "COMPLETED" }).eq("id", leagueId);
        setLeague((prev: any) => ({ ...prev, draft_status: "COMPLETED" }));
      }

      setLoading(false);

      const presenceChannel = supabase.channel(`presence-${leagueId}`, {
        config: { presence: { key: user.id } },
      });
      presenceChannel
        .on("presence", { event: "sync" } as any, () => {
          const online = Object.keys(presenceChannel.presenceState());
          setOnlineUserIds(online);
          onlineUserIdsRef.current = online;
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            const myMember = (membersData || []).find((m: any) => m.user_id === user.id);
            await presenceChannel.track({ user_id: user.id, team_name: myMember?.team_name || "Unknown" });
          }
        });

      const leagueSub = supabase.channel(`league-status-${leagueId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leagues", filter: `id=eq.${leagueId}` },
          (payload) => {
            setLeague((prev: any) => ({ ...prev, ...payload.new }));
            leagueRef.current = { ...leagueRef.current, ...payload.new };
            if (payload.new.pick_start_time) {
              pickStartTimeRef.current = payload.new.pick_start_time;
              setTimeLeft(getTimeLeftFromServer(payload.new.pick_start_time));
            }
          })
        .subscribe();

      const queueSub = supabase.channel(`queue-${leagueId}`)
        .on("broadcast", { event: "queue_update" }, (payload) => {
          const { userId, queue: updatedQueue } = payload.payload;
          setAllQueues(prev => ({ ...prev, [userId]: updatedQueue }));
          allQueuesRef.current = { ...allQueuesRef.current, [userId]: updatedQueue };
        })
        .subscribe();

      return () => {
        supabase.removeChannel(presenceChannel);
        supabase.removeChannel(leagueSub);
        supabase.removeChannel(queueSub);
      };
    }
    const cleanup = load();

    const picksBroadcast = supabase.channel(`picks-broadcast-${leagueId}`)
      .on("broadcast", { event: "pick" }, (payload) => {
        const pick = payload.payload;
        if (pick.user_id === userRef.current?.id) return;
        setPicks(prev => {
          if (prev.some(p => p.pick_number === pick.pick_number)) return prev;
          return [...prev, pick];
        });
        if (pick.pick_start_time) {
          pickStartTimeRef.current = pick.pick_start_time;
          setTimeLeft(getTimeLeftFromServer(pick.pick_start_time));
        }
        autoPickFiredRef.current = false;
      })
      .subscribe();

    const picksSub = supabase.channel(`draft-picks-${leagueId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "draft_picks" },
        (payload) => {
          if (payload.new.league_id !== leagueId) return;
          if (payload.new.user_id === userRef.current?.id) return;
          setPicks(prev => {
            if (prev.some(p => p.pick_number === payload.new.pick_number)) return prev;
            return [...prev, payload.new];
          });
        })
      .subscribe();

    const chatSub = supabase.channel(`chat-${leagueId}`)
      .on("broadcast", { event: "chat" }, (payload) => {
        setChatMessages(prev => [...prev, payload.payload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(picksBroadcast);
      supabase.removeChannel(picksSub);
      supabase.removeChannel(chatSub);
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      cleanup.then(fn => fn && fn());
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (league?.draft_status !== "IN_PROGRESS") return;
    if (timerRef.current) clearInterval(timerRef.current);
    autoPickFiredRef.current = false;

    timerRef.current = setInterval(() => {
      if (!pickStartTimeRef.current) return;
      const tl = getTimeLeftFromServer(pickStartTimeRef.current);
      setTimeLeft(tl);

      if (tl === 10) playUrgentBeep();
      if (tl <= 5 && tl > 0) playTickBeep();

      if (tl <= 0 && !autoPickFiredRef.current) {
        autoPickFiredRef.current = true;
        const currentPicks = picksRef.current;
        const currentMembers = membersRef.current;
        const currentUser = userRef.current;
        if (!currentUser || !currentMembers.length) return;

        const pickNumber = currentPicks.length + 1;
        const numTeams = currentMembers.length;
        const round = Math.ceil(pickNumber / numTeams);
        const posInRound = (pickNumber - 1) % numTeams;
        const index = round % 2 === 0 ? numTeams - 1 - posInRound : posInRound;
        const owner = currentMembers[index];
        if (!owner) return;

        if (owner.user_id === currentUser.id) {
          executeAutoPick(currentUser.id);
        }
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [loading, league?.draft_status]);

  useEffect(() => { autoPickFiredRef.current = false; }, [picks.length]);

  useEffect(() => {
    if (loading || league?.draft_status !== "IN_PROGRESS") return;
    const currentPicks = picksRef.current;
    const currentMembers = membersRef.current;
    if (!currentMembers.length) return;

    const pickNumber = currentPicks.length + 1;
    const numTeams = currentMembers.length;
    const round = Math.ceil(pickNumber / numTeams);
    const posInRound = (pickNumber - 1) % numTeams;
    const index = round % 2 === 0 ? numTeams - 1 - posInRound : posInRound;
    const owner = currentMembers[index];
    const myTurn = owner?.user_id === user?.id;
    const ownerIsOffline = owner ? !onlineUserIdsRef.current.includes(owner.user_id) : false;

    if (myTurn && !wasMyTurnRef.current) {
      playOnClockAlert();
      if (autoPickEnabledRef.current) {
        setTimeout(() => executeAutoPick(user.id), 300);
      }
    } else if (!myTurn && owner && ownerIsOffline) {
      const offlineOwnerUserId = owner.user_id;
      const expectedPickNumber = currentPicks.length + 1;
      if (lastOfflineAutoPickRef.current !== expectedPickNumber) {
        lastOfflineAutoPickRef.current = expectedPickNumber;
        setTimeout(() => {
          const latestPicks = picksRef.current;
          if (latestPicks.length === currentPicks.length) {
            executeAutoPick(offlineOwnerUserId);
          }
        }, 1500);
      }
    }

    wasMyTurnRef.current = myTurn;
  }, [picks, league?.draft_status]);

  useEffect(() => {
    if (loading) return;
    const isPreDraft = league?.draft_status !== "IN_PROGRESS" && league?.draft_status !== "COMPLETED";
    if (!isPreDraft || !league?.draft_time) { setCountdown(null); return; }
    let warnedAt10 = false;
    let autoStartFired = false;
    function tick() {
      const target = parseUTCTimestamp(league.draft_time).getTime();
      const diff = target - Date.now();
      if (diff <= 0) {
        setCountdown({ d: 0, h: 0, m: 0, s: 0 });
        if (!autoStartFired && leagueRef.current?.draft_status !== "IN_PROGRESS" && leagueRef.current?.draft_status !== "COMPLETED") {
          autoStartFired = true;
          clearInterval(countdownRef.current);
          handleStartDraft();
        }
        return;
      }
      const secs = Math.floor(diff / 1000);
      setCountdown({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: secs % 60,
      });
      if (secs <= 10 && !warnedAt10) {
        warnedAt10 = true;
        setCountdownWarning(true);
        playDraftOpeningAlert();
      } else if (secs > 10) {
        setCountdownWarning(false);
      }
    }
    tick();
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(tick, 1000);
    return () => { clearInterval(countdownRef.current); setCountdownWarning(false); };
  }, [loading, league?.draft_status, league?.draft_time]);

  useEffect(() => {
    if (loading || !league || !user) return;
    const totalPicks = membersRef.current.length * TOTAL_PICKS_PER_TEAM;
    const isDraftComplete = picks.length >= totalPicks && totalPicks > 0;
    if (isDraftComplete && !rosterEmailSent && user.id === league.commissioner_user_id) {
      setRosterEmailSent(true);
      supabase.from("leagues").update({ draft_status: "COMPLETED" }).eq("id", leagueId);
      setLeague((prev: any) => ({ ...prev, draft_status: "COMPLETED" }));
    }
  }, [picks, loading, league, user]);

  async function handleStartDraft() {
    setStartingDraft(true);
    const now = new Date().toISOString();
    pickStartTimeRef.current = now;
    await supabase.from("leagues").update({
      draft_status: "IN_PROGRESS", pick_start_time: now,
    }).eq("id", leagueId);
    setLeague((prev: any) => ({ ...prev, draft_status: "IN_PROGRESS", pick_start_time: now }));
    leagueRef.current = { ...leagueRef.current, draft_status: "IN_PROGRESS", pick_start_time: now };
    setTimeLeft(TIMER_SECONDS);
    setStartingDraft(false);
  }

  function getPickOwner(pickNumber: number) {
    const m = membersRef.current;
    if (!m.length) return null;
    const numTeams = m.length;
    const round = Math.ceil(pickNumber / numTeams);
    const posInRound = ((pickNumber - 1) % numTeams);
    const index = round % 2 === 0 ? numTeams - 1 - posInRound : posInRound;
    return m[index];
  }

  function getSnakeOrderForRound(round: number) {
    if (!members.length) return [];
    return round % 2 === 0 ? [...members].reverse() : [...members];
  }

  function isMyTurn() { return getPickOwner(picks.length + 1)?.user_id === user?.id; }
  function isPickedAlready(playerId: number) { return picks.some(p => p.player_id === playerId); }

  function getMyRoster() {
    return picks.filter(p => p.user_id === user?.id)
      .map(p => players.find(pl => pl.id === p.player_id)).filter(Boolean);
  }

  function getRosterByPosition(position: string) {
    return getMyRoster().filter((p: any) => p.position === position);
  }

  function canDraftPosition(position: string): boolean {
    return getRosterByPosition(position).length < (ROSTER_SLOTS[position as keyof typeof ROSTER_SLOTS] || 0);
  }

  async function toggleQueue(playerId: number) {
    const updated = queue.includes(playerId)
      ? queue.filter(id => id !== playerId)
      : [...queue, playerId];
    setQueue(updated);
    await saveQueueToDB(user.id, updated);
    await supabase.channel(`queue-${leagueId}`).send({
      type: "broadcast", event: "queue_update",
      payload: { userId: user.id, queue: updated },
    });
    setAllQueues(prev => ({ ...prev, [user.id]: updated }));
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: string }) {
    if (sortKey !== k) return <span className="text-gray-700 ml-0.5">↕</span>;
    return <span className="text-green-400 ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function handleLeaveDraft() {
    if (window.opener) window.close();
    else router.push(`/league/${leagueId}`);
  }

  async function makePick(playerId: number) {
    if (!isMyTurn() || isPreDraft) return;
    const player = players.find(p => p.id === playerId);
    if (player && !canDraftPosition(player.position)) {
      setPositionError(`You already have the maximum number of ${player.position}s.`);
      setTimeout(() => setPositionError(null), 3000);
      return;
    }

    const currentPicks = picksRef.current;
    const pickNumber = currentPicks.length + 1;
    const numTeams = members.length;
    const round = Math.ceil(pickNumber / numTeams);
    const pickInRound = ((pickNumber - 1) % numTeams) + 1;
    const pickStartTime = new Date().toISOString();

    const newPick = {
      id: `optimistic-${Date.now()}`, league_id: leagueId, user_id: user.id,
      player_id: playerId, pick_number: pickNumber, round, pick_in_round: pickInRound,
      is_auto_pick: false, pick_start_time: pickStartTime,
    };

    setPicks(prev => [...prev, newPick]);
    pickStartTimeRef.current = pickStartTime;
    setTimeLeft(TIMER_SECONDS);

    // Play sound and show drafted flash
    playPickMadeSound();
    if (player) {
      setDraftedFlash({ name: player.name, position: player.position });
      setTimeout(() => setDraftedFlash(null), 1800);
    }

    if (queue.includes(playerId)) {
      const updated = queue.filter(id => id !== playerId);
      setQueue(updated);
      await saveQueueToDB(user.id, updated);
      await supabase.channel(`queue-${leagueId}`).send({
        type: "broadcast", event: "queue_update",
        payload: { userId: user.id, queue: updated },
      });
    }

    await supabase.channel(`picks-broadcast-${leagueId}`).send({
      type: "broadcast", event: "pick", payload: newPick,
    });

    await savePick({ leagueId, userId: user.id, playerId, pickNumber, round, pickInRound, isAutoPick: false });
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    const myMember = members.find(m => m.user_id === user?.id);
    const teamName = myMember?.team_name || "Unknown";
    const text = chatInput.trim();
    const message = { text, team: teamName, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    await supabase.channel(`chat-${leagueId}`).send({ type: "broadcast", event: "chat", payload: message });
    await supabase.from("draft_chat_messages").insert({ league_id: leagueId, user_id: user.id, team_name: teamName, message: text });
    setChatMessages(prev => [...prev, message]);
    setChatInput("");
  }

  const isPreDraft = league?.draft_status !== "IN_PROGRESS" && league?.draft_status !== "COMPLETED";
  const totalPicks = members.length * TOTAL_PICKS_PER_TEAM;
  const draftComplete = picks.length >= totalPicks;
  const currentPickNumber = picks.length + 1;
  const currentPickOwner = getPickOwner(currentPickNumber);
  const nextPickOwner = draftComplete ? null : getPickOwner(currentPickNumber + 1);
  const lastPick = picks.length > 0 ? picks[picks.length - 1] : null;
  const lastPickPlayer = lastPick ? players.find(p => p.id === lastPick.player_id) : null;
  const lastPickOwner = lastPick ? members.find(m => m.user_id === lastPick.user_id) : null;
  const autoPickPlayer = [...players].filter(p => !isPickedAlready(p.id)).sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0))[0];
  const currentRound = Math.ceil(currentPickNumber / (members.length || 1));
  const isCommissioner = user?.id === league?.commissioner_user_id;
  const isEvenRound = currentRound % 2 === 0;
  const snakeOrderThisRound = getSnakeOrderForRound(currentRound);
  const picksThisRoundCount = picks.filter(p => p.round === currentRound).length;
  const currentOwnerOnline = currentPickOwner ? onlineUserIds.includes(currentPickOwner.user_id) : true;

  const queuedPlayers = queue.map(id => players.find(p => p.id === id)).filter(Boolean).filter((p: any) => !isPickedAlready(p.id));
  const statCols = STAT_COLS[positionFilter] || STAT_COLS.ALL;

  let filteredPlayers = players.filter(p => {
    if (showAvailableOnly && isPickedAlready(p.id)) return false;
    if (positionFilter !== "ALL" && p.position !== positionFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  filteredPlayers = [...filteredPlayers].sort((a, b) => {
    const aVal = parseFloat(a[sortKey]) || 0;
    const bVal = parseFloat(b[sortKey]) || 0;
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return (b.fantasy_points || 0) - (a.fantasy_points || 0);
  });

  const statColWidth = "3.5rem";
  const gridCols = `2rem 2.5rem 1fr ${statCols.map(() => statColWidth).join(" ")} 3.5rem 6rem`;

  function renderStat(player: any, col: StatCol): string {
    const val = player[col.field];
    if (val == null) return "—";
    if (col.field === "fantasy_points") return parseFloat(val).toFixed(1);
    return String(Math.round(parseFloat(val)));
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Loading draft...</p>
    </main>
  );

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      {/* DRAFTED FLASH OVERLAY */}
      {draftedFlash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-green-600 text-white px-10 py-6 rounded-2xl shadow-2xl animate-bounce text-center">
            <p className="text-4xl font-black">✅ Drafted!</p>
            <p className="text-xl font-bold mt-1">{draftedFlash.name}</p>
            <p className="text-sm text-green-200 mt-0.5">{draftedFlash.position}</p>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border-b border-gray-800 flex-shrink-0">

        <div className="px-3 py-2 flex items-center justify-between border-b border-gray-800 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <PFFLLogo size={24} />
            <div className="min-w-0 hidden sm:block">
              <p className="text-xs text-gray-500 leading-none">Draft Room</p>
              <p className="text-sm font-bold leading-none mt-0.5 truncate">{league?.name}</p>
            </div>
          </div>

          <div className="text-center flex-shrink-0">
            {isPreDraft ? (
              countdown ? (
                <>
                  <div className={`text-xl sm:text-3xl font-mono font-black ${countdownWarning ? "text-red-400 animate-pulse" : "text-blue-400"}`}>
                    {countdown.d > 0 && `${countdown.d}d `}
                    {String(countdown.h).padStart(2, "0")}:{String(countdown.m).padStart(2, "0")}:{String(countdown.s).padStart(2, "0")}
                  </div>
                  <p className={`text-xs ${countdownWarning ? "text-red-400 font-bold" : "text-gray-500"}`}>
                    {countdownWarning ? "🚨 Starting!" : "Until Draft"}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-xl font-black text-gray-500">⏳</div>
                  <p className="text-xs text-gray-500">Not Scheduled</p>
                </>
              )
            ) : (
              <>
                <div className={`text-3xl sm:text-4xl font-mono font-black leading-none ${timeLeft <= 5 ? "text-red-400 animate-pulse" : timeLeft <= 10 ? "text-orange-400" : "text-green-400"}`}>
                  {draftComplete ? "✅" : `${String(Math.floor(timeLeft / 60)).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`}
                </div>
                <p className="text-xs text-gray-500">
                  {draftComplete ? "Complete" : `Rd ${currentRound} · ${currentPickNumber}/${totalPicks}`}
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isPreDraft && !draftComplete && (
              <button onClick={() => setAutoPickEnabled(prev => !prev)}
                className={`text-xs font-bold px-2 py-1.5 rounded border transition-colors ${autoPickEnabled ? "bg-yellow-700 border-yellow-600 text-yellow-200" : "bg-gray-800 border-gray-700 text-gray-400"}`}>
                {autoPickEnabled ? "🤖 ON" : "🤖"}
              </button>
            )}
            {isPreDraft && isCommissioner && (
              <button onClick={handleStartDraft} disabled={startingDraft}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded">
                {startingDraft ? "..." : "🏈 Start"}
              </button>
            )}
            <button onClick={handleLeaveDraft}
              className="text-gray-500 text-xs border border-gray-700 px-2 py-1.5 rounded hover:border-gray-500">
              Leave
            </button>
          </div>
        </div>

        <div className={`px-3 py-2 flex items-center justify-between gap-2 ${
          countdownWarning && isPreDraft ? "bg-red-950" :
          isMyTurn() && !draftComplete && !isPreDraft ? "bg-green-900" : ""
        }`}>
          <div className="flex-1 min-w-0">
            {isPreDraft ? (
              <p className={`text-xs sm:text-sm ${countdownWarning ? "text-red-300 font-bold animate-pulse" : "text-blue-300"}`}>
                {countdownWarning
                  ? "🚨 Draft starting — get ready!"
                  : `🔍 Pre-Draft Lobby${isCommissioner ? " — hit Start to begin." : " — drafting opens when clock hits zero."}`}
              </p>
            ) : draftComplete ? (
              <p className="font-bold text-green-400 text-sm">🏆 Draft Complete!</p>
            ) : isMyTurn() ? (
              <p className="font-black text-green-300 text-sm sm:text-lg">⚡ You're on the clock!</p>
            ) : (
              <p className="text-gray-300 text-xs sm:text-sm truncate">
                On the clock: <span className={`font-bold ${currentOwnerOnline ? "text-white" : "text-gray-500"}`}>
                  {currentPickOwner?.team_name}
                </span>
                {!currentOwnerOnline && <span className="text-gray-600 text-xs ml-1">(offline)</span>}
              </p>
            )}
          </div>
          <div className="hidden sm:flex gap-6 text-xs flex-shrink-0">
            {!isPreDraft && lastPickPlayer && (
              <div className="text-right">
                <p className="text-gray-600 uppercase tracking-wider text-xs mb-0.5">Last Pick</p>
                <p className="text-white font-bold">{lastPickPlayer.name}</p>
                <p className="text-gray-500">{lastPickPlayer.position} · {lastPickOwner?.team_name}</p>
              </div>
            )}
            {!isPreDraft && autoPickPlayer && !draftComplete && (
              <div className="text-right">
                <p className="text-gray-600 uppercase tracking-wider text-xs mb-0.5">Next Auto</p>
                <p className="text-white font-bold">{autoPickPlayer.name}</p>
                <p className="text-gray-500">{autoPickPlayer.position} · {autoPickPlayer.nfl_teams?.abbreviation}</p>
              </div>
            )}
            {isPreDraft && (
              <div className="text-right">
                <p className="text-gray-600 uppercase tracking-wider text-xs mb-0.5">Online</p>
                <p className="text-white font-bold">{onlineUserIds.length}/{members.length}</p>
              </div>
            )}
          </div>
        </div>

        {positionError && (
          <div className="px-4 py-2 bg-red-900 border-t border-red-700 text-red-200 text-xs font-bold text-center">
            ⚠️ {positionError}
          </div>
        )}

        <div className="border-t border-gray-800 px-3 py-2 overflow-x-auto">
          {isPreDraft ? (
            <div className="flex items-center gap-2 min-w-max">
              <p className="text-gray-600 text-xs mr-1 flex-shrink-0">Draft Order:</p>
              {members.map((member, i) => {
                const isMe = member.user_id === user?.id;
                const isOnline = onlineUserIds.includes(member.user_id);
                return (
                  <div key={member.id} className="flex flex-col items-center">
                    <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${isMe ? "bg-green-600" : "bg-gray-700"} ${!isOnline ? "opacity-40" : ""}`}>
                      {member.team_name.charAt(0).toUpperCase()}
                      {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-gray-900" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{i + 1}</p>
                  </div>
                );
              })}
            </div>
          ) : draftComplete ? (
            <p className="text-gray-600 text-xs text-center py-1">🏆 Draft Complete — Good Luck!</p>
          ) : (
            <div className="flex items-center gap-1 min-w-max">
              <div className="flex flex-col items-center mr-2 flex-shrink-0">
                <p className="text-gray-500 text-xs font-bold">Rd {currentRound}</p>
                <p className="text-gray-600 text-xs">{isEvenRound ? "←" : "→"}</p>
              </div>
              {snakeOrderThisRound.map((member, posInRound) => {
                const isOnClock = member.user_id === currentPickOwner?.user_id;
                const isNext = member.user_id === nextPickOwner?.user_id && !isOnClock;
                const isMe = member.user_id === user?.id;
                const hasPicked = posInRound < picksThisRoundCount;
                const isOffline = !onlineUserIds.includes(member.user_id);
                const memberTotalPicks = picks.filter(p => p.user_id === member.user_id).length;
                return (
                  <div key={member.id} className="flex flex-col items-center">
                    <p className={`text-xs font-mono mb-0.5 ${isOnClock ? "text-yellow-400 font-bold" : isNext ? "text-gray-400" : "text-gray-700"}`}>
                      {(currentRound - 1) * members.length + posInRound + 1}
                    </p>
                    <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${isMe ? "bg-green-600" : "bg-gray-700"} ${
                      isOnClock ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900 scale-110"
                        : isNext ? "ring-1 ring-gray-500 ring-offset-1 ring-offset-gray-900"
                        : hasPicked ? "opacity-30" : "opacity-70"
                    }`}>
                      {member.team_name.charAt(0).toUpperCase()}
                      {isOnClock && !isOffline && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-yellow-400 text-xs leading-none">▼</span>}
                      {isOffline && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-gray-600 rounded-full border border-gray-900" />}
                      {isOnClock && isOffline && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-gray-500 text-xs leading-none">▼</span>}
                    </div>
                    <p className={`text-xs mt-0.5 truncate max-w-10 text-center ${isOnClock ? isOffline ? "text-gray-500" : "text-yellow-300 font-bold" : isNext ? "text-gray-400" : "text-gray-600"}`}>
                      {member.team_name.split(" ")[0]}
                    </p>
                    <p className="text-xs text-gray-700 font-mono">{memberTotalPicks}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="md:hidden flex border-t border-gray-800">
          {(["roster", "players", "board"] as MobileTab[]).map(tab => (
            <button key={tab} onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors capitalize ${mobileTab === tab ? "text-green-400 border-green-500 bg-gray-800" : "text-gray-500 border-transparent"}`}>
              {tab === "board" ? "Board" : tab === "roster" ? "My Roster" : "Players"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        <div className={`${mobileTab === "roster" ? "flex" : "hidden"} md:flex w-full md:w-48 flex-shrink-0 bg-gray-900 md:border-r border-gray-800 flex-col`}>
          <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">
              My Roster ({getMyRoster().length}/{TOTAL_PICKS_PER_TEAM})
            </p>
          </div>
          <div className="overflow-y-auto flex-1 px-2 py-2 pb-20">
            {isPreDraft && (
              <p className="text-gray-600 text-xs text-center mt-4 mb-4 px-2">
                Draft starts soon — browse players and set your queue!
              </p>
            )}
            {Object.entries(ROSTER_SLOTS).map(([pos, slots]) => (
              <div key={pos} className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-black px-1.5 py-0.5 rounded ${getPositionBadge(pos)}`}>{pos}</span>
                  <span className={`text-xs font-bold ${getRosterByPosition(pos).length >= slots ? "text-green-400" : "text-gray-600"}`}>
                    {getRosterByPosition(pos).length}/{slots}
                  </span>
                </div>
                {Array.from({ length: slots }, (_, i) => {
                  const player = getRosterByPosition(pos)[i];
                  return (
                    <div key={i} className={`px-2 py-1.5 rounded mb-0.5 text-xs ${player ? "bg-gray-800" : "bg-gray-900 border border-dashed border-gray-800"}`}>
                      {player ? <p className="font-bold text-white truncate">{player.name}</p> : <p className="text-gray-700">Empty</p>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className={`${mobileTab === "players" ? "flex" : "hidden"} md:flex flex-1 flex-col overflow-hidden`}>

          {queuedPlayers.length > 0 && (
            <div className="bg-blue-950 border-b border-blue-800 px-3 py-2 flex-shrink-0">
              <p className="text-xs font-bold text-blue-300 mb-1">Queue ({queuedPlayers.length}) — picks first available if you go auto</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {queuedPlayers.map((player: any) => (
                  <div key={player.id} className="flex items-center gap-1.5 bg-blue-900 rounded px-2 py-1.5 flex-shrink-0">
                    <span className={`text-xs font-black px-1 py-0.5 rounded ${getPositionBadge(player.position)}`}>{player.position}</span>
                    <span className="text-xs font-bold text-white">{player.name}</span>
                    {isMyTurn() && !isPreDraft && (
                      <button onClick={() => makePick(player.id)} className="bg-green-600 text-white text-xs px-2 py-0.5 rounded font-bold ml-1">Draft</button>
                    )}
                    <button onClick={() => toggleQueue(player.id)} className="text-blue-400 text-xs ml-1">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0 bg-gray-900">
            <div className="flex gap-2 mb-2">
              <input type="text" placeholder="Search players..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-800 text-white px-3 py-2 rounded text-sm flex-1 border border-gray-700 focus:outline-none focus:border-green-500 min-w-0"
              />
              <button onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                className={`px-2 py-2 rounded text-xs font-bold border whitespace-nowrap flex-shrink-0 ${showAvailableOnly ? "bg-green-700 border-green-600 text-white" : "bg-gray-800 border-gray-700 text-gray-300"}`}>
                {showAvailableOnly ? "✓ Avail" : "All"}
              </button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {["ALL", "QB", "RB", "WR", "TE", "K", "DST"].map(pos => {
                const slots = ROSTER_SLOTS[pos as keyof typeof ROSTER_SLOTS] || 0;
                const full = pos !== "ALL" && getRosterByPosition(pos).length >= slots;
                return (
                  <button key={pos} onClick={() => { setPositionFilter(pos); setSortKey("fantasy_points"); setSortDir("desc"); }}
                    className={`px-2 py-1 rounded text-xs font-bold relative ${positionFilter === pos ? "bg-green-600 text-white" : full ? "bg-gray-800 text-green-400 ring-1 ring-green-700" : "bg-gray-800 text-gray-400"}`}>
                    {pos}
                    {full && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden md:block border-b border-gray-800 bg-gray-900 flex-shrink-0 overflow-x-auto">
            <div className="grid text-xs text-gray-500 font-bold uppercase px-3 py-1.5 min-w-max items-center"
              style={{ gridTemplateColumns: gridCols }}>
              <span className="text-gray-600">RK</span>
              <span></span>
              <span className="pl-2">PLAYER</span>
              {statCols.map(col => (
                <button key={col.key} onClick={() => handleSort(col.field)}
                  className="text-right hover:text-gray-300 flex items-center justify-end">
                  {col.label}<SortIcon k={col.field} />
                </button>
              ))}
              <span className="text-right">POS</span>
              <span className="text-right">ACTION</span>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 pb-20 md:pb-6">
            <div className="hidden md:block overflow-x-auto">
              {filteredPlayers.map((player, index) => {
                const picked = isPickedAlready(player.id);
                const inQueue = queue.includes(player.id);
                const positionFull = !canDraftPosition(player.position);
                return (
                  <div key={player.id}
                    className={`grid items-center border-b border-gray-800 px-3 py-2 min-w-max transition-colors ${picked ? "opacity-30 bg-gray-950" : "hover:bg-gray-900"}`}
                    style={{ gridTemplateColumns: gridCols }}>
                    <span className="text-xs text-gray-600">{index + 1}</span>
                    <PlayerAvatar name={player.name} position={player.position} />
                    <div className="pl-2 min-w-0">
                      <p className={`font-bold text-sm truncate ${picked ? "line-through text-gray-500" : "text-white"}`}>{player.name}</p>
                      <p className="text-xs text-gray-500">{player.nfl_teams?.abbreviation} · Seed {player.nfl_teams?.seed || "—"}</p>
                    </div>
                    {statCols.map(col => (
                      <span key={col.key} className={`text-xs text-right font-mono tabular-nums ${col.field === "fantasy_points" ? "text-blue-400 font-bold" : "text-gray-300"}`}>
                        {renderStat(player, col)}
                      </span>
                    ))}
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded text-center justify-self-end ${getPositionBadge(player.position)}`}>
                      {player.position}
                    </span>
                    <div className="flex gap-1 justify-end">
                      {!picked ? (
                        <>
                          <button onClick={() => toggleQueue(player.id)}
                            className={`text-xs px-1.5 py-1 rounded ${inQueue ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-500 hover:bg-gray-700"}`}>
                            {inQueue ? "★" : "☆"}
                          </button>
                          {isMyTurn() && !isPreDraft && (
                            <button onClick={() => makePick(player.id)} disabled={positionFull}
                              className={`text-xs font-bold px-3 py-1 rounded ${positionFull ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-500 text-white"}`}>
                              {positionFull ? "Full" : "Draft"}
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-700">Drafted</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="md:hidden">
              {filteredPlayers.map((player, index) => {
                const picked = isPickedAlready(player.id);
                const inQueue = queue.includes(player.id);
                const positionFull = !canDraftPosition(player.position);
                return (
                  <div key={player.id}
                    className={`px-3 py-3 border-b border-gray-800 flex items-center gap-3 ${picked ? "opacity-30 bg-gray-950" : ""}`}>
                    <span className="text-xs text-gray-600 w-5 text-center flex-shrink-0">{index + 1}</span>
                    <PlayerAvatar name={player.name} position={player.position} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate ${picked ? "line-through text-gray-500" : "text-white"}`}>{player.name}</p>
                      <p className="text-xs text-gray-500">
                        {player.nfl_teams?.abbreviation} · {player.fantasy_points
                          ? <span className="text-blue-400 font-bold">{player.fantasy_points.toFixed(1)}</span>
                          : "No stats"}
                      </p>
                    </div>
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded flex-shrink-0 ${getPositionBadge(player.position)}`}>
                      {player.position}
                    </span>
                    {!picked ? (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => toggleQueue(player.id)}
                          className={`w-9 h-9 rounded flex items-center justify-center text-base ${inQueue ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-500"}`}>
                          {inQueue ? "★" : "☆"}
                        </button>
                        {isMyTurn() && !isPreDraft && (
                          <button onClick={() => makePick(player.id)} disabled={positionFull}
                            className={`h-9 px-3 rounded text-xs font-bold ${positionFull ? "bg-gray-700 text-gray-500" : "bg-green-600 text-white"}`}>
                            {positionFull ? "Full" : "Draft"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-700 flex-shrink-0">Picked</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="h-4" />
          </div>
        </div>

        <div className={`${mobileTab === "board" ? "flex" : "hidden"} md:flex w-full md:w-60 flex-shrink-0 bg-gray-900 md:border-l border-gray-800 flex-col`}>
          <div className="flex border-b border-gray-800 flex-shrink-0">
            <button onClick={() => setRightPanel("board")}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${rightPanel === "board" ? "text-green-400 border-green-500" : "text-gray-500 border-transparent"}`}>
              Draft Board
            </button>
            <button onClick={() => setRightPanel("chat")}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${rightPanel === "chat" ? "text-green-400 border-green-500" : "text-gray-500 border-transparent"}`}>
              Smack Talk 💬
            </button>
          </div>

          {rightPanel === "board" && (
            <div className="overflow-y-auto flex-1 px-2 py-2 pb-20 md:pb-6">
              {isPreDraft ? (
                <p className="text-gray-600 text-xs text-center mt-8 px-2">Picks will appear here once the draft begins.</p>
              ) : picks.length === 0 ? (
                <p className="text-gray-600 text-xs text-center mt-8">No picks yet.</p>
              ) : (
                [...picks].reverse().map((pick) => {
                  const player = players.find(p => p.id === pick.player_id);
                  const owner = members.find(m => m.user_id === pick.user_id);
                  const isMe = pick.user_id === user?.id;
                  return (
                    <div key={pick.id} className={`flex items-center gap-2 px-2 py-2 rounded mb-1 ${isMe ? "bg-green-950 border border-green-900" : "bg-gray-800"}`}>
                      <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0 font-mono">{pick.pick_number}</span>
                      {player && <PlayerAvatar name={player.name} position={player.position} />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{player?.name}</p>
                        <p className="text-xs text-gray-500 truncate">{player?.position} · {owner?.team_name}</p>
                      </div>
                      {pick.is_auto_pick && <span className="text-xs text-yellow-600 flex-shrink-0">AUTO</span>}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {rightPanel === "chat" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 px-3 py-2">
                {chatMessages.length === 0 ? (
                  <p className="text-gray-600 text-xs text-center mt-8">No messages yet — say something!</p>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className="mb-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-green-400 text-xs font-bold">{msg.team}</span>
                        <span className="text-gray-600 text-xs">{msg.time}</span>
                      </div>
                      <p className="text-white text-xs">{msg.text}</p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="px-3 py-3 border-t border-gray-800 flex-shrink-0">
                <div className="flex gap-2">
                  <input type="text" placeholder="Talk trash..." value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    className="flex-1 bg-gray-800 text-white px-3 py-2.5 rounded text-sm border border-gray-700 focus:outline-none focus:border-green-500"
                  />
                  <button onClick={sendChat} className="bg-green-600 text-white font-bold px-4 py-2.5 rounded text-sm">Send</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}