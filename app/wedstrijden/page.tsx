"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Match = {
  id: string;
  opponent: string;
  match_date: string;
  is_home: boolean;
};

export default function WedstrijdenPage() {
  const supabase = createClient();
  const [matches, setMatches] = useState<Match[]>([]);
  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [error, setError] = useState("");

  async function loadMatches() {
    const { data, error } = await supabase
      .from("matches")
      .select("id, opponent, match_date, is_home")
      .order("match_date");

    if (error) {
      setError("Wedstrijden laden mislukt.");
      return;
    }
    setMatches(data ?? []);
  }

  useEffect(() => {
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addMatch(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const { error } = await supabase.from("matches").insert({
      opponent: opponent.trim(),
      match_date: new Date(matchDate).toISOString(),
      is_home: isHome,
    });

    if (error) {
      setError("Wedstrijd aanmaken mislukt.");
      return;
    }
    setOpponent("");
    setMatchDate("");
    setIsHome(true);
    loadMatches();
  }

  async function deleteMatch(id: string) {
    if (!confirm("Deze wedstrijd verwijderen?")) return;

    const { error } = await supabase.from("matches").delete().eq("id", id);

    if (error) {
      setError("Wedstrijd verwijderen mislukt.");
      return;
    }
    loadMatches();
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Wedstrijden</h1>

      <form onSubmit={addMatch} className="space-y-3 rounded-lg border p-4">
        <input
          type="text"
          placeholder="Tegenstander"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          required
          className="w-full rounded border border-gray-300 p-2 text-gray-900"
        />
        <input
          type="datetime-local"
          value={matchDate}
          onChange={(e) => setMatchDate(e.target.value)}
          required
          className="w-full rounded border border-gray-300 p-2 text-gray-900"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isHome}
            onChange={(e) => setIsHome(e.target.checked)}
          />
          Thuiswedstrijd
        </label>
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white"
        >
          Aanmaken
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Alle wedstrijden ({matches.length})
        </h2>
        <ul className="space-y-2">
          {matches.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded border p-2"
            >
              <div>
                <div className="font-semibold">
                  {m.is_home ? "Thuis" : "Uit"} tegen {m.opponent}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(m.match_date).toLocaleString("nl-NL", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </div>
              </div>
              <button
                onClick={() => deleteMatch(m.id)}
                className="text-sm text-red-600"
              >
                Verwijderen
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
