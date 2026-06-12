"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";
import Nav from "../../components/Nav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LeagueEmailPage() {
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [resultMessage, setResultMessage] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
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
      setSelectedUserIds((membersData || []).map((m: any) => m.user_id));
      setLoading(false);
    }
    load();
  }, []);

  function toggleRecipient(userId: string) {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }

  function selectAll() {
    setSelectedUserIds(members.map(m => m.user_id));
  }

  function selectNone() {
    setSelectedUserIds([]);
  }

  async function handleSend() {
    if (!subject.trim() || !message.trim() || selectedUserIds.length === 0) return;
    setSending(true);
    setStatus("idle");

    try {
      const res = await fetch("/api/league-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          userId: user.id,
          subject: subject.trim(),
          message: message.trim(),
          recipientIds: selectedUserIds,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setResultMessage(`Email sent to ${data.sentTo} member${data.sentTo === 1 ? "" : "s"}.`);
        setSubject("");
        setMessage("");
      } else {
        setStatus("error");
        setResultMessage(data.error || "Failed to send email.");
      }
    } catch {
      setStatus("error");
      setResultMessage("Something went wrong. Try again.");
    }

    setSending(false);
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
        <p className="text-red-400">Only the commissioner can email the league.</p>
      </main>
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

      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push(`/commissioner-tools/${leagueId}`)}
          className="text-gray-400 hover:text-white text-sm block mb-4"
        >
          ← Back to Commissioner Tools
        </button>

        <h1 className="text-2xl font-black mb-1">Email League</h1>
        <p className="text-gray-400 text-sm mb-8">
          Send a message to members of {league.name}.
        </p>

        {status === "success" && (
          <div className="bg-green-900 border border-green-700 rounded-lg px-4 py-3 mb-6">
            <p className="text-green-400 font-bold text-sm">✓ {resultMessage}</p>
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-900 border border-red-700 rounded-lg px-4 py-3 mb-6">
            <p className="text-red-400 font-bold text-sm">{resultMessage}</p>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 flex flex-col gap-5">

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-xs uppercase tracking-wider">
                Recipients ({selectedUserIds.length}/{members.length})
              </p>
              <div className="flex gap-3">
                <button onClick={selectAll} className="text-xs text-green-400 hover:text-green-300 font-bold">
                  Select All
                </button>
                <button onClick={selectNone} className="text-xs text-gray-500 hover:text-gray-300 font-bold">
                  Select None
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {members.map(member => {
                const isSelected = selectedUserIds.includes(member.user_id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleRecipient(member.user_id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                      isSelected
                        ? "bg-green-900 text-green-300 border-green-700"
                        : "bg-gray-800 text-gray-500 border-gray-700"
                    }`}
                  >
                    {isSelected ? "✓ " : ""}{member.team_name}
                    {member.user_id === user?.id ? " (You)" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Draft starts tomorrow at 7pm!"
              maxLength={150}
              className="w-full bg-gray-800 text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500 text-sm"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message here..."
              rows={8}
              maxLength={2000}
              className="w-full bg-gray-800 text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500 text-sm resize-none"
            />
            <p className="text-gray-600 text-xs mt-1 text-right">{message.length}/2000</p>
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim() || selectedUserIds.length === 0}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors"
          >
            {sending
              ? "Sending..."
              : selectedUserIds.length === 0
                ? "Select at least one recipient"
                : `Send to ${selectedUserIds.length} Member${selectedUserIds.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </main>
  );
}