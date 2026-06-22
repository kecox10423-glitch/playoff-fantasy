"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const LAUNCH_DATE = new Date("2027-01-05T06:00:00-05:00");

function PFFLLogo({ size = 80 }: { size?: number }) {
  return (
    <img
      src="/apple-touch-icon.png"
      alt="PFFL Logo"
      width={size}
      height={size}
      style={{ borderRadius: "20%" }}
    />
  );
}

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    function update() {
      const now = new Date().getTime();
      const distance = target.getTime() - now;

      if (distance <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

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
          <p className="text-2xl sm:text-4xl font-black text-green-400 tabular-nums">
            {unit.value.toString().padStart(2, "0")}
          </p>
          <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{unit.label}</p>
        </div>
      ))}
    </div>
  );
}

function EmailSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
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
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit(e as any)}
          className="flex-1 bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-green-500"
        />
        <button
          onClick={(e) => handleSubmit(e as any)}
          disabled={status === "loading"}
          className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold px-6 py-3 rounded-lg text-sm whitespace-nowrap transition-colors"
        >
          {status === "loading" ? "Joining..." : "Notify Me"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-red-400 text-xs text-center">Something went wrong. Try again.</p>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <PFFLLogo size={40} />
          <span className="font-bold text-lg tracking-wide">Playoff Fantasy</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="text-gray-400 hover:text-white text-sm">Log In</Link>
          <Link href="/signup" className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-lg">Sign Up Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-8 py-20 max-w-4xl mx-auto">
        <PFFLLogo size={120} />
        <h1 className="text-5xl sm:text-6xl font-black mt-8 mb-4 leading-tight">
          Playoff Fantasy<br />
          <span className="text-green-400">with Elimination</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl">
          Draft NFL playoff players once. When their team loses, they stop scoring.
          Last roster standing wins.
        </p>

        {/* Countdown */}
        <div className="mb-10 w-full">
          <p className="text-gray-500 text-sm uppercase tracking-widest mb-4">Leagues Open In</p>
          <CountdownTimer />
        </div>

        {/* Email Signup */}
        <div className="mb-10 w-full">
          <p className="text-gray-400 text-sm mb-3">Get notified the moment leagues go live</p>
          <EmailSignup />
        </div>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/signup" className="bg-green-600 hover:bg-green-500 text-white font-black text-lg px-10 py-4 rounded-xl">
            Create Your League
          </Link>
          <Link href="/login" className="bg-gray-800 hover:bg-gray-700 text-white font-bold text-lg px-10 py-4 rounded-xl">
            Log In
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-900 py-20 px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-16">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Create a League", desc: "Invite 5-11 friends to your private league. Free to play." },
              { step: "2", title: "Snake Draft", desc: "Draft NFL playoff players before Wild Card weekend. One shot." },
              { step: "3", title: "Survive", desc: "Your entire roster scores every week. When NFL teams lose, those players go silent." },
              { step: "4", title: "Win", desc: "Highest cumulative score after the Super Bowl takes the glory." },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-xl font-black mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Strategic tension */}
      <section className="py-20 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-4">The Strategic Tension</h2>
          <p className="text-gray-400 mb-12">Every pick is a risk/reward decision.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl p-8 border border-red-800">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-black mb-2 text-red-400">High Risk, High Ceiling</h3>
              <p className="text-gray-400 text-sm">Draft elite talent from a lower-seeded team. One bad week and they're gone — but if their team runs the table, you're unstoppable.</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-8 border border-green-800">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-black mb-2 text-green-400">Safe Floor</h3>
              <p className="text-gray-400 text-sm">Draft solid players from a top-seeded team. Guaranteed weeks of production, but a lower ceiling if they don't go all the way.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-900 py-20 px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-16">Everything You Need</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: "🏈", title: "Live Snake Draft", desc: "Real-time draft with 60-second timer, smack talk chat, and auto-pick." },
              { icon: "💀", title: "Elimination Mechanic", desc: "When NFL teams lose, their players stop scoring. Watch your roster shrink." },
              { icon: "🏆", title: "Best Ball Format", desc: "Your entire roster scores every week. No lineup decisions. Pure draft skill." },
              { icon: "📊", title: "Live Standings", desc: "Cumulative scores update after every playoff week automatically." },
              { icon: "👥", title: "Private Leagues", desc: "Play with your crew. 6-12 teams. Free forever." },
              { icon: "⚡", title: "5-Day Window", desc: "Draft opens Jan 5. Closes before Wild Card weekend. Days of madness." },
            ].map(item => (
              <div key={item.title} className="flex gap-4">
                <div className="text-3xl">{item.icon}</div>
                <div>
                  <h3 className="font-bold mb-1">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-8 text-center">
        <h2 className="text-4xl font-black mb-4">Ready to Play?</h2>
        <p className="text-gray-400 mb-8">Free to play. No credit card. Just bring your friends.</p>
        <Link href="/signup" className="bg-green-600 hover:bg-green-500 text-white font-black text-xl px-12 py-5 rounded-xl inline-block">
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