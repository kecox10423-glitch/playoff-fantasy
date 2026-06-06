import Link from "next/link";

function PFFLLogo({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Shield shape */}
      <path
        d="M50 5 L90 20 L90 55 Q90 80 50 95 Q10 80 10 55 L10 20 Z"
        fill="#111827"
        stroke="#22c55e"
        strokeWidth="3"
      />
      {/* Inner shield */}
      <path
        d="M50 12 L83 25 L83 54 Q83 75 50 88 Q17 75 17 54 L17 25 Z"
        fill="#1f2937"
      />
      {/* Football laces */}
      <ellipse cx="50" cy="50" rx="20" ry="13" fill="none" stroke="#22c55e" strokeWidth="2"/>
      <line x1="50" y1="37" x2="50" y2="63" stroke="#22c55e" strokeWidth="1.5"/>
      <line x1="45" y1="44" x2="55" y2="44" stroke="#22c55e" strokeWidth="1.5"/>
      <line x1="44" y1="50" x2="56" y2="50" stroke="#22c55e" strokeWidth="1.5"/>
      <line x1="45" y1="56" x2="55" y2="56" stroke="#22c55e" strokeWidth="1.5"/>
      {/* PFFL text */}
      <text x="50" y="78" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="bold" fontFamily="Arial">PFFL</text>
    </svg>
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
      <section className="flex flex-col items-center text-center px-8 py-24 max-w-4xl mx-auto">
        <PFFLLogo size={120} />
        <h1 className="text-6xl font-black mt-8 mb-4 leading-tight">
          Playoff Fantasy<br />
          <span className="text-green-400">with Elimination</span>
        </h1>
        <p className="text-xl text-gray-400 mb-4 max-w-2xl">
          Draft NFL playoff players once. When their team loses, they stop scoring. 
          Last roster standing wins.
        </p>
        <p className="text-gray-500 mb-10">
          Do you draft <span className="text-white font-bold">Josh Allen</span> (elite QB, risky 7 seed) or <span className="text-white font-bold">Bo Nix</span> (safe 1 seed)? That's the game.
        </p>
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
              <h3 className="text-xl font-black mb-2 text-red-400">High Risk</h3>
              <p className="font-bold text-lg mb-1">Josh Allen</p>
              <p className="text-gray-400 text-sm">Elite QB · 7th Seed Bills</p>
              <p className="text-gray-500 text-sm mt-3">One bad game and he's gone. But if Buffalo runs the table...</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-8 border border-green-800">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-black mb-2 text-green-400">Safe Floor</h3>
              <p className="font-bold text-lg mb-1">Bo Nix</p>
              <p className="text-gray-400 text-sm">Solid QB · 1st Seed Broncos</p>
              <p className="text-gray-500 text-sm mt-3">Guaranteed Week 2. Likely Week 3. Safe but lower ceiling.</p>
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
              { icon: "🏈", title: "Live Snake Draft", desc: "Real-time draft with 90-second timer, smack talk chat, and auto-pick." },
              { icon: "💀", title: "Elimination Mechanic", desc: "When NFL teams lose, their players stop scoring. Watch your roster shrink." },
              { icon: "🏆", title: "Best Ball Format", desc: "Your entire roster scores every week. No lineup decisions. Pure draft skill." },
              { icon: "📊", title: "Live Standings", desc: "Cumulative scores update after every playoff week automatically." },
              { icon: "👥", title: "Private Leagues", desc: "Play with your crew. 6-12 teams. Free forever." },
              { icon: "⚡", title: "5-Day Window", desc: "Draft opens Jan 5. Closes Jan 10 before Wild Card. 5 days of madness." },
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
        <p>© 2027 Playoff Fantasy. All rights reserved.</p>
      </footer>

    </main>
  );
}