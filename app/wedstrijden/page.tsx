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
  is_home: boolean;
  status: "planned" | "played";
};

export default function WedstrijdenPage() {
  const supabase = createClient();
  const isAdmin = useIsAdmin();
  const [matches, setMatches] = useState<Match[]>([]);
  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [location, setLocation] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [error, setError] = useState("");
  const [today, setToday] = useState("");

  async function loadMatches() {
    const { data, error } = await supabase
      .from("matches")
      .select("id, opponent, match_date, location, is_home, status")
      .order("match_date");

    if (error) {
      setError("Wedstrijden laden mislukt.");
      return;
    }
    setToday(new Date().toISOString().slice(0, 10));
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
      is_home: isHome,
    });

    if (error) {
      setError("Wedstrijd aanmaken mislukt.");
      return;
    }
    setOpponent("");
    setMatchDate("");
    setLocation("");
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

  const upcoming = matches.filter(
    (m) => m.status === "planned" && m.match_date >= today
  );
  const past = matches
    .filter((m) => !upcoming.includes(m))
    .sort((a, b) => b.match_date.localeCompare(a.match_date));

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
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
        <select
          value={isHome ? "home" : "away"}
          onChange={(e) => setIsHome(e.target.value === "home")}
          className="w-full rounded border border-green-300 p-2 text-gray-900"
        >
          <option value="home">Thuiswedstrijd</option>
          <option value="away">Uitwedstrijd</option>
        </select>
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

      <MatchSection
        title="Komende wedstrijden"
        empty="Geen wedstrijden gepland."
        matches={upcoming}
        isAdmin={isAdmin}
        onDelete={deleteMatch}
      />
      <MatchSection
        title="Eerdere wedstrijden"
        empty="Nog geen eerdere wedstrijden."
        matches={past}
        isAdmin={isAdmin}
        onDelete={deleteMatch}
      />
    </main>
  );
}


function MatchSection({
  title,
  empty,
  matches,
  isAdmin,
  onDelete,
}: {
  title: string;
  empty: string;
  matches: Match[];
  isAdmin: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">
        {title} ({matches.length})
      </h2>
      {matches.length === 0 && (
        <p className="text-sm text-green-900/60">{empty}</p>
      )}
      <ul className="space-y-2">
        {matches.map((m) => {
          const date = new Date(m.match_date);
          return (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-lg border bg-white p-3"
            >
              <div className="w-14 shrink-0 rounded bg-green-100 py-1 text-center text-green-900">
                <div className="text-xl font-bold leading-tight">
                  {date.getDate()}
                </div>
                <div className="text-xs uppercase">
                  {date.toLocaleDateString("nl-NL", { month: "short" })}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/wedstrijden/${m.id}`}
                  className="block truncate font-semibold text-green-700"
                >
                  {m.opponent || "Tegenstander onbekend"}
                </Link>
                <div className="truncate text-sm text-green-900/60">
                  {date.toLocaleDateString("nl-NL", { weekday: "long" })}
                  {" · "}
                  <span className="font-semibold text-green-900">
                    {m.is_home ? "Thuis" : "Uit"}
                  </span>
                  {m.location && ` · ${m.location}`}
                  {m.status === "played" && " · gespeeld"}
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => onDelete(m.id)}
                  className="text-sm text-red-600"
                >
                  Verwijderen
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
