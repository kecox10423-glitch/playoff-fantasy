"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEFAULT_SETTINGS = {
  passing_yards_per_point: 20,
  passing_td: 4,
  interception: -1,
  passing_2pt: 2,
  passing_sack: 0,
  passing_300_bonus: 0,
  passing_400_bonus: 0,
  passing_500_bonus: 0,
  passing_40yd_td_bonus: 0,
  rushing_yards_per_point: 10,
  rushing_td: 6,
  rushing_attempt: 0,
  rushing_2pt: 2,
  rushing_fumble_lost: -2,
  rushing_100_bonus: 0,
  rushing_150_bonus: 0,
  rushing_200_bonus: 0,
  rushing_40yd_td_bonus: 0,
  receiving_yards_per_point: 10,
  receiving_td: 6,
  receiving_reception: 1,
  receiving_target: 0,
  receiving_2pt: 2,
  receiving_fumble_lost: -2,
  receiving_100_bonus: 0,
  receiving_150_bonus: 0,
  receiving_200_bonus: 0,
  receiving_40yd_td_bonus: 0,
  fg_0_39: 3,
  fg_40_49: 4,
  fg_50_59: 5,
  fg_60_plus: 6,
  fg_per_yard_bonus: 0,
  fg_miss_0_39: -1,
  fg_miss_40_plus: 0,
  fg_blocked: 0,
  xp_made: 1,
  xp_missed: -1,
  dst_sack: 1,
  dst_interception: 2,
  dst_fumble_recovery: 2,
  dst_td: 6,
  dst_safety: 2,
  dst_blocked_kick: 2,
  dst_return_td: 6,
  dst_pa_0: 10,
  dst_pa_1_6: 7,
  dst_pa_7_13: 4,
  dst_pa_14_20: 1,
  dst_pa_21_27: 0,
  dst_pa_28_plus: -1,
  misc_return_td: 6,
  misc_fumble_return_td: 6,
};

const SCORING_SECTIONS = [
  {
    label: "Passing",
    fields: [
      { key: "passing_yards_per_point", label: "Yards per point (e.g. 20 = 1pt per 20 yds)" },
      { key: "passing_td", label: "Touchdown" },
      { key: "interception", label: "Interception" },
      { key: "passing_2pt", label: "2-Point Conversion" },
      { key: "passing_sack", label: "Sack Taken" },
      { key: "passing_300_bonus", label: "300+ Yard Bonus" },
      { key: "passing_400_bonus", label: "400+ Yard Bonus" },
      { key: "passing_500_bonus", label: "500+ Yard Bonus" },
      { key: "passing_40yd_td_bonus", label: "40+ Yard TD Bonus" },
    ],
  },
  {
    label: "Rushing",
    fields: [
      { key: "rushing_yards_per_point", label: "Yards per point (e.g. 10 = 1pt per 10 yds)" },
      { key: "rushing_td", label: "Touchdown" },
      { key: "rushing_attempt", label: "Rush Attempt" },
      { key: "rushing_2pt", label: "2-Point Conversion" },
      { key: "rushing_fumble_lost", label: "Fumble Lost" },
      { key: "rushing_100_bonus", label: "100+ Yard Bonus" },
      { key: "rushing_150_bonus", label: "150+ Yard Bonus" },
      { key: "rushing_200_bonus", label: "200+ Yard Bonus" },
      { key: "rushing_40yd_td_bonus", label: "40+ Yard TD Bonus" },
    ],
  },
  {
    label: "Receiving",
    fields: [
      { key: "receiving_yards_per_point", label: "Yards per point (e.g. 10 = 1pt per 10 yds)" },
      { key: "receiving_td", label: "Touchdown" },
      { key: "receiving_reception", label: "Reception (PPR=1, Half=0.5, Std=0)" },
      { key: "receiving_target", label: "Target" },
      { key: "receiving_2pt", label: "2-Point Conversion" },
      { key: "receiving_fumble_lost", label: "Fumble Lost" },
      { key: "receiving_100_bonus", label: "100+ Yard Bonus" },
      { key: "receiving_150_bonus", label: "150+ Yard Bonus" },
      { key: "receiving_200_bonus", label: "200+ Yard Bonus" },
      { key: "receiving_40yd_td_bonus", label: "40+ Yard TD Bonus" },
    ],
  },
  {
    label: "Kicking",
    fields: [
      { key: "fg_0_39", label: "FG Made 0-39 Yards" },
      { key: "fg_40_49", label: "FG Made 40-49 Yards" },
      { key: "fg_50_59", label: "FG Made 50-59 Yards" },
      { key: "fg_60_plus", label: "FG Made 60+ Yards" },
      { key: "fg_per_yard_bonus", label: "Per Yard Bonus (e.g. 0.1)" },
      { key: "fg_miss_0_39", label: "FG Missed 0-39 Yards" },
      { key: "fg_miss_40_plus", label: "FG Missed 40+ Yards" },
      { key: "fg_blocked", label: "FG Blocked" },
      { key: "xp_made", label: "Extra Point Made" },
      { key: "xp_missed", label: "Extra Point Missed" },
    ],
  },
  {
    label: "Defense / Special Teams",
    fields: [
      { key: "dst_sack", label: "Sack" },
      { key: "dst_interception", label: "Interception" },
      { key: "dst_fumble_recovery", label: "Fumble Recovery" },
      { key: "dst_td", label: "Touchdown" },
      { key: "dst_safety", label: "Safety" },
      { key: "dst_blocked_kick", label: "Blocked Kick" },
      { key: "dst_return_td", label: "Return Touchdown" },
      { key: "dst_pa_0", label: "Points Allowed: 0" },
      { key: "dst_pa_1_6", label: "Points Allowed: 1-6" },
      { key: "dst_pa_7_13", label: "Points Allowed: 7-13" },
      { key: "dst_pa_14_20", label: "Points Allowed: 14-20" },
      { key: "dst_pa_21_27", label: "Points Allowed: 21-27" },
      { key: "dst_pa_28_plus", label: "Points Allowed: 28+" },
    ],
  },
  {
    label: "Miscellaneous",
    fields: [
      { key: "misc_return_td", label: "Return Touchdown (any)" },
      { key: "misc_fumble_return_td", label: "Fumble Return TD" },
    ],
  },
];

const PRESETS: { [key: string]: Partial<typeof DEFAULT_SETTINGS> } = {
  PPR: { receiving_reception: 1 },
  HALF_PPR: { receiving_reception: 0.5 },
  STANDARD: { receiving_reception: 0 },
};

export default function LeagueSettingsPage() {
  const [league, setLeague] = useState<any>(null);
  const [settings, setSettings] = useState<any>({ ...DEFAULT_SETTINGS });
  const [conferenceAName, setConferenceAName] = useState("AFC");
  const [conferenceBName, setConferenceBName] = useState("NFC");
  const [conferenceEnabled, setConferenceEnabled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingConference, setSavingConference] = useState(false);
  const [savedConference, setSavedConference] = useState(false);
  const [isCommissioner, setIsCommissioner] = useState(false);
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

      setLeague(leagueData);
      setIsCommissioner(leagueData?.commissioner_user_id === user.id);
      setConferenceEnabled(leagueData?.conference_enabled || false);
      setConferenceAName(leagueData?.conference_a_name || "AFC");
      setConferenceBName(leagueData?.conference_b_name || "NFC");

      if (leagueData?.scoring_settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...leagueData.scoring_settings });
      }

      setLoading(false);
    }
    load();
  }, []);

  function applyPreset(preset: string) {
    setSettings((prev: any) => ({ ...prev, ...PRESETS[preset] }));
  }

  function handleChange(key: string, value: string) {
    setSettings((prev: any) => ({ ...prev, [key]: parseFloat(value) || 0 }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    await supabase
      .from("leagues")
      .update({ scoring_settings: settings })
      .eq("id", leagueId);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleSaveConference() {
    setSavingConference(true);
    setSavedConference(false);

    await supabase
      .from("leagues")
      .update({
        conference_enabled: conferenceEnabled,
        conference_a_name: conferenceAName.trim() || "AFC",
        conference_b_name: conferenceBName.trim() || "NFC",
      })
      .eq("id", leagueId);

    setSavingConference(false);
    setSavedConference(true);
    setTimeout(() => setSavedConference(false), 3000);
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p>Loading settings...</p>
    </main>
  );

  if (!isCommissioner) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-red-400">Only the commissioner can edit settings.</p>
    </main>
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <button
              onClick={() => router.push(`/league/${leagueId}`)}
              className="text-gray-400 hover:text-white text-sm block mb-1"
            >
              ← Back to League
            </button>
            <h1 className="text-xl font-bold">{league?.name} — Settings</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`font-bold py-2 px-6 rounded-lg text-sm ${
              saved
                ? "bg-blue-600 text-white"
                : "bg-green-600 hover:bg-green-500 text-white"
            }`}
          >
            {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Scoring"}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Conference Settings */}
        <div className="bg-gray-900 rounded-xl p-6 mb-8 border border-gray-800">
          <h2 className="font-black text-lg mb-1 text-green-400">Conference Format</h2>
          <p className="text-gray-500 text-sm mb-5">
            Available for leagues with 8+ teams. Splits teams into two conferences with a championship matchup.
          </p>

          <div className="flex items-center justify-between mb-5">
            <p className="font-bold text-white">Enable Conferences</p>
            <button
              onClick={() => league?.num_teams >= 8 && setConferenceEnabled(!conferenceEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                conferenceEnabled ? "bg-green-600" : "bg-gray-700"
              } ${league?.num_teams < 8 ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                conferenceEnabled ? "left-7" : "left-1"
              }`} />
            </button>
          </div>

          {conferenceEnabled && (
            <div className="flex gap-3 mb-5">
              <div className="flex-1">
                <label className="block text-gray-400 text-xs mb-1">Conference A Name</label>
                <input
                  type="text"
                  value={conferenceAName}
                  onChange={(e) => setConferenceAName(e.target.value)}
                  maxLength={20}
                  className="w-full bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none focus:border-green-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-gray-400 text-xs mb-1">Conference B Name</label>
                <input
                  type="text"
                  value={conferenceBName}
                  onChange={(e) => setConferenceBName(e.target.value)}
                  maxLength={20}
                  className="w-full bg-gray-800 text-white p-2.5 rounded-lg text-sm border border-gray-700 focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleSaveConference}
            disabled={savingConference}
            className={`font-bold py-2 px-6 rounded-lg text-sm transition-colors ${
              savedConference
                ? "bg-blue-600 text-white"
                : "bg-green-600 hover:bg-green-500 text-white"
            }`}
          >
            {savingConference ? "Saving..." : savedConference ? "✓ Saved!" : "Save Conference Settings"}
          </button>
        </div>

        {/* Scoring Presets */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="font-bold mb-1">Quick Presets</h2>
          <p className="text-gray-400 text-sm mb-4">Apply a preset then customize further.</p>
          <div className="flex gap-3">
            {["PPR", "HALF_PPR", "STANDARD"].map(preset => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg text-sm"
              >
                {preset === "HALF_PPR" ? "Half PPR" : preset === "STANDARD" ? "Standard" : "PPR"}
              </button>
            ))}
          </div>
        </div>

        {/* Scoring Sections */}
        {SCORING_SECTIONS.map(section => (
          <div key={section.label} className="mb-8">
            <h2 className="font-black text-lg mb-4 text-green-400 border-b border-gray-800 pb-2">
              {section.label}
            </h2>
            <div className="flex flex-col gap-1">
              {section.fields.map(field => (
                <div
                  key={field.key}
                  className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 px-4 py-3 rounded-lg"
                >
                  <label className="text-sm text-gray-300">{field.label}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings[field.key] ?? 0}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="bg-gray-800 text-white text-right px-3 py-1 rounded w-24 text-sm border border-gray-700 focus:outline-none focus:border-green-500"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Save Button Bottom */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full font-bold py-4 rounded-lg text-lg ${
            saved
              ? "bg-blue-600 text-white"
              : "bg-green-600 hover:bg-green-500 text-white"
          }`}
        >
          {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Scoring Settings"}
        </button>
      </div>
    </main>
  );
}