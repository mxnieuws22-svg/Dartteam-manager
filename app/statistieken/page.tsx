"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { name: string; starts: number };

type LineupRow = {
  player_id: string;
  matches: { match_date: string; status: string } | null;
};

export default function StatistiekenPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const [playersRes, lineupRes, matchesRes] = await Promise.all([
      supabase.from("players").select("id, name").eq("is_active", true),
      supabase
        .from("lineup")
        .select("player_id, matches(match_date, status)")
        .eq("is_starter", true)
        .returns<LineupRow[]>(),
      supabase.from("matches").select("match_date, status"),
    ]);

    if (playersRes.error || lineupRes.error || matchesRes.error) {
      setError("Statistieken laden mislukt.");
      setLoaded(true);
      return;
    }

    // Een wedstrijd telt mee als hij gespeeld is of de datum voorbij is.
    const counted = (m: { match_date: string; status: string }) =>
      m.status === "played" || m.match_date <= today;

    const starts: Record<string, number> = {};
    for (const l of lineupRes.data ?? []) {
      if (l.matches && counted(l.matches)) {
        starts[l.player_id] = (starts[l.player_id] ?? 0) + 1;
      }
    }

    setMatchCount((matchesRes.data ?? []).filter(counted).length);
    setRows(
      (playersRes.data ?? [])
        .map((p) => ({ name: p.name, starts: starts[p.id] ?? 0 }))
        .sort((a, b) => b.starts - a.starts || a.name.localeCompare(b.name))
    );
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Statistieken</h1>
        <p className="text-sm text-green-900/60">
          Hoe vaak iemand in de basis stond, over {matchCount} gespeelde
          wedstrijden.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loaded && !error && rows.length === 0 && <p>Nog geen spelers.</p>}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center gap-3 rounded-lg border bg-white p-3"
          >
            <span className="w-32 shrink-0 truncate font-semibold">
              {r.name}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded bg-green-100">
              <div
                className="h-full bg-green-700"
                style={{
                  width: `${matchCount ? (r.starts / matchCount) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-bold">
              {r.starts}x
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
