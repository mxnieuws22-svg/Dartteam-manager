"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIsAdmin } from "@/lib/useIsAdmin";

type Match = {
  id: string;
  opponent: string;
  match_date: string;
  location: string | null;
  status: "planned" | "played";
};

export default function WedstrijdenPage() {
  const supabase = createClient();
  const isAdmin = useIsAdmin();
  const [matches, setMatches] = useState<Match[]>([]);
  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");

  async function loadMatches() {
    const { data, error } = await supabase
      .from("matches")
      .select("id, opponent, match_date, location, status")
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
      match_date: matchDate,
      location: location.trim() || null,
    });

    if (error) {
      setError("Wedstrijd aanmaken mislukt.");
      return;
    }
    setOpponent("");
    setMatchDate("");
    setLocation("");
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

      {isAdmin && (
      <form onSubmit={addMatch} className="space-y-3 rounded-lg border bg-white p-4">
        <input
          type="text"
          placeholder="Tegenstander"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          required
          className="w-full rounded border border-green-300 p-2 text-gray-900"
        />
        <input
          type="date"
          value={matchDate}
          onChange={(e) => setMatchDate(e.target.value)}
          required
          className="w-full rounded border border-green-300 p-2 text-gray-900"
        />
        <input
          type="text"
          placeholder="Locatie (optioneel)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full rounded border border-green-300 p-2 text-gray-900"
        />
        <button
          type="submit"
          className="rounded bg-green-700 px-4 py-2 font-semibold text-white"
        >
          Aanmaken
        </button>
      </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Alle wedstrijden ({matches.length})
        </h2>
        <ul className="space-y-2">
          {matches.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded border bg-white p-2"
            >
              <div>
                <Link
                  href={`/wedstrijden/${m.id}`}
                  className="font-semibold text-green-700"
                >
                  {m.opponent || "Tegenstander onbekend"}
                </Link>
                <div className="text-sm text-green-900/60">
                  {new Date(m.match_date).toLocaleDateString("nl-NL", {
                    dateStyle: "full",
                  })}
                  {m.location && ` · ${m.location}`}
                  {m.status === "played" && " · gespeeld"}
                </div>
              </div>
              {isAdmin && (
<button
                onClick={() => deleteMatch(m.id)}
                className="text-sm text-red-600"
              >
                Verwijderen
              </button>
)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
