"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { id: string; name: string; starts: number; active: boolean };

type Highlight = {
  player_id: string;
  kind: "180" | "finish";
  value: number | null;
};

type LineupRow = {
  player_id: string;
  matches: {
    match_date: string;
    status: string;
    score_for: number | null;
    score_against: number | null;
  } | null;
};

export default function StatistiekenPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [oneEighties, setOneEighties] = useState<
    { name: string; count: number }[]
  >([]);
  const [finishes, setFinishes] = useState<{ name: string; value: number }[]>(
    [],
  );
  const [results, setResults] = useState<
    {
      name: string;
      won501: number;
      played501: number;
      won: number;
      lost: number;
    }[]
  >([]);
  const [ranking, setRanking] = useState<
    { id: string; name: string; wins: number; played: number }[]
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const [playersRes, lineupRes, matchesRes] = await Promise.all([
      supabase.from("players").select("id, name, is_active"),
      supabase
        .from("lineup")
        .select(
          "player_id, matches(match_date, status, score_for, score_against)",
        )
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

    // Ranglijst: per gewonnen wedstrijd waarin iemand in de basis stond (alleen wedstrijden met uitslag).
    const wins: Record<string, number> = {};
    const playedScored: Record<string, number> = {};
    for (const l of lineupRes.data ?? []) {
      const m = l.matches;
      if (m && m.score_for !== null && m.score_against !== null) {
        playedScored[l.player_id] = (playedScored[l.player_id] ?? 0) + 1;
        if (m.score_for > m.score_against) {
          wins[l.player_id] = (wins[l.player_id] ?? 0) + 1;
        }
      }
    }
    setRanking(
      (playersRes.data ?? [])
        .filter((p) => playedScored[p.id])
        .map((p) => ({
          id: p.id,
          name: p.name,
          wins: wins[p.id] ?? 0,
          played: playedScored[p.id],
        }))
        .sort(
          (a, b) =>
            b.wins - a.wins ||
            b.wins / b.played - a.wins / a.played ||
            a.name.localeCompare(b.name),
        ),
    );

    setMatchCount((matchesRes.data ?? []).filter(counted).length);
    setRows(
      (playersRes.data ?? [])
        .map((p) => ({
          id: p.id,
          name: p.name,
          starts: starts[p.id] ?? 0,
          active: p.is_active,
        }))
        // Spelers die het team hebben verlaten blijven staan zolang ze gespeeld hebben.
        .filter((r) => r.active || r.starts > 0)
        .sort((a, b) => b.starts - a.starts || a.name.localeCompare(b.name)),
    );
    setLoaded(true);

    // Bestaat de tabel nog niet (SQL niet gedraaid), dan blijft dit leeg.
    const { data: hl } = await supabase
      .from("highlights")
      .select("player_id, kind, value");
    const nameOf = new Map((playersRes.data ?? []).map((p) => [p.id, p.name]));
    const counts: Record<string, number> = {};
    const fin: { name: string; value: number }[] = [];
    for (const h of (hl as Highlight[] | null) ?? []) {
      const name = nameOf.get(h.player_id) ?? "Onbekend";
      if (h.kind === "180") counts[name] = (counts[name] ?? 0) + 1;
      else if (h.value) fin.push({ name, value: h.value });
    }
    setOneEighties(
      Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    );
    // 501 en legs apart ophalen: bestaan de velden nog niet (SQL niet gedraaid), dan blijft dit leeg.
    const res = await supabase
      .from("lineup")
      .select("player_id, won_501, legs_won, legs_lost");
    if (!res.error) {
      const per: Record<
        string,
        { won501: number; played501: number; won: number; lost: number }
      > = {};
      for (const r of res.data ?? []) {
        const x = (per[r.player_id] ??= {
          won501: 0,
          played501: 0,
          won: 0,
          lost: 0,
        });
        if (r.won_501 !== null) {
          x.played501 += 1;
          if (r.won_501) x.won501 += 1;
        }
        x.won += r.legs_won ?? 0;
        x.lost += r.legs_lost ?? 0;
      }
      setResults(
        Object.entries(per)
          .filter(([, x]) => x.played501 > 0 || x.won + x.lost > 0)
          .map(([pid, x]) => ({ name: nameOf.get(pid) ?? "Onbekend", ...x }))
          .sort(
            (a, b) =>
              b.won501 - a.won501 ||
              b.won - a.won ||
              a.name.localeCompare(b.name),
          ),
      );
    }
    setFinishes(fin.sort((a, b) => b.value - a.value).slice(0, 10));
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
          wedstrijden. Tik op een naam voor alle cijfers van die speler.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loaded && !error && rows.length === 0 && <p>Nog geen spelers.</p>}

      {ranking.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Ranglijst</h2>
          <p className="text-sm text-green-900/60">
            Per gewonnen wedstrijd waarin iemand in de basis stond.
          </p>
          <ol className="space-y-2">
            {ranking.map((r, i) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border bg-white p-3"
              >
                <span
                  className={`w-8 shrink-0 rounded text-center font-bold ${
                    i === 0
                      ? "bg-amber-400 text-amber-950"
                      : "bg-green-100 text-green-900"
                  }`}
                >
                  {i + 1}
                </span>
                <Link
                  href={`/statistieken/${r.id}`}
                  className="min-w-0 flex-1 truncate font-semibold text-green-700"
                >
                  {r.name}
                </Link>
                <span className="text-right text-sm">
                  <span className="font-bold">{r.wins}</span> gewonnen
                  <span className="block text-green-900/60">
                    van {r.played} gespeeld
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <h2 className="text-lg font-bold">In de basis</h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center gap-3 rounded-lg border bg-white p-3"
          >
            <Link
              href={`/statistieken/${r.id}`}
              className="w-32 shrink-0 truncate font-semibold text-green-700"
            >
              {r.name}
              {!r.active && (
                <span className="block text-xs font-normal text-green-900/60">
                  niet meer in team
                </span>
              )}
            </Link>
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

      {results.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">501 en legs</h2>
          <ul className="space-y-2">
            {results.map((r) => (
              <li
                key={r.name}
                className="flex items-center justify-between gap-3 rounded-lg border bg-white p-3"
              >
                <span className="font-semibold">{r.name}</span>
                <span className="text-right text-sm">
                  <span className="font-bold">
                    {r.won501}/{r.played501}
                  </span>{" "}
                  501 gewonnen
                  <span className="block text-green-900/60">
                    legs {r.won} gewonnen, {r.lost} verloren
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {oneEighties.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">180&apos;s</h2>
          <ul className="space-y-2">
            {oneEighties.map((r) => (
              <li
                key={r.name}
                className="flex items-center justify-between rounded-lg border bg-white p-3"
              >
                <span className="font-semibold">{r.name}</span>
                <span className="font-bold">{r.count}x</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finishes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Hoogste finishes</h2>
          <ul className="space-y-2">
            {finishes.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border bg-white p-3"
              >
                <span className="font-semibold">{r.name}</span>
                <span className="font-bold">{r.value}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
