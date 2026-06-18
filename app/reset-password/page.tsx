"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function PFFLLogo({ size = 64 }: { size?: number }) {
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

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Supabase puts the token in the URL hash — this picks it up automatically
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValidSession(true);
      }
    });
  }, []);

  async function handleReset() {
    if (!password) { setError("Enter a new password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <PFFLLogo size={64} />
      <h1 className="text-3xl font-bold mt-4 mb-8">Set New Password</h1>

      <div className="w-full max-w-sm flex flex-col gap-4">
        {done ? (
          <div className="bg-green-900 border border-green-700 rounded-lg p-4 text-center">
            <p className="text-green-300 font-bold mb-1">Password updated!</p>
            <p className="text-green-400 text-sm">Redirecting to your dashboard...</p>
          </div>
        ) : !validSession ? (
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 text-center">
            <p className="text-yellow-300 text-sm">Waiting for reset link verification...</p>
            <p className="text-yellow-400 text-xs mt-2">Make sure you clicked the link from your email.</p>
          </div>
        ) : (
          <>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-800 text-white p-3 rounded-lg"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReset()}
              className="bg-gray-800 text-white p-3 rounded-lg"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleReset}
              disabled={loading}
              className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-3 rounded-lg"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}