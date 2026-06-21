"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";
import Nav from "../../components/Nav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const AVATAR_COLORS = [
  { name: "green", bg: "bg-green-700", hex: "#15803d" },
  { name: "blue", bg: "bg-blue-700", hex: "#1d4ed8" },
  { name: "purple", bg: "bg-purple-700", hex: "#7e22ce" },
  { name: "red", bg: "bg-red-700", hex: "#b91c1c" },
  { name: "orange", bg: "bg-orange-600", hex: "#ea580c" },
  { name: "yellow", bg: "bg-yellow-600", hex: "#ca8a04" },
  { name: "pink", bg: "bg-pink-600", hex: "#db2777" },
  { name: "teal", bg: "bg-teal-600", hex: "#0d9488" },
  { name: "indigo", bg: "bg-indigo-700", hex: "#4338ca" },
  { name: "rose", bg: "bg-rose-700", hex: "#be123c" },
  { name: "cyan", bg: "bg-cyan-600", hex: "#0891b2" },
  { name: "lime", bg: "bg-lime-600", hex: "#65a30d" },
];

function Avatar({ member, size = "md" }: { member: any; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-10 h-10 text-sm";
  const initials = member.team_name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.team_name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  const color = AVATAR_COLORS.find(c => c.name === member.avatar_color) || AVATAR_COLORS[0];

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-black flex-shrink-0`}
      style={{ backgroundColor: color.hex }}
    >
      {initials}
    </div>
  );
}

function BracketView({ games, teams }: { games: any[]; teams: any[] }) {
  const [confTab, setConfTab] = useState<"AFC" | "NFC">("AFC");

  function getTeam(id: number) {
    return teams.find(t => t.id === id);
  }

  function getGamesForRound(conf: string, round: string) {
    return games.filter(g => g.conference === conf && g.round === round);
  }

  function BracketGame({ game }: { game: any }) {
    const home = getTeam(game.home_team_id);
    const away = getTeam(game.away_team_id);
    const winner = game.winner_team_id;

    function TeamRow({ team, isWinner }: { team: any; isWinner: boolean }) {
      if (!team) return (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
          <span className="text-gray-600 text-xs w-5 text-center">—</span>
          <span className="text-gray-600 text-sm">TBD</span>
        </div>
      );
      return (
        <div className={`flex items-center gap-2 px-3 py-2 border-b border-gray-700 last:border-0 ${isWinner ? "bg-green-950" : winner && !isWinner ? "opacity-40" : ""}`}>
          <span className={`text-xs font-black w-5 text-center ${isWinner ? "text-green-400" : "text-gray-500"}`}>
            {team.seed}
          </span>
          <span className={`text-sm font-bold flex-1 ${isWinner ? "text-green-400" : "text-white"}`}>
            {team.abbreviation}
          </span>
          {isWinner && <span className="text-green-400 text-xs">✓</span>}
          {team.is_eliminated && !isWinner && <span className="text-red-500 text-xs">✕</span>}
        </div>
      );
    }

    return (
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 w-44 flex-shrink-0">
        <TeamRow team={home} isWinner={winner === game.home_team_id} />
        <TeamRow team={away} isWinner={winner === game.away_team_id} />
        {game.game_time && (
          <div className="px-3 py-1 bg-gray-900">
            <p className="text-xs text-gray-600">{game.game_time}</p>
          </div>
        )}
      </div>
    );
  }

  function RoundColumn({ conf, round, label }: { conf: string; round: string; label: string }) {
    const roundGames = getGamesForRound(conf, round);
    if (round === "DIV" && roundGames.length === 0) {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-2">{label}</p>
          <div className="bg-gray-800 rounded-lg border border-dashed border-gray-700 w-44 h-20 flex items-center justify-center">
            <p className="text-gray-600 text-xs">After Wild Card</p>
          </div>
          <div className="bg-gray-800 rounded-lg border border-dashed border-gray-700 w-44 h-20 flex items-center justify-center">
            <p className="text-gray-600 text-xs">After Wild Card</p>
          </div>
        </div>
      );
    }
    if ((round === "CC" || round === "SB") && roundGames.length === 0) {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-2">{label}</p>
          <div className="bg-gray-800 rounded-lg border border-dashed border-gray-700 w-44 h-20 flex items-center justify-center">
            <p className="text-gray-600 text-xs">TBD</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">{label}</p>
        {roundGames.map(g => <BracketGame key={g.id} game={g} />)}
      </div>
    );
  }

  const afcBye = teams.find(t => t.conference === "AFC" && t.seed === 1);
  const nfcBye = teams.find(t => t.conference === "NFC" && t.seed === 1);

  function ByeCard({ team }: { team: any }) {
    if (!team) return null;
    const isElim = team.is_eliminated;
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 w-44 px-3 py-3 flex-shrink-0 ${isElim ? "opacity-40" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-black text-gray-500 w-5 text-center">{team.seed}</span>
          <span className={`text-sm font-bold ${isElim ? "text-gray-500 line-through" : "text-white"}`}>{team.abbreviation}</span>
        </div>
        <p className="text-xs text-blue-400 font-bold pl-7">BYE</p>
      </div>
    );
  }

  const byeTeam = confTab === "AFC" ? afcBye : nfcBye;

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(["AFC", "NFC"] as const).map(c => (
          <button
            key={c}
            onClick={() => setConfTab(c)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              confTab === c ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-8 min-w-max">
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Wild Card</p>
            <ByeCard team={byeTeam} />
            {getGamesForRound(confTab, "WC").map(g => <BracketGame key={g.id} game={g} />)}
          </div>
          <RoundColumn conf={confTab} round="DIV" label="Divisional" />
          <RoundColumn conf={confTab} round="CC" label="Conf. Champ" />
        </div>
      </div>

      {games.some(g => g.round === "SB") && (
        <div className="mt-8 pt-6 border-t border-gray-800">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-4">Super Bowl</p>
          <div className="flex gap-4">
            {getGamesForRound("SB", "SB").map(g => <BracketGame key={g.id} game={g} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeaguePage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"league" | "bracket">("league");
  const [games, setGames] = useState<any[]>([]);
  const [nflTeams, setNflTeams] = useState<any[]>([]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedColor, setSelectedColor] = useState("green");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState("");
  const [savingTeamName, setSavingTeamName] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

      const { data: gamesData, error: gamesError } = await supabase
        .from("playoff_games").select("*").eq("season", 2026).order("game_date");

      const { data: teamsData, error: teamsError } = await supabase
        .from("nfl_teams").select("*").eq("season", 2026);

      console.log("GAMES:", gamesData, "GAMES_ERROR:", gamesError);
      console.log("TEAMS:", teamsData, "TEAMS_ERROR:", teamsError);

      setLeague(leagueData);
      setMembers(membersData || []);
      setGames(gamesData || []);
      setNflTeams(teamsData || []);

      const myMember = (membersData || []).find((m: any) => m.user_id === user.id);
      if (myMember?.avatar_color) setSelectedColor(myMember.avatar_color);
      if (myMember?.team_name) setTeamNameInput(myMember.team_name);

      setLoading(false);
    }
    load();
  }, []);

  function openDraftRoom() {
    window.open(
      `/draft/${leagueId}`,
      'draftroom',
      'width=1400,height=900,scrollbars=no,resizable=yes'
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSaveAvatar() {
    if (!user) return;
    setUploadingAvatar(true);

    let avatarUrl: string | null = null;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `${user.id}/${leagueId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });

      if (!uploadError) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = data.publicUrl;
      }
    }

    await supabase
      .from("league_members")
      .update({
        avatar_color: selectedColor,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })
      .eq("league_id", leagueId)
      .eq("user_id", user.id);

    setMembers(prev => prev.map(m =>
      m.user_id === user.id
        ? { ...m, avatar_color: selectedColor, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) }
        : m
    ));

    setUploadingAvatar(false);
    setShowAvatarModal(false);
    setAvatarFile(null);
    setAvatarPreview(null);
  }

  async function handleRemoveAvatar() {
    if (!user) return;
    setUploadingAvatar(true);

    await supabase
      .from("league_members")
      .update({ avatar_url: null })
      .eq("league_id", leagueId)
      .eq("user_id", user.id);

    setMembers(prev => prev.map(m =>
      m.user_id === user.id ? { ...m, avatar_url: null } : m
    ));

    setUploadingAvatar(false);
    setShowAvatarModal(false);
  }

  async function handleSaveTeamName() {
    if (!user) return;
    const trimmed = teamNameInput.trim();
    if (!trimmed) return;

    setSavingTeamName(true);

    await supabase
      .from("league_members")
      .update({ team_name: trimmed })
      .eq("league_id", leagueId)
      .eq("user_id", user.id);

    setMembers(prev => prev.map(m =>
      m.user_id === user.id ? { ...m, team_name: trimmed } : m
    ));

    setSavingTeamName(false);
    setEditingTeamName(false);
  }

  async function handleRemoveMember(targetUserId: string) {
    setRemovingMemberId(targetUserId);
    const res = await fetch("/api/remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId,
        requestingUserId: user.id,
        targetUserId,
      }),
    });

    if (res.ok) {
      setMembers(prev => prev.filter(m => m.user_id !== targetUserId));
    } else {
      const data = await res.json();
      alert(`Failed to remove member: ${data.error}`);
    }

    setRemovingMemberId(null);
    setConfirmRemoveId(null);
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
  const isDraftStarted = league.draft_status === "IN_PROGRESS" || league.draft_status === "COMPLETED";
  const spotsLeft = league.num_teams - members.length;
  const draftComplete = league.draft_status === "COMPLETED";
  const conferenceEnabled = league.conference_enabled;
  const confAName = league.conference_a_name || "AFC";
  const confBName = league.conference_b_name || "NFC";
  const myMember = members.find(m => m.user_id === user?.id);

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

      {showAvatarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-700">
            <h2 className="font-black text-lg mb-4">Edit Your Avatar</h2>
            <div className="flex justify-center mb-5">
              {avatarPreview ? (
                <img src={avatarPreview} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <Avatar member={{ ...myMember, avatar_color: selectedColor, avatar_url: null }} size="lg" />
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-lg text-sm mb-4">
              📁 Upload Image
            </button>
            <p className="text-gray-400 text-xs mb-2">Default color (if no image):</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color.name}
                  onClick={() => { setSelectedColor(color.name); setAvatarPreview(null); setAvatarFile(null); }}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor === color.name ? "border-white scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveAvatar} disabled={uploadingAvatar} className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-2.5 rounded-lg text-sm">
                {uploadingAvatar ? "Saving..." : "Save"}
              </button>
              {myMember?.avatar_url && (
                <button onClick={handleRemoveAvatar} disabled={uploadingAvatar} className="bg-red-900 hover:bg-red-800 text-red-300 font-bold py-2.5 px-4 rounded-lg text-sm">
                  Remove
                </button>
              )}
              <button onClick={() => { setShowAvatarModal(false); setAvatarPreview(null); setAvatarFile(null); }} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">

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
              draftComplete ? "bg-green-900 text-green-400" : "bg-yellow-900 text-yellow-400"
            }`}>
              {draftComplete ? "Draft Complete" : "Draft Pending"}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{members.length}/{league.num_teams}</p>
              <p className="text-xs text-gray-500 mt-1">Teams Joined</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-black ${spotsLeft === 0 ? "text-gray-500" : "text-green-400"}`}>{spotsLeft}</p>
              <p className="text-xs text-gray-500 mt-1">Spots Left</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-white">4</p>
              <p className="text-xs text-gray-500 mt-1">Playoff Weeks</p>
            </div>
          </div>

          {draftComplete ? (
            <div className="w-full bg-gray-800 border border-gray-700 text-gray-400 font-black py-3 rounded-lg text-lg text-center">
              🏆 Draft Complete — Good Luck!
            </div>
          ) : (
            <button onClick={openDraftRoom} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-lg text-lg transition-colors">
              🏈 Enter Draft Room
            </button>
          )}
        </div>

        <div className="flex border-b border-gray-800 mb-6">
          <button
            onClick={() => setActiveTab("league")}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "league" ? "border-green-500 text-green-400" : "border-transparent text-gray-500 hover:text-white"
            }`}
          >
            Teams
          </button>
          <button
            onClick={() => setActiveTab("bracket")}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "bracket" ? "border-green-500 text-green-400" : "border-transparent text-gray-500 hover:text-white"
            }`}
          >
            🏈 Playoff Bracket
          </button>
        </div>

        {activeTab === "bracket" ? (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            {games.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">Bracket will be available once playoff teams are set.</p>
              </div>
            ) : (
              <BracketView games={games} teams={nflTeams} />
            )}
          </div>
        ) : (
          <>
            <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
              <h2 className="font-bold mb-4 text-gray-300 uppercase text-xs tracking-wider">
                Teams ({members.length}/{league.num_teams})
              </h2>
              <div className="flex flex-col gap-1">
                {members.map((member) => {
                  const isMe = member.user_id === user?.id;
                  const isEditingThisName = isMe && editingTeamName;
                  const isThisCommissioner = member.user_id === league.commissioner_user_id;
                  const isConfirmingRemove = confirmRemoveId === member.user_id;
                  const isRemoving = removingMemberId === member.user_id;

                  return (
                    <div key={member.id} className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0">
                      <div className="relative flex-shrink-0">
                        <Avatar member={member} size="md" />
                        {isMe && (
                          <button onClick={() => setShowAvatarModal(true)} className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-600 hover:bg-gray-500 rounded-full flex items-center justify-center text-xs" title="Edit avatar">
                            ✏
                          </button>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditingThisName ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={teamNameInput}
                              onChange={(e) => setTeamNameInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSaveTeamName()}
                              maxLength={50}
                              autoFocus
                              className="bg-gray-800 text-white px-2 py-1 rounded text-sm font-bold border border-gray-700 focus:outline-none focus:border-green-500 min-w-0 flex-1"
                            />
                            <button onClick={handleSaveTeamName} disabled={savingTeamName || !teamNameInput.trim()} className="text-xs bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold px-2.5 py-1 rounded flex-shrink-0">
                              {savingTeamName ? "..." : "Save"}
                            </button>
                            <button onClick={() => { setEditingTeamName(false); setTeamNameInput(member.team_name); }} className="text-xs text-gray-500 hover:text-white px-1 flex-shrink-0">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold truncate">{member.team_name}</span>
                            {isMe && (
                              <>
                                <span className="hidden sm:inline text-xs text-gray-500">(You)</span>
                                <button onClick={() => { setEditingTeamName(true); setTeamNameInput(member.team_name); }} className="text-gray-600 hover:text-white text-xs flex-shrink-0" title="Edit team name">✏</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getConferenceBadge(member)}
                        {isThisCommissioner && (
                          <span className="text-xs bg-green-900 text-green-400 w-5 h-5 sm:w-auto sm:h-auto sm:px-2 sm:py-0.5 rounded-full flex items-center justify-center font-bold">
                            <span className="sm:hidden">C</span>
                            <span className="hidden sm:inline">Commissioner</span>
                          </span>
                        )}
                        {isCommissioner && !isMe && !isThisCommissioner && !isDraftStarted && (
                          isConfirmingRemove ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleRemoveMember(member.user_id)} disabled={isRemoving} className="text-xs bg-red-700 hover:bg-red-600 disabled:bg-gray-700 text-white font-bold px-2 py-1 rounded">
                                {isRemoving ? "..." : "Confirm"}
                              </button>
                              <button onClick={() => setConfirmRemoveId(null)} className="text-xs bg-gray-700 hover:bg-gray-600 text-white font-bold px-2 py-1 rounded">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmRemoveId(member.user_id)} className="text-xs text-gray-600 hover:text-red-400 font-bold px-1.5 py-1 rounded hover:bg-red-950 transition-colors" title="Remove from league">✕</button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
                {spotsLeft > 0 && (
                  <div className="flex items-center gap-3 py-2.5 opacity-40">
                    <div className="w-8 h-8 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-gray-600 text-sm flex-shrink-0">+</div>
                    <span className="text-gray-600 text-sm">{spotsLeft} spot{spotsLeft > 1 ? "s" : ""} remaining</span>
                  </div>
                )}
              </div>
            </div>

            {isCommissioner && (
              <button onClick={() => router.push(`/commissioner-tools/${leagueId}`)} className="w-full bg-gray-900 hover:bg-gray-800 border border-dashed border-gray-700 rounded-xl p-5 flex items-center justify-between transition-colors">
                <div className="text-left">
                  <p className="font-bold text-white">⚙ Commissioner Tools</p>
                  <p className="text-gray-500 text-xs mt-0.5">Invite link, conferences, scoring, manual draft, email league</p>
                </div>
                <span className="text-gray-600">→</span>
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}