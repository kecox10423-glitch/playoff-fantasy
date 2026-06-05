import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-4">Playoff Fantasy</h1>
      <p className="text-gray-400 text-xl mb-8">
        Draft once. Survive the playoffs.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg"
        >
          Log In
        </Link>
      </div>
    </main>
  );
}