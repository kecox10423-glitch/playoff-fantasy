"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
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

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Enter your email address above first.");
      return;
    }
    setResetLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
    setResetLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <PFFLLogo size={64} />
      <h1 className="text-3xl font-bold mt-4 mb-8">
        {forgotMode ? "Reset Password" : "Log In"}
      </h1>

      <div className="w-full max-w-sm flex flex-col gap-4">
        {resetSent ? (
          <div className="bg-green-900 border border-green-700 rounded-lg p-4 text-center">
            <p className="text-green-300 font-bold mb-1">Check your email</p>
            <p className="text-green-400 text-sm">We sent a password reset link to <strong>{email}</strong>.</p>
            <button
              onClick={() => { setForgotMode(false); setResetSent(false); }}
              className="mt-4 text-green-400 text-sm underline"
            >
              Back to log in
            </button>
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-800 text-white p-3 rounded-lg"
            />
            {!forgotMode && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="bg-gray-800 text-white p-3 rounded-lg"
              />
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {forgotMode ? (
              <>
                <button
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-3 rounded-lg"
                >
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
                <button
                  onClick={() => { setForgotMode(false); setError(""); }}
                  className="text-gray-400 text-sm text-center hover:text-white"
                >
                  Back to log in
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-3 rounded-lg"
                >
                  {loading ? "Logging in..." : "Log In"}
                </button>
                <div className="flex justify-between items-center">
                  <p className="text-gray-400 text-sm">
                    No account?{" "}
                    <Link href="/signup" className="text-green-400">Sign up</Link>
                  </p>
                  <button
                    onClick={() => { setForgotMode(true); setError(""); }}
                    className="text-gray-500 text-sm hover:text-gray-300"
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}