"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";
import Nav from "../../components/Nav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Supabase returns timestamps without a timezone indicator (e.g. "2027-01-09 02:30:00"),
// which JS interprets as LOCAL time instead of UTC. This forces correct UTC parsing.
function parseUTCTimestamp(raw: string): Date {
  if (raw.endsWith("Z") || raw.includes("+")) return new Date(raw);
  return new Date(raw.replace(" ", "T") + "Z");
}

export default function CommissionerToolsPage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [assigningConferences, setAssigningConferences] = useState(false);
  const [manualConferences, setManualConferences] = useState<{ [userId: string]: string }>({});
  const [savingConferences, setSavingConferences] = useState(false);
  const [conferencesSaved, setConferencesSaved] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [draftHour, setDraftHour] = useState("7");
  const [draftMinute, setDraftMinute] = useState("00");
  const [draftAmPm, setDraftAmPm] = useState("PM");
  const [savingDraftTime, setSavingDraftTime] = useState(false);
  const [draftTimeSaved, setDraftTimeSaved] = useState(false);
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

      if (leagueData?.draft_time) {
        const d = parseUTCTimestamp(leagueData.draft_time);
        // Date input value (YYYY-MM-DD) in local time
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        setDraftDate(`${yyyy}-${mm}-${dd}`);

        let hours = d.getHours();
        const minutes = d.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;

        setDraftHour(String(hours));
        setDraftMinute(minutes >= 30 ? "30" : "00");
        setDraftAmPm(ampm);
      }

      const existing: { [userId: string]: string } = {};
      (membersData || []).forEach((m: any) => {
        if (m.conference) existing[m.user_id] = m.conference;
      });
      setManualConferences(existing);

      setLoading(false);
    }
    load();
  }, []);

  function copyInvite() {
    const inviteLink = `${window.location.origin}/join/${league.invite_code}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function randomlyAssignConferences() {
    setAssigningConferences(true);
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);

    const updates: { [userId: string]: string } = {};
    shuffled.forEach((m, i) => {
      updates[m.user_id] = i < half ? "A" : "B";
    });

    for (const [userId, conference] of Object.entries(updates)) {
      await supabase
        .from("league_members")
        .update({ conference })
        .eq("league_id", leagueId)
        .eq("user_id", userId);
    }

    setManualConferences(updates);
    setMembers(prev => prev.map(m => ({ ...m, conference: updates[m.user_id] })));
    setAssigningConferences(false);
    setConferencesSaved(true);
    setTimeout(() => setConferencesSaved(false), 3000);
  }

  async function saveManualConferences() {
    setSavingConferences(true);
    for (const [userId, conference] of Object.entries(manualConferences)) {
      await supabase
        .from("league_members")
        .update({ conference })
        .eq("league_id", leagueId)
        .eq("user_id", userId);
    }
    setMembers(prev => prev.map(m => ({
      ...m,
      conference: manualConferences[m.user_id] || m.conference
    })));
    setSavingConferences(false);
    setConferencesSaved(true);
    setTimeout(() => setConferencesSaved(false), 3000);
  }

  async function saveDraftTime() {
    if (!draftDate) return;
    setSavingDraftTime(true);

    let hour24 = parseInt(draftHour, 10);
    if (draftAmPm === "PM" && hour24 !== 12) hour24 += 12;
    if (draftAmPm === "AM" && hour24 === 12) hour24 = 0;

    const [year, month, day] = draftDate.split("-").map(Number);
    const localDate = new Date(year, month - 1, day, hour24, parseInt(draftMinute, 10), 0);
    const isoValue = localDate.toISOString();

    await supabase
      .from("leagues")
      .update({ draft_time: isoValue })
      .eq("id", leagueId);

    setLeague((prev: any) => ({ ...prev, draft_time: isoValue }));
    setSavingDraftTime(false);
    setDraftTimeSaved(true);
    setTimeout(() => setDraftTimeSaved(false), 3000);
  }

  async function clearDraftTime() {
    setSavingDraftTime(true);
    await supabase
      .from("leagues")
      .update({ draft_time: null })
      .eq("id", leagueId);
    setLeague((prev: any) => ({ ...prev, draft_time: null }));
    setDraftDate("");
    setDraftHour("7");
    setDraftMinute("00");
    setDraftAmPm("PM");
    setSavingDraftTime(false);
  }

  function sendDraftReminder() {
    if (!league.draft_time) return;
    const draftDateObj = parseUTCTimestamp(league.draft_time);
    const formatted = draftDateObj.toLocaleString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const subject = `Draft Reminder: ${league.name}`;
    const message = `Hey team!\n\nJust a reminder that our draft is scheduled for:\n\n${formatted} (your local time)\n\nMake sure you're ready to go — head to the draft room a few minutes early to check in. See you there!\n\n— ${league.name}`;

    const queryParams = new URLSearchParams({ subject, message });
    router.push(`/league-email/${leagueId}?${queryParams.toString()}`);
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

  if (!isCommissioner) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-red-400">Only the commissioner can access these tools.</p>
      </main>
    );
  }

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/join/${league.invite_code}` : "";
  const conferenceEnabled = league.conference_enabled;
  const confAName = league.conference_a_name || "AFC";
  const confBName = league.conference_b_name || "NFC";
  const currentDraftTime = league.draft_time ? parseUTCTimestamp(league.draft_time) : null;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Nav
        leagueId={leagueId}
        leagueName={league.name}
        isCommissioner={isCommissioner}
        activePage="settings"
      />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push(`/league/${leagueId}`)}
          className="text-gray-400 hover:text-white text-sm block mb-4"
        >
          ← Back to League
        </button>

        <h1 className="text-2xl font-black mb-1">Commissioner Tools</h1>
        <p className="text-gray-400 text-sm mb-8">{league.name}</p>

        {/* Invite */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <p className="font-bold text-white mb-3">Invite Link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none min-w-0"
            />
            <button
              onClick={copyInvite}
              className={`font-bold py-2.5 px-5 rounded-lg text-sm transition-colors flex-shrink-0 ${
                copied ? "bg-blue-600 text-white" : "bg-green-600 hover:bg-green-500 text-white"
              }`}
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-1.5">
            Invite code: <span className="font-mono text-gray-400">{league.invite_code}</span>
          </p>
        </div>

        {/* Schedule Draft */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <p className="font-bold text-white mb-1">Schedule Draft</p>
          <p className="text-gray-400 text-xs mb-4">
            Set a date and time for your draft. Everyone sees this in their own local time, and a countdown will show in the draft room.
          </p>

          {currentDraftTime && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 mb-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Currently Scheduled</p>
              <p className="text-white font-bold">
                {currentDraftTime.toLocaleString([], { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="flex-1 bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none focus:border-green-500 min-w-0"
            />
            <div className="flex gap-2">
              <select
                value={draftHour}
                onChange={(e) => setDraftHour(e.target.value)}
                className="bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none focus:border-green-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <select
                value={draftMinute}
                onChange={(e) => setDraftMinute(e.target.value)}
                className="bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none focus:border-green-500"
              >
                <option value="00">:00</option>
                <option value="30">:30</option>
              </select>
              <select
                value={draftAmPm}
                onChange={(e) => setDraftAmPm(e.target.value)}
                className="bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none focus:border-green-500"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveDraftTime}
              disabled={savingDraftTime || !draftDate}
              className={`flex-1 font-bold py-2.5 rounded-lg text-sm transition-colors ${
                draftTimeSaved
                  ? "bg-blue-600 text-white"
                  : "bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white"
              }`}
            >
              {savingDraftTime ? "Saving..." : draftTimeSaved ? "✓ Saved!" : "Save Draft Time"}
            </button>
            {currentDraftTime && (
              <button
                onClick={clearDraftTime}
                disabled={savingDraftTime}
                className="bg-red-900 hover:bg-red-800 text-red-300 font-bold py-2.5 px-4 rounded-lg text-sm"
              >
                Clear
              </button>
            )}
          </div>

          {currentDraftTime && (
            <button
              onClick={sendDraftReminder}
              className="w-full mt-3 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
            >
              ✉ Send Draft Reminder Email
            </button>
          )}
        </div>

        {/* Conference Assignment */}
        {conferenceEnabled && (
          <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
            <p className="font-bold text-white mb-1">Conference Assignment</p>
            <p className="text-gray-400 text-xs mb-4">
              Randomly assign teams to {confAName} and {confBName}, or set manually.
            </p>

            <button
              onClick={randomlyAssignConferences}
              disabled={assigningConferences}
              className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-2 px-5 rounded-lg text-sm mb-4 transition-colors"
            >
              {assigningConferences ? "Assigning..." : "🎲 Randomly Assign Conferences"}
            </button>

            <p className="text-gray-500 text-xs mb-3">Or assign manually:</p>
            <div className="flex flex-col gap-2">
              {members.map(member => (
                <div key={member.user_id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{member.team_name}</span>
                  <select
                    value={manualConferences[member.user_id] || ""}
                    onChange={(e) => setManualConferences(prev => ({
                      ...prev,
                      [member.user_id]: e.target.value
                    }))}
                    className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded-lg border border-gray-600 focus:outline-none focus:border-green-500"
                  >
                    <option value="">Unassigned</option>
                    <option value="A">{confAName}</option>
                    <option value="B">{confBName}</option>
                  </select>
                </div>
              ))}
            </div>

            <button
              onClick={saveManualConferences}
              disabled={savingConferences}
              className={`mt-4 w-full font-bold py-2 rounded-lg text-sm transition-colors ${
                conferencesSaved
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
            >
              {savingConferences ? "Saving..." : conferencesSaved ? "✓ Saved!" : "Save Conference Assignments"}
            </button>
          </div>
        )}

        {/* Links to other tools */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          <button
            onClick={() => router.push(`/manual-draft/${leagueId}`)}
            className="w-full text-left px-6 py-4 hover:bg-gray-800 transition-colors flex items-center justify-between"
          >
            <div>
              <p className="font-bold text-white">Manual Draft Upload</p>
              <p className="text-gray-500 text-xs mt-0.5">Enter draft results if your league drafted offline</p>
            </div>
            <span className="text-gray-600">→</span>
          </button>

          <button
            onClick={() => router.push(`/league-settings/${leagueId}`)}
            className="w-full text-left px-6 py-4 hover:bg-gray-800 transition-colors flex items-center justify-between"
          >
            <div>
              <p className="font-bold text-white">Scoring Settings</p>
              <p className="text-gray-500 text-xs mt-0.5">Customize point values and conference names</p>
            </div>
            <span className="text-gray-600">→</span>
          </button>

          <button
            onClick={() => router.push(`/league-email/${leagueId}`)}
            className="w-full text-left px-6 py-4 hover:bg-gray-800 transition-colors flex items-center justify-between"
          >
            <div>
              <p className="font-bold text-white">✉ Email League</p>
              <p className="text-gray-500 text-xs mt-0.5">Send a message to your league members</p>
            </div>
            <span className="text-gray-600">→</span>
          </button>
        </div>
      </div>
    </main>
  );
}