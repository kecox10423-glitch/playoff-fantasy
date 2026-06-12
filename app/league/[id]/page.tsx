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

export default function LeaguePage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedColor, setSelectedColor] = useState("green");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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

      setLeague(leagueData);
      setMembers(membersData || []);

      // Pre-fill current user's color
      const myMember = (membersData || []).find((m: any) => m.user_id === user.id);
      if (myMember?.avatar_color) setSelectedColor(myMember.avatar_color);

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

      {/* Avatar Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-700">
            <h2 className="font-black text-lg mb-4">Edit Your Avatar</h2>

            {/* Preview */}
            <div className="flex justify-center mb-5">
              {avatarPreview ? (
                <img src={avatarPreview} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <Avatar member={{ ...myMember, avatar_color: selectedColor, avatar_url: null }} size="lg" />
              )}
            </div>

            {/* Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-lg text-sm mb-4"
            >
              📁 Upload Image
            </button>

            {/* Color picker */}
            <p className="text-gray-400 text-xs mb-2">Default color (if no image):</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color.name}
                  onClick={() => { setSelectedColor(color.name); setAvatarPreview(null); setAvatarFile(null); }}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColor === color.name ? "border-white scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveAvatar}
                disabled={uploadingAvatar}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-2.5 rounded-lg text-sm"
              >
                {uploadingAvatar ? "Saving..." : "Save"}
              </button>
              {myMember?.avatar_url && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="bg-red-900 hover:bg-red-800 text-red-300 font-bold py-2.5 px-4 rounded-lg text-sm"
                >
                  Remove
                </button>
              )}
              <button
                onClick={() => { setShowAvatarModal(false); setAvatarPreview(null); setAvatarFile(null); }}
                className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* League Header Card */}
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
              draftComplete
                ? "bg-green-900 text-green-400"
                : "bg-yellow-900 text-yellow-400"
            }`}>
              {draftComplete ? "Draft Complete" : "Draft Pending"}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{members.length}/{league.num_teams}</p>
              <p className="text-xs text-gray-500 mt-1">Teams Joined</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-green-400">{spotsLeft}</p>
              <p className="text-xs text-gray-500 mt-1">Spots Left</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-white">4</p>
              <p className="text-xs text-gray-500 mt-1">Playoff Weeks</p>
            </div>
          </div>

          {/* Draft Room Button */}
          <button
            onClick={openDraftRoom}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-lg text-lg transition-colors"
          >
            🏈 Enter Draft Room
          </button>
        </div>

        {/* Teams List */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <h2 className="font-bold mb-4 text-gray-300 uppercase text-xs tracking-wider">
            Teams ({members.length}/{league.num_teams})
          </h2>
          <div className="flex flex-col gap-1">
            {members.map((member, i) => (
              <div key={member.id} className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0">
                <div className="relative flex-shrink-0">
                  <Avatar member={member} size="md" />
                  {member.user_id === user?.id && (
                    <button
                      onClick={() => setShowAvatarModal(true)}
                      className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-600 hover:bg-gray-500 rounded-full flex items-center justify-center text-xs"
                      title="Edit avatar"
                    >
                      ✏
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold">{member.team_name}</span>
                  {member.user_id === user?.id && (
                    <span className="text-xs text-gray-500 ml-2">(You)</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getConferenceBadge(member)}
                  {member.user_id === league.commissioner_user_id && (
                    <span className="text-xs bg-green-900 text-green-400 px-2 py-0.5 rounded-full">Commissioner</span>
                  )}
                  <span className="text-xs text-gray-600">#{i + 1}</span>
                </div>
              </div>
            ))}
            {spotsLeft > 0 && (
              <div className="flex items-center gap-3 py-2.5 opacity-40">
                <div className="w-8 h-8 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-gray-600 text-sm flex-shrink-0">+</div>
                <span className="text-gray-600 text-sm">{spotsLeft} spot{spotsLeft > 1 ? "s" : ""} remaining</span>
              </div>
            )}
          </div>
        </div>

        {/* Commissioner Tools Link */}
        {isCommissioner && (
          <button
            onClick={() => router.push(`/commissioner-tools/${leagueId}`)}
            className="w-full bg-gray-900 hover:bg-gray-800 border border-dashed border-gray-700 rounded-xl p-5 flex items-center justify-between transition-colors"
          >
            <div className="text-left">
              <p className="font-bold text-white">⚙ Commissioner Tools</p>
              <p className="text-gray-500 text-xs mt-0.5">Invite link, conferences, scoring, manual draft, email league</p>
            </div>
            <span className="text-gray-600">→</span>
          </button>
        )}
      </div>
    </main>
  );
}