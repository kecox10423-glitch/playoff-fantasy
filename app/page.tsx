"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const LAUNCH_DATE = new Date("2027-01-05T06:00:00-05:00");

function PFFLLogo({ size = 80 }: { size?: number }) {
  return (
    <img src="/apple-touch-icon.png" alt="PFFL Logo" width={size} height={size} style={{ borderRadius: "20%" }} />
  );
}

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    function update() {
      const now = new Date().getTime();
      const distance = target.getTime() - now;
      if (distance <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [target]);
  return timeLeft;
}

function CountdownTimer() {
  const { days, hours, minutes, seconds } = useCountdown(LAUNCH_DATE);
  const units = [
    { label: "Days", value: days },
    { label: "Hours", value: hours },
    { label: "Minutes", value: minutes },
    { label: "Seconds", value: seconds },
  ];
  return (
    <div className="flex gap-3 sm:gap-4 justify-center">
      {units.map(unit => (
        <div key={unit.label} className="bg-gray-800 rounded-xl px-4 py-3 sm:px-6 sm:py-4 min-w-[70px] sm:min-w-[90px] text-center border border-gray-700">
          <p className="text-2xl sm:text-4xl font-black text-green-400 tabular-nums">{unit.value.toString().padStart(2, "0")}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{unit.label}</p>
        </div>
      ))}
    </div>
  );
}

function EmailSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit() {
    if (!email.includes("@")) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) { setStatus("success"); setEmail(""); }
      else setStatus("error");
    } catch { setStatus("error"); }
  }

  if (status === "success") {
    return (
      <div className="bg-green-900 border border-green-700 rounded-xl px-6 py-4 text-center max-w-md mx-auto">
        <p className="text-green-400 font-bold text-lg">✓ You're on the list!</p>
        <p className="text-gray-400 text-sm mt-1">We'll email you the moment leagues open on January 5.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-w-md mx-auto w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="flex-1 bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-green-500"
        />
        <button
          onClick={handleSubmit}
          disabled={status === "loading"}
          className="bg-gradient-to-b from-green-500 to-green-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-green-900/40 hover:shadow-green-900/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 whitespace-nowrap disabled:opacity-50 disabled:translate-y-0"
        >
          {status === "loading" ? "Joining..." : "Notify Me"}
        </button>
      </div>
      {status === "error" && <p className="text-red-400 text-xs text-center">Something went wrong. Try again.</p>}
    </div>
  );
}

const FAQ_ITEMS = [
  { q: "What happens if my player gets injured?", a: "Injuries count as part of the game. There are no replacements or waivers — it's draft and hold. That's the risk/reward." },
  { q: "What if all my players are eliminated?", a: "It's brutal, but possible. Your score stops increasing but you stay in the league. The winner is whoever has the most cumulative points after the Super Bowl." },
  { q: "What are the tiebreaker rules?", a: "Ties are broken by: (1) most active players remaining after the Super Bowl, (2) highest single-week score, (3) coin flip." },
  { q: "Can I join multiple leagues?", a: "Yes. You can be in as many leagues as you want, with different groups of friends." },
  { q: "Can I trade players?", a: "No. This is a best-ball format — draft once, hold your roster all the way through the Super Bowl. No trades, no waivers." },
  { q: "Do bye-week players score points?", a: "Only the #1 seed in each conference has a bye in Wild Card week. Their players score 0 points Week 1, but they're guaranteed to play Week 2 if their team advances." },
  { q: "When do scores update?", a: "Scores are calculated and updated each week after all playoff games are final. You'll see standings refresh automatically." },
  { q: "Is it free to play?", a: "The platform is completely free. Your group can set up your own buy-in, prize structure, or just play for bragging rights — that's between you and your league." },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="max-w-3xl mx-auto">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="border-b border-gray-800">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left px-4 py-5 flex justify-between items-center gap-4 hover:text-white transition-colors"
          >
            <span className="font-bold text-gray-200">{item.q}</span>
            <span className="text-gray-500 flex-shrink-0 text-lg">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && (
            <p className="px-4 pb-5 text-gray-400 text-sm leading-relaxed">{item.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-4 border-b border-gray-700 bg-gray-900/80 backdrop-blur-md sticky top-0 z-50 shadow-[0_1px_0_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3">
          <PFFLLogo size={40} />
          <span className="font-bold text-lg tracking-tight">Playoff Fantasy</span>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/login" className="text-gray-400 hover:text-white text-sm transition-colors">Log In</Link>
          <Link href="/signup" className="bg-gradient-to-b from-green-500 to-green-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-md shadow-green-900/40 hover:-translate-y-0.5 hover:shadow-green-900/60 transition-all duration-150">
            Sign Up Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-8 pt-20 pb-12 max-w-4xl mx-auto">
        <PFFLLogo size={100} />
        <h1 className="text-5xl sm:text-7xl font-black mt-6 mb-4 leading-none tracking-tight">
          Playoff Fantasy<br />
          <span className="text-green-400">with Elimination</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed">
          Draft NFL playoff players once. When their team loses, they stop scoring.
          Last roster standing wins.
        </p>

        {/* Countdown */}
        <div className="mb-10 w-full">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-4">Leagues Open In</p>
          <CountdownTimer />
        </div>

        {/* Email Signup */}
        <div className="mb-10 w-full">
          <p className="text-gray-400 text-sm mb-3">Get notified the moment leagues go live</p>
          <EmailSignup />
        </div>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/signup" className="bg-gradient-to-b from-green-500 to-green-700 text-white font-black text-lg px-10 py-4 rounded-xl shadow-lg shadow-green-900/40 hover:shadow-green-900/60 hover:-translate-y-0.5 transition-all duration-150">
            Create Your League
          </Link>
          <Link href="/login" className="bg-gray-800 hover:bg-gray-700 text-white font-bold text-lg px-10 py-4 rounded-xl border border-gray-600 hover:border-gray-500 transition-all duration-150">
            Log In
          </Link>
        </div>
      </section>

      {/* App Preview Screenshot */}
      <section className="px-4 sm:px-8 pb-20 max-w-5xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden border border-gray-700 shadow-2xl shadow-black/60">
          <div className="bg-gray-800 px-4 py-3 flex items-center gap-2 border-b border-gray-700">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <div className="mx-auto bg-gray-700 rounded px-4 py-1 text-xs text-gray-400">
              playoff-fantasy.com
            </div>
          </div>
          <img
            src="/app-preview.png"
            alt="Playoff Fantasy standings page"
            className="w-full block"
          />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-950 to-transparent" />
        </div>
        <p className="text-center text-gray-500 text-sm mt-4">Live standings — updated automatically after every playoff week</p>
      </section>

      {/* How it works */}
      <section className="bg-gray-900/60 border-y border-gray-800 py-20 px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-16 tracking-tight">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Create a League", desc: "Invite 5-11 friends to your private league. Free to play." },
              { step: "2", title: "Snake Draft", desc: "Draft NFL playoff players before Wild Card weekend. One shot to build your roster." },
              { step: "3", title: "Survive", desc: "Your entire roster scores every week. When NFL teams lose, those players go silent." },
              { step: "4", title: "Win", desc: "Highest cumulative score after the Super Bowl takes the glory." },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-gradient-to-b from-green-500 to-green-700 rounded-full flex items-center justify-center text-xl font-black mx-auto mb-4 shadow-lg shadow-green-900/40">
                  {item.step}
                </div>
                <h3 className="font-bold text-lg mb-2 tracking-tight">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Strategic tension */}
      <section className="py-20 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight">The Strategic Tension</h2>
          <p className="text-gray-400 mb-12">Every pick is a risk/reward decision.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-2xl p-8 border border-red-900/50 shadow-xl">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-black mb-2 text-red-400 tracking-tight">High Risk, High Ceiling</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Draft elite talent from a lower-seeded team. One bad week and they're gone — but if their team runs the table, you're unstoppable.</p>
            </div>
            <div className="bg-gray-900 rounded-2xl p-8 border border-green-900/50 shadow-xl">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-black mb-2 text-green-400 tracking-tight">Safe Floor</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Draft solid players from a top-seeded team. Guaranteed weeks of production, but a lower ceiling if they don't go all the way.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Everything You Need */}
      <section className="bg-gray-900/60 border-y border-gray-800 py-20 px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-16 tracking-tight">Everything You Need</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: "🏈", title: "Live Snake Draft", desc: "Real-time draft with 60-second timer, smack talk chat, and auto-pick for offline players." },
              { icon: "💀", title: "Elimination Mechanic", desc: "When NFL teams lose, their players stop scoring. Watch your roster shrink week by week." },
              { icon: "🏆", title: "Best Ball Format", desc: "Your entire roster scores every week. No lineup decisions. Pure draft skill." },
              { icon: "📊", title: "Live Standings", desc: "Cumulative scores update after every playoff week automatically." },
              { icon: "👥", title: "Private Leagues", desc: "Play with your crew. 6-12 teams. Free forever." },
              { icon: "⚡", title: "5-Day Draft Window", desc: "Leagues open Jan 5. Drafts must complete before Wild Card weekend. Five days of madness." },
            ].map(item => (
              <div key={item.title} className="flex gap-4">
                <div className="text-3xl flex-shrink-0">{item.icon}</div>
                <div>
                  <h3 className="font-bold mb-1 tracking-tight">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-12 tracking-tight">Frequently Asked Questions</h2>
          <FAQSection />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900/60 border-y border-gray-800 py-20 px-8 text-center">
        <h2 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight">Ready to Play?</h2>
        <p className="text-gray-400 mb-8 text-lg">Free to play. No credit card. Just bring your friends.</p>
        <Link href="/signup" className="bg-gradient-to-b from-green-500 to-green-700 text-white font-black text-xl px-12 py-5 rounded-xl shadow-lg shadow-green-900/40 hover:shadow-green-900/60 hover:-translate-y-0.5 transition-all duration-150 inline-block">
          Create Your League Now
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-8 py-6 text-center text-gray-600 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <PFFLLogo size={24} />
          <span>Playoff Fantasy Football</span>
        </div>
        <p>© 2026 Playoff Fantasy. All rights reserved.</p>
      </footer>

    </main>
  );
}