"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function JoinLeaguePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleJoin() {
    setLoading(true);
    setError("");

    const { data: league } = await supabase
      .from("leagues")
      .select("*")
      .eq("invite_code", code.toUpperCase().trim())
      .single();

    if (!league) {
      setError("Invalid invite code. Check the code and try again.");
      setLoading(false);
      return;
    }

    router.push(`/join/${code.toUpperCase().trim()}`);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-gray-400 hover:text-white mb-8 block"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mb-2">Join a League</h1>
        <p className="text-gray-400 mb-8">Enter the invite code from your friend.</p>

        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Enter invite code (e.g. U3R46CKG)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-gray-800 text-white p-3 rounded-lg uppercase tracking-widest"
          />
          {error && <p className="text-red-400">{error}</p>}
          <button
            onClick={handleJoin}
            disabled={loading || !code}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-3 rounded-lg"
          >
            {loading ? "Finding league..." : "Find League"}
          </button>
        </div>
      </div>
    </main>
  );
}