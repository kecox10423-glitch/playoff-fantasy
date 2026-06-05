"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
        <h2 className="text-2xl font-bold mb-4">Check your email!</h2>
        <p className="text-gray-400">We sent you a confirmation link.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-8">Create Account</h1>
      <div className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-gray-800 text-white p-3 rounded-lg"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-gray-800 text-white p-3 rounded-lg"
        />
        {error && <p className="text-red-400">{error}</p>}
        <button
          onClick={handleSignUp}
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg"
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
        <p className="text-gray-400 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-green-400">Log in</Link>
        </p>
      </div>
    </main>
  );
}