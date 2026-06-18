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

// Audio helpers using Web Audio API
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
  setTimeout(() => createBeep(440, 0.15, 0.4), 0);
  setTimeout(() => createBeep(550, 0.15, 0.4), 180);
  setTimeout(() => createBeep(660, 0.3, 0.5), 360);
}

function playUrgentBeep() {
  createBeep(880, 0.2, 0.4);
}

function playTickBeep() {
  createBeep(660, 0.08, 0.25);
}

function PFFLLogo({ size = 28 }: { size?: number }) {
  return (
    <img src="/apple-touch-icon.png" alt="PFFL Logo" width={size} height={size} style={{ borderRadius: "20%" }} />
  );
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

// Position-specific stat column definitions
type StatCol = { key: string; label: string; field: string };

const STAT_COLS: { [pos: string]: StatCol[] } = {
  QB: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "pass_completions", label: "PC", field: "pass_completions" },
    { key: "pass_attempts", label: "PA", field: "pass_attempts" },
    { key: "pass_yards", label: "PY", field: "pass_yards" },
    { key: "pass_tds", label: "PTD", field: "pass_tds" },
    { key: "pass_first_downs", label: "PFD", field: "pass_first_downs" },
    { key: "interceptions", label: "INT", field: "interceptions" },
    { key: "rush_attempts", label: "RA", field: "rush_attempts" },
    { key: "rush_yards", label: "RY", field: "rush_yards" },
    { key: "rush_tds", label: "RTD", field: "rush_tds" },
  ],
  RB: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "rush_attempts", label: "RA", field: "rush_attempts" },
    { key: "rush_yards", label: "RY", field: "rush_yards" },
    { key: "rush_tds", label: "RTD", field: "rush_tds" },
    { key: "rush_first_downs", label: "RFD", field: "rush_first_downs" },
    { key: "receptions", label: "REC", field: "receptions" },
    { key: "rec_yards", label: "REY", field: "rec_yards" },
    { key: "rec_tds", label: "RETD", field: "rec_tds" },
    { key: "rec_first_downs", label: "REFD", field: "rec_first_downs" },
  ],
  WR: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "receptions", label: "REC", field: "receptions" },
    { key: "rec_yards", label: "REY", field: "rec_yards" },
    { key: "rec_tds", label: "RETD", field: "rec_tds" },
    { key: "rec_first_downs", label: "REFD", field: "rec_first_downs" },
    { key: "rush_yards", label: "RY", field: "rush_yards" },
    { key: "rush_tds", label: "RTD", field: "rush_tds" },
  ],
  TE: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "receptions", label: "REC", field: "receptions" },
    { key: "rec_yards", label: "REY", field: "rec_yards" },
    { key: "rec_tds", label: "RETD", field: "rec_tds" },
    { key: "rec_first_downs", label: "REFD", field: "rec_first_downs" },
  ],
  K: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "fg_attempts", label: "FGA", field: "fg_attempts" },
    { key: "fg_made", label: "FG", field: "fg_made" },
    { key: "fg_0_39", label: "FG0", field: "fg_0_39" },
    { key: "fg_40_49", label: "FG40", field: "fg_40_49" },
    { key: "fg_50_plus", label: "FG50", field: "fg_50_plus" },
    { key: "pat_attempts", label: "PATA", field: "pat_attempts" },
    { key: "xp_made", label: "PAT", field: "xp_made" },
  ],
  DST: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
    { key: "dst_tackles", label: "TK", field: "dst_tackles" },
    { key: "dst_sacks", label: "SK", field: "dst_sacks" },
    { key: "dst_ints", label: "INT", field: "dst_ints" },
    { key: "dst_fumbles_rec", label: "FR", field: "dst_fumbles_rec" },
    { key: "dst_tds", label: "TD", field: "dst_tds" },
    { key: "dst_safety", label: "SAF", field: "dst_safety" },
  ],
  ALL: [
    { key: "proj", label: "FPTS", field: "fantasy_points" },
  ],
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
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [queue, setQueue] = useState<number[]>([]);
  const [rightPanel, setRightPanel] = useState<"board" | "chat">("board");
  const [mobileTab, setMobileTab] = useState<MobileTab>("players");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [startingDraft, setStartingDraft] = useState(false);
  const [autoPickEnabled, setAutoPickEnabled] = useState(false);
  const timerRef = useRef<any>(null);
  const countdownRef = useRef<any>(null);
  const picksRef = useRef<any[]>([]);
  const membersRef = useRef<any[]>([]);
  const userRef = useRef<any>(null);
  const chatEndRef = useRef<any>(null);
  const wasMyTurnRef = useRef(false);
  const autoPickEnabledRef = useRef(false);
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id as string;

  useEffect(() => { picksRef.current = picks; }, [picks]);
  useEffect(() => { membersRef.current = members; }, [members]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { autoPickEnabledRef.current = autoPickEnabled; }, [autoPickEnabled]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

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
        .from("player_stats")
        .select("*")
        .eq("season", 2026)
        .eq("week", 0);

      const { data: picksData } = await supabase
        .from("draft_picks").select("*").eq("league_id", leagueId).order("pick_number");
      const { data: chatData } = await supabase
        .from("draft_chat_messages").select("*").eq("league_id", leagueId).order("created_at");

      // Build stats lookup map keyed by player_id
      const statsMap: { [playerId: number]: any } = {};
      (statsData || []).forEach((s: any) => { statsMap[s.player_id] = s; });

      // Merge all stats onto players
      const playersWithStats = (playersData || []).map((p: any) => ({
        ...p,
        ...(statsMap[p.id] || {}),
        fantasy_points: parseFloat(statsMap[p.id]?.fantasy_points) || 0,
      }));

      setLeague(leagueData);
      setMembers(membersData || []);
      membersRef.current = membersData || [];
      setPlayers(playersWithStats);
      setPicks(picksData || []);
      picksRef.current = picksData || [];
      setChatMessages((chatData || []).map((m: any) => ({
        text: m.message, team: m.team_name,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })));
      setLoading(false);

      const presenceChannel = supabase.channel(`presence-${leagueId}`, {
        config: { presence: { key: user.id } },
      });
      presenceChannel
        .on("presence", { event: "sync" } as any, () => {
          setOnlineUserIds(Object.keys(presenceChannel.presenceState()));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            const myMember = (membersData || []).find((m: any) => m.user_id === user.id);
            await presenceChannel.track({ user_id: user.id, team_name: myMember?.team_name || "Unknown" });
          }
        });

      const leagueSub = supabase.channel(`league-status-${leagueId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leagues", filter: `id=eq.${leagueId}` },
          (payload) => { setLeague((prev: any) => ({ ...prev, ...payload.new })); })
        .subscribe();

      return () => {
        supabase.removeChannel(presenceChannel);
        supabase.removeChannel(leagueSub);
      };
    }
    const cleanup = load();

    const picksSub = supabase.channel(`draft-picks-${leagueId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "draft_picks", filter: `league_id=eq.${leagueId}` },
        (payload) => {
          if (payload.new.user_id !== userRef.current?.id) {
            setPicks(prev => {
              if (prev.some(p => p.pick_number === payload.new.pick_number)) return prev;
              return [...prev, payload.new];
            });
            setTimeLeft(TIMER_SECONDS);
          }
        })
      .subscribe();

    const chatSub = supabase.channel(`chat-${leagueId}`)
      .on("broadcast", { event: "chat" }, (payload) => {
        setChatMessages(prev => [...prev, payload.payload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(picksSub);
      supabase.removeChannel(chatSub);
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      cleanup.then(fn => fn && fn());
    };
  }, []);

  // Pick timer + audio alerts
  useEffect(() => {
    if (loading) return;
    if (league?.draft_status !== "IN_PROGRESS") return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleAutoPick(); return TIMER_SECONDS; }
        if (prev === 10) playUrgentBeep();
        if (prev <= 5 && prev > 0) playTickBeep();
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [picks, loading, members, league?.draft_status]);

  // On-clock alert — fire when it becomes my turn
  useEffect(() => {
    if (loading || league?.draft_status !== "IN_PROGRESS") return;
    const myTurn = getPickOwner(picks.length + 1)?.user_id === user?.id;
    if (myTurn && !wasMyTurnRef.current) {
      playOnClockAlert();
      if (autoPickEnabledRef.current) {
        setTimeout(() => handleAutoPick(), 500);
      }
    }
    wasMyTurnRef.current = myTurn;
  }, [picks, league?.draft_status]);

  // Countdown timer
  useEffect(() => {
    if (loading) return;
    const isPreDraft = league?.draft_status !== "IN_PROGRESS" && league?.draft_status !== "COMPLETED";
    if (!isPreDraft || !league?.draft_time) { setCountdown(null); return; }

    function tick() {
      const target = parseUTCTimestamp(league.draft_time).getTime();
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown({ d: 0, h: 0, m: 0, s: 0 }); return; }
      setCountdown({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    }
    tick();
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [loading, league?.draft_status, league?.draft_time]);

  async function handleStartDraft() {
    setStartingDraft(true);
    await supabase.from("leagues").update({ draft_status: "IN_PROGRESS" }).eq("id", leagueId);
    setLeague((prev: any) => ({ ...prev, draft_status: "IN_PROGRESS" }));
    setTimeLeft(TIMER_SECONDS);
    setStartingDraft(false);
  }

  function getCurrentPickNumber() { return picks.length + 1; }

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

  function isMyTurn() {
    return getPickOwner(getCurrentPickNumber())?.user_id === user?.id;
  }

  function isPickedAlready(playerId: number) {
    return picks.some(p => p.player_id === playerId);
  }

  function getMyRoster() {
    return picks.filter(p => p.user_id === user?.id)
      .map(p => players.find(pl => pl.id === p.player_id)).filter(Boolean);
  }

  function getRosterByPosition(position: string) {
    return getMyRoster().filter((p: any) => p.position === position);
  }

  function toggleQueue(playerId: number) {
    setQueue(prev => prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ k }: { k: string }) {
    if (sortKey !== k) return <span className="text-gray-700 ml-0.5">↕</span>;
    return <span className="text-green-400 ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function handleLeaveDraft() {
    if (window.opener) { window.close(); }
    else { router.push(`/league/${leagueId}`); }
  }

  async function makePick(playerId: number) {
    if (!isMyTurn() || isPreDraft) return;
    const pickNumber = getCurrentPickNumber();
    const numTeams = members.length;
    const round = Math.ceil(pickNumber / numTeams);
    const pickInRound = ((pickNumber - 1) % numTeams) + 1;

    setPicks(prev => [...prev, {
      id: `optimistic-${Date.now()}`, league_id: leagueId, user_id: user.id,
      player_id: playerId, pick_number: pickNumber, round, pick_in_round: pickInRound, is_auto_pick: false,
    }]);
    setTimeLeft(TIMER_SECONDS);
    setQueue(prev => prev.filter(id => id !== playerId));

    await supabase.from("draft_picks").insert({
      league_id: leagueId, user_id: user.id, player_id: playerId,
      pick_number: pickNumber, round, pick_in_round: pickInRound,
    });
  }

  async function handleAutoPick() {
    const currentPicks = picksRef.current;
    const currentMembers = membersRef.current;
    const currentUser = userRef.current;
    const pickNumber = currentPicks.length + 1;
    const owner = getPickOwner(pickNumber);
    if (!owner || owner.user_id !== currentUser?.id) return;

    const pickedIds = currentPicks.map((p: any) => p.player_id);
    const available = [...players]
      .filter(p => !pickedIds.includes(p.id))
      .sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0))[0];
    if (!available) return;

    const numTeams = currentMembers.length;
    const round = Math.ceil(pickNumber / numTeams);
    const pickInRound = ((pickNumber - 1) % numTeams) + 1;

    setPicks(prev => [...prev, {
      id: `optimistic-auto-${Date.now()}`, league_id: leagueId, user_id: owner.user_id,
      player_id: available.id, pick_number: pickNumber, round, pick_in_round: pickInRound, is_auto_pick: true,
    }]);
    setTimeLeft(TIMER_SECONDS);

    await supabase.from("draft_picks").insert({
      league_id: leagueId, user_id: owner.user_id, player_id: available.id,
      pick_number: pickNumber, round, pick_in_round: pickInRound, is_auto_pick: true,
    });
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
  const currentPickNumber = getCurrentPickNumber();
  const currentPickOwner = getPickOwner(currentPickNumber);
  const nextPickOwner = draftComplete ? null : getPickOwner(currentPickNumber + 1);
  const lastPick = picks.length > 0 ? picks[picks.length - 1] : null;
  const lastPickPlayer = lastPick ? players.find(p => p.id === lastPick.player_id) : null;
  const lastPickOwner = lastPick ? members.find(m => m.user_id === lastPick.user_id) : null;
  const autoPickPlayer = [...players]
    .filter(p => !isPickedAlready(p.id))
    .sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0))[0];
  const currentRound = Math.ceil(currentPickNumber / (members.length || 1));
  const isCommissioner = user?.id === league?.commissioner_user_id;
  const isEvenRound = currentRound % 2 === 0;
  const snakeOrderThisRound = getSnakeOrderForRound(currentRound);
  const picksThisRoundCount = picks.filter(p => p.round === currentRound).length;

  const queuedPlayers = queue
    .map(id => players.find(p => p.id === id)).filter(Boolean)
    .filter((p: any) => !isPickedAlready(p.id));

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

  const statColWidth = "3rem";
  const gridCols = `2rem 2.5rem 1fr ${statCols.map(() => statColWidth).join(" ")} 3.5rem 6rem`;

  // Helper to render a stat value — show "—" only when the value is null/undefined,
  // not when it's a legitimate 0 (e.g. DST with 0 sacks in a game)
  function renderStat(player: any, col: StatCol): string {
    const val = player[col.field];
    if (val == null) return "—";
    if (col.field === "fantasy_points") return parseFloat(val).toFixed(1);
    const rounded = Math.round(parseFloat(val));
    return String(rounded);
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading draft...</p>
    </main>
  );

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      {/* TOP BAR */}
      <div className="bg-gray-900 border-b border-gray-800 flex-shrink-0">

        {/* Row 1: Logo + Timer + Controls */}
        <div className="px-2 sm:px-4 py-2 flex items-center justify-between border-b border-gray-800 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <PFFLLogo size={28} />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 leading-none hidden sm:block">Draft Room</p>
              <p className="text-xs sm:text-sm font-bold leading-none mt-0.5 truncate max-w-[80px] sm:max-w-none">{league?.name}</p>
            </div>
          </div>

          <div className="text-center flex-shrink-0">
            {isPreDraft ? (
              countdown ? (
                <>
                  <div className="text-lg sm:text-2xl font-mono font-black text-blue-400">
                    {countdown.d > 0 && `${countdown.d}d `}
                    {String(countdown.h).padStart(2, "0")}:{String(countdown.m).padStart(2, "0")}:{String(countdown.s).padStart(2, "0")}
                  </div>
                  <p className="text-xs text-gray-500 whitespace-nowrap">Until Draft Starts</p>
                </>
              ) : (
                <>
                  <div className="text-lg sm:text-2xl font-black text-gray-500">⏳</div>
                  <p className="text-xs text-gray-500 whitespace-nowrap">Not Scheduled</p>
                </>
              )
            ) : (
              <>
                <div className={`text-2xl sm:text-4xl font-mono font-black ${timeLeft <= 5 ? "text-red-400 animate-pulse" : timeLeft <= 10 ? "text-orange-400" : "text-green-400"}`}>
                  {draftComplete ? "✅" : `${String(Math.floor(timeLeft / 60)).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`}
                </div>
                <p className="text-xs text-gray-500 whitespace-nowrap">
                  {draftComplete ? "Complete" : `Rd ${currentRound} · Pick ${currentPickNumber}/${totalPicks}`}
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isPreDraft && !draftComplete && (
              <button
                onClick={() => setAutoPickEnabled(prev => !prev)}
                className={`text-xs font-bold px-2 py-1 rounded border transition-colors whitespace-nowrap ${
                  autoPickEnabled
                    ? "bg-yellow-700 border-yellow-600 text-yellow-200"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {autoPickEnabled ? "🤖 Auto ON" : "🤖 Auto"}
              </button>
            )}
            {isPreDraft && isCommissioner && (
              <button
                onClick={handleStartDraft}
                disabled={startingDraft}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 rounded transition-colors whitespace-nowrap"
              >
                {startingDraft ? "Starting..." : "🏈 Start"}
              </button>
            )}
            <button
              onClick={handleLeaveDraft}
              className="text-gray-500 hover:text-white text-xs sm:text-sm border border-gray-700 px-2 sm:px-3 py-1 rounded hover:border-gray-500 transition-colors whitespace-nowrap"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Row 2: Status bar */}
        <div className={`px-2 sm:px-4 py-2 flex items-center justify-between gap-2 ${isMyTurn() && !draftComplete && !isPreDraft ? "bg-green-900" : ""}`}>
          <div className="flex-1 min-w-0">
            {isPreDraft ? (
              <p className="text-blue-300 text-xs sm:text-sm">
                🔍 Pre-Draft Lobby — browse players, set your queue, and chat. Drafting opens when the clock hits zero
                {isCommissioner ? ` or you hit Start.` : `.`}
              </p>
            ) : draftComplete ? (
              <p className="font-bold text-green-400 text-sm">🏆 Draft Complete!</p>
            ) : isMyTurn() ? (
              <p className="font-black text-green-300 text-sm sm:text-lg">⚡ You're on the clock!</p>
            ) : (
              <p className="text-gray-300 text-xs sm:text-sm truncate">
                On the clock: <span className="text-white font-bold">{currentPickOwner?.team_name}</span>
              </p>
            )}
          </div>
          <div className="hidden sm:flex gap-8 text-xs flex-shrink-0">
            {!isPreDraft && lastPickPlayer && (
              <div className="text-right">
                <p className="text-gray-600 uppercase tracking-wider text-xs mb-0.5">Last Pick</p>
                <p className="text-white font-bold">{lastPickPlayer.name}</p>
                <p className="text-gray-500">{lastPickPlayer.position} · {lastPickOwner?.team_name}</p>
              </div>
            )}
            {!isPreDraft && autoPickPlayer && !draftComplete && (
              <div className="text-right">
                <p className="text-gray-600 uppercase tracking-wider text-xs mb-0.5">Auto Pick</p>
                <p className="text-white font-bold">{autoPickPlayer.name}</p>
                <p className="text-gray-500">{autoPickPlayer.position} · {autoPickPlayer.nfl_teams?.abbreviation}</p>
              </div>
            )}
            {isPreDraft && (
              <div className="text-right">
                <p className="text-gray-600 uppercase tracking-wider text-xs mb-0.5">In Draft Room</p>
                <p className="text-white font-bold">{onlineUserIds.length}/{members.length} Online</p>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Snake Order Strip */}
        <div className="border-t border-gray-800 px-2 sm:px-4 py-2 overflow-x-auto">
          {isPreDraft ? (
            <div className="flex items-center gap-1 sm:gap-2 min-w-max">
              <p className="text-gray-600 text-xs mr-1 flex-shrink-0">Draft Order:</p>
              {members.map((member, i) => {
                const isMe = member.user_id === user?.id;
                const isOnline = onlineUserIds.includes(member.user_id);
                return (
                  <div key={member.id} className="flex flex-col items-center">
                    <div className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-black ${isMe ? "bg-green-600" : "bg-gray-700"} ${!isOnline ? "opacity-40" : ""}`}>
                      {member.team_name.charAt(0).toUpperCase()}
                      {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-gray-900" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{i + 1}</p>
                  </div>
                );
              })}
            </div>
          ) : draftComplete ? (
            <p className="text-gray-600 text-xs text-center py-1">Draft complete — all picks are in!</p>
          ) : (
            <div className="flex items-center gap-1 min-w-max">
              <div className="flex flex-col items-center mr-2 flex-shrink-0">
                <p className="text-gray-500 text-xs font-bold">Rd {currentRound}</p>
                <p className="text-gray-600 text-xs">{isEvenRound ? "←" : "→"}</p>
              </div>
              {snakeOrderThisRound.map((member, positionInRound) => {
                const isOnClock = member.user_id === currentPickOwner?.user_id;
                const isNext = member.user_id === nextPickOwner?.user_id && !isOnClock;
                const isMe = member.user_id === user?.id;
                const hasPicked = positionInRound < picksThisRoundCount;
                const memberTotalPicks = picks.filter(p => p.user_id === member.user_id).length;
                return (
                  <div key={member.id} className="flex flex-col items-center">
                    <p className={`text-xs font-mono mb-0.5 ${isOnClock ? "text-yellow-400 font-bold" : isNext ? "text-gray-400" : "text-gray-700"}`}>
                      {(currentRound - 1) * members.length + positionInRound + 1}
                    </p>
                    <div className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-black transition-all ${isMe ? "bg-green-600" : "bg-gray-700"} ${
                      isOnClock ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900 scale-110"
                        : isNext ? "ring-1 ring-gray-500 ring-offset-1 ring-offset-gray-900"
                        : hasPicked ? "opacity-30" : "opacity-70"
                    }`}>
                      {member.team_name.charAt(0).toUpperCase()}
                      {isOnClock && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-yellow-400 text-xs leading-none">▼</span>}
                    </div>
                    <p className={`text-xs mt-0.5 truncate max-w-12 sm:max-w-16 text-center ${isOnClock ? "text-yellow-300 font-bold" : isNext ? "text-gray-400" : "text-gray-600"}`}>
                      {member.team_name.split(" ")[0]}
                    </p>
                    <p className="text-xs text-gray-700 font-mono">{memberTotalPicks}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MOBILE TAB SWITCHER */}
        <div className="md:hidden flex border-t border-gray-800">
          {(["roster", "players", "board"] as MobileTab[]).map(tab => (
            <button key={tab} onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors capitalize ${mobileTab === tab ? "text-green-400 border-green-500 bg-gray-800" : "text-gray-500 border-transparent"}`}>
              {tab === "board" ? "Board / Chat" : tab === "roster" ? "My Roster" : "Players"}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL: My Roster */}
        <div className={`${mobileTab === "roster" ? "flex" : "hidden"} md:flex w-full md:w-52 flex-shrink-0 bg-gray-900 md:border-r border-gray-800 flex-col`}>
          <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">
              My Roster ({getMyRoster().length}/{TOTAL_PICKS_PER_TEAM})
            </p>
          </div>
          <div className="overflow-y-auto flex-1 px-2 py-2 pb-6">
            {isPreDraft && (
              <p className="text-gray-600 text-xs text-center mt-4 mb-4 px-2">
                Your roster will fill up once the draft begins. Use this time to set your player queue!
              </p>
            )}
            {Object.entries(ROSTER_SLOTS).map(([pos, slots]) => (
              <div key={pos} className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-black px-1.5 py-0.5 rounded ${getPositionBadge(pos)}`}>{pos}</span>
                  <span className="text-xs text-gray-600">{getRosterByPosition(pos).length}/{slots}</span>
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

        {/* CENTER PANEL: Player List */}
        <div className={`${mobileTab === "players" ? "flex" : "hidden"} md:flex flex-1 flex-col overflow-hidden`}>

          {/* Queue */}
          {queuedPlayers.length > 0 && (
            <div className="bg-blue-950 border-b border-blue-800 px-3 py-2 flex-shrink-0">
              <p className="text-xs font-bold text-blue-300 mb-1">Queue ({queuedPlayers.length})</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {queuedPlayers.map((player: any) => (
                  <div key={player.id} className="flex items-center gap-2 bg-blue-900 rounded px-2 py-1 flex-shrink-0">
                    <span className="text-xs font-bold text-white">{player.name}</span>
                    <span className="text-xs text-blue-300">{player.position}</span>
                    {isMyTurn() && !isPreDraft && (
                      <button onClick={() => makePick(player.id)} className="bg-green-600 text-white text-xs px-2 py-0.5 rounded font-bold">Draft</button>
                    )}
                    <button onClick={() => toggleQueue(player.id)} className="text-blue-400 hover:text-white text-xs">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0 bg-gray-900">
            <div className="flex gap-2 mb-2">
              <input type="text" placeholder="Search players..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-800 text-white p-2 rounded text-sm flex-1 border border-gray-700 focus:outline-none focus:border-green-500"
              />
              <button onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                className={`px-3 py-2 rounded text-xs font-bold border whitespace-nowrap ${showAvailableOnly ? "bg-green-700 border-green-600 text-white" : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"}`}>
                {showAvailableOnly ? "✓ Available" : "All Players"}
              </button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {["ALL", "QB", "RB", "WR", "TE", "K", "DST"].map(pos => (
                <button key={pos} onClick={() => { setPositionFilter(pos); setSortKey("fantasy_points"); setSortDir("desc"); }}
                  className={`px-2 py-1 rounded text-xs font-bold ${positionFilter === pos ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Column Headers */}
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

          {/* Player Rows */}
          <div className="overflow-y-auto flex-1 pb-6">
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              {filteredPlayers.map((player, index) => {
                const picked = isPickedAlready(player.id);
                const inQueue = queue.includes(player.id);
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
                          <button onClick={() => toggleQueue(player.id)} title={inQueue ? "Remove from queue" : "Add to queue"}
                            className={`text-xs px-1.5 py-1 rounded ${inQueue ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-500 hover:bg-gray-700"}`}>
                            {inQueue ? "★" : "☆"}
                          </button>
                          {isMyTurn() && !isPreDraft && (
                            <button onClick={() => makePick(player.id)}
                              className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1 rounded">
                              Draft
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

            {/* Mobile */}
            <div className="md:hidden">
              {filteredPlayers.map((player, index) => {
                const picked = isPickedAlready(player.id);
                const inQueue = queue.includes(player.id);
                return (
                  <div key={player.id}
                    className={`px-3 py-2.5 border-b border-gray-800 flex items-center gap-2 ${picked ? "opacity-30 bg-gray-950" : "active:bg-gray-900"}`}>
                    <span className="text-xs text-gray-600 w-5 flex-shrink-0">{index + 1}</span>
                    <PlayerAvatar name={player.name} position={player.position} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate ${picked ? "line-through text-gray-500" : "text-white"}`}>{player.name}</p>
                      <p className="text-xs text-gray-500">
                        {player.nfl_teams?.abbreviation} · {player.fantasy_points ? player.fantasy_points.toFixed(1) + " pts" : "No stats"}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${getPositionBadge(player.position)}`}>
                      {player.position}
                    </span>
                    <div className="flex gap-1 flex-shrink-0">
                      {!picked ? (
                        <>
                          <button onClick={() => toggleQueue(player.id)}
                            className={`text-xs px-2 py-1.5 rounded ${inQueue ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-500"}`}>
                            {inQueue ? "★" : "☆"}
                          </button>
                          {isMyTurn() && !isPreDraft && (
                            <button onClick={() => makePick(player.id)}
                              className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded">
                              Draft
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
            <div className="h-4" />
          </div>
        </div>

        {/* RIGHT PANEL: Board + Chat */}
        <div className={`${mobileTab === "board" ? "flex" : "hidden"} md:flex w-full md:w-64 flex-shrink-0 bg-gray-900 md:border-l border-gray-800 flex-col`}>
          <div className="flex border-b border-gray-800 flex-shrink-0">
            <button onClick={() => setRightPanel("board")}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors ${rightPanel === "board" ? "text-green-400 border-green-500" : "text-gray-500 border-transparent hover:text-white"}`}>
              Draft Board
            </button>
            <button onClick={() => setRightPanel("chat")}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors ${rightPanel === "chat" ? "text-green-400 border-green-500" : "text-gray-500 border-transparent hover:text-white"}`}>
              Smack Talk 💬
            </button>
          </div>

          {rightPanel === "board" && (
            <div className="overflow-y-auto flex-1 px-2 py-2 pb-6">
              {isPreDraft ? (
                <p className="text-gray-600 text-xs text-center mt-8 px-2">Draft hasn't started yet — picks will appear here once it begins.</p>
              ) : picks.length === 0 ? (
                <p className="text-gray-600 text-xs text-center mt-8">No picks yet — draft is about to begin!</p>
              ) : (
                [...picks].reverse().map((pick) => {
                  const player = players.find(p => p.id === pick.player_id);
                  const owner = members.find(m => m.user_id === pick.user_id);
                  const isMe = pick.user_id === user?.id;
                  return (
                    <div key={pick.id} className={`flex items-center gap-2 px-2 py-2 rounded mb-1 ${isMe ? "bg-green-950 border border-green-900" : "bg-gray-800"}`}>
                      <span className="text-xs text-gray-600 w-6 text-right flex-shrink-0 font-mono">{pick.pick_number}</span>
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
              <div className="h-4" />
            </div>
          )}

          {rightPanel === "chat" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 px-3 py-2 pb-2">
                {chatMessages.length === 0 ? (
                  <p className="text-gray-600 text-xs text-center mt-8">No messages yet...<br />Say something!</p>
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
                    className="flex-1 bg-gray-800 text-white p-2 rounded text-xs border border-gray-700 focus:outline-none focus:border-green-500"
                  />
                  <button onClick={sendChat} className="bg-green-600 hover:bg-green-500 text-white font-bold px-3 py-2 rounded text-xs">Send</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
