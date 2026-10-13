"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Match = {
  id: string;
  opponent: string | null;
  match_date: string;
  location: string | null;
  is_home: boolean;
};

type LineupRow = {
  is_starter: boolean;
  players: { name: string } | null;
};

export default function Home() {
  const supabase = createClient();
  const [loaded, setLoaded] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [starters, setStarters] = useState<string[]>([]);
  const [reserves, setReserves] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const { data: next, error: matchError } = await supabase
      .from("matches")
      .select("id, opponent, match_date, location, is_home")
      .eq("status", "planned")
      .gte("match_date", today)
      .order("match_date")
      .limit(1)
      .maybeSingle();

    if (matchError) {
      setError("Volgende wedstrijd laden mislukt.");
      setLoaded(true);
      return;
    }
    setMatch(next);

    if (next) {
      const { data: rows, error: lineupError } = await supabase
        .from("lineup")
        .select("is_starter, players(name)")
        .eq("match_id", next.id)
        .returns<LineupRow[]>();

      if (lineupError) {
        setError("Opstelling laden mislukt.");
      } else {
        const names = (starter: boolean) =>
          (rows ?? [])
            .filter((r) => r.is_starter === starter && r.players)
            .map((r) => r.players!.name)
            .sort();
        setStarters(names(true));
        setReserves(names(false));
      }
    }
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Darten met je Hart</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-4 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-green-900/60">
          Volgende wedstrijd
        </h2>

        {loaded && !match && !error && (
          <p>Er staat nog geen wedstrijd gepland.</p>
        )}

        {match && (
          <>
            <div>
              <Link
                href={`/wedstrijden/${match.id}`}
                className="text-xl font-bold text-green-700"
              >
                Tegen {match.opponent || "onbekende tegenstander"}
              </Link>
              <p className="text-green-900/70">
                {new Date(match.match_date).toLocaleDateString("nl-NL", {
                  dateStyle: "full",
                })}
                {" · "}
                <span className="font-semibold">
                  {match.is_home ? "Thuiswedstrijd" : "Uitwedstrijd"}
                </span>
                {match.location && ` · ${match.location}`}
              </p>
            </div>

            {starters.length + reserves.length === 0 ? (
              <p className="text-sm text-green-900/60">
                De opstelling is nog niet bepaald.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-1 font-semibold">
                    Spelers ({starters.length})
                  </h3>
                  <ul className="space-y-1">
                    {starters.map((n) => (
                      <li key={n} className="rounded bg-green-100 px-2 py-1">
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">
                    Reserve ({reserves.length})
                  </h3>
                  <ul className="space-y-1">
                    {reserves.map((n) => (
                      <li key={n} className="rounded border px-2 py-1">
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
