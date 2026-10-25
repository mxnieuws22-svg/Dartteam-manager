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

// Een seizoen loopt van 1 augustus tot en met 31 juli en heet naar het jaar waarin het begint.
function seasonOf(date: string) {
  const year = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 8 ? year : year - 1;
}

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
  const [season, setSeason] = useState("");
  const [seasons, setSeasons] = useState<number[]>([]);
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

    // Het gekozen seizoen: standaard het huidige, of anders het laatste met wedstrijden.
    const all = [
      ...new Set((matchesRes.data ?? []).map((m) => seasonOf(m.match_date))),
    ].sort((a, b) => b - a);
    setSeasons(all);
    const current = seasonOf(today);
    const chosen =
      season || String(all.includes(current) ? current : (all[0] ?? current));
    if (!season) setSeason(chosen);
    const inSeason = (date: string) =>
      chosen === "all" || String(seasonOf(date)) === chosen;

    // Een wedstrijd telt mee als hij gespeeld is of de datum voorbij is.
    const counted = (m: { match_date: string; status: string }) =>
      m.status === "played" || m.match_date <= today;

    const starts: Record<string, number> = {};
    for (const l of lineupRes.data ?? []) {
      if (l.matches && inSeason(l.matches.match_date) && counted(l.matches)) {
        starts[l.player_id] = (starts[l.player_id] ?? 0) + 1;
      }
    }

    // Ranglijst: per gewonnen wedstrijd waarin iemand in de basis stond (alleen wedstrijden met uitslag).
    const wins: Record<string, number> = {};
    const playedScored: Record<string, number> = {};
    for (const l of lineupRes.data ?? []) {
      const m = l.matches;
      if (
        m &&
        inSeason(m.match_date) &&
        m.score_for !== null &&
        m.score_against !== null
      ) {
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

    setMatchCount(
      (matchesRes.data ?? []).filter(
        (m) => inSeason(m.match_date) && counted(m),
      ).length,
    );
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
      .select("player_id, kind, value, matches(match_date)")
      .returns<(Highlight & { matches: { match_date: string } | null })[]>();
    const nameOf = new Map((playersRes.data ?? []).map((p) => [p.id, p.name]));
    const counts: Record<string, number> = {};
    const fin: { name: string; value: number }[] = [];
    for (const h of hl ?? []) {
      if (h.matches && !inSeason(h.matches.match_date)) continue;
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
      .select("player_id, won_501, legs_won, legs_lost, matches(match_date)")
      .returns<
        {
          player_id: string;
          won_501: boolean | null;
          legs_won: number | null;
          legs_lost: number | null;
          matches: { match_date: string } | null;
        }[]
      >();
    if (!res.error) {
      const per: Record<
        string,
        { won501: number; played501: number; won: number; lost: number }
      > = {};
      for (const r of res.data ?? []) {
        if (r.matches && !inSeason(r.matches.match_date)) continue;
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
    setFinishes(fin.sort((a, b) => b.value - a.value));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  // Bij gelijk aantal gewonnen wedstrijden: winstpercentage, dan 501 gewonnen, dan legs gewonnen, dan naam.
  const resultOf = new Map(results.map((r) => [r.name, r]));
  // De hoogste finish per speler (de lijst is al van hoog naar laag).
  const bestFinishOf = new Map<string, number>();
  for (const f of finishes) {
    if (!bestFinishOf.has(f.name)) bestFinishOf.set(f.name, f.value);
  }
  const eightiesOf = new Map(oneEighties.map((r) => [r.name, r.count]));
  const rankOf = new Map(ranking.map((r) => [r.id, r]));
  const table = rows
    .map((r) => {
      const rk = rankOf.get(r.id);
      const res = resultOf.get(r.name);
      return {
        ...r,
        wins: rk?.wins ?? 0,
        played: rk?.played ?? 0,
        res,
        eighties: eightiesOf.get(r.name) ?? 0,
        finish: bestFinishOf.get(r.name),
      };
    })
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        (b.played ? b.wins / b.played : 0) -
          (a.played ? a.wins / a.played : 0) ||
        (b.res?.won501 ?? 0) - (a.res?.won501 ?? 0) ||
        (b.res?.won ?? 0) - (a.res?.won ?? 0) ||
        b.starts - a.starts ||
        a.name.localeCompare(b.name),
    );
  const showResults = results.length > 0;
  const showEighties = oneEighties.length > 0;
  const showFinishes = finishes.length > 0;

  const th = "px-2 py-2 text-center font-semibold";
  const td = "px-2 py-2 text-center";

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Statistieken</h1>
        <p className="text-sm text-green-900/60">
          Ranglijst over {matchCount} gespeelde wedstrijden. Tik op een naam
          voor alle cijfers van die speler.
        </p>
        {seasons.length > 0 && (
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            aria-label="Seizoen"
            className="mt-2 rounded border border-green-300 bg-white p-2 text-gray-900"
          >
            {seasons.map((y) => (
              <option key={y} value={String(y)}>
                Seizoen {y}/{y + 1}
              </option>
            ))}
            <option value="all">Alle seizoenen</option>
          </select>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loaded && !error && rows.length === 0 && <p>Nog geen spelers.</p>}

      {table.length > 0 && (
        <section className="space-y-2">
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-green-100 text-green-900">
                <tr>
                  <th className={th}>#</th>
                  <th className={`${th} text-left`}>Speler</th>
                  <th className={th}>Gewonnen</th>
                  {showResults && <th className={th}>501</th>}
                  {showResults && <th className={th}>Legs</th>}
                  {showEighties && <th className={th}>180</th>}
                  {showFinishes && <th className={th}>Finish</th>}
                  <th className={th}>Basis</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => (
                  <tr key={r.id} className="border-t">
                    <td className={td}>
                      <span
                        className={`inline-block w-6 rounded font-bold ${
                          i === 0
                            ? "bg-amber-400 text-amber-950"
                            : "text-green-900/70"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-left">
                      <Link
                        href={`/statistieken/${r.id}`}
                        className="font-semibold text-green-700"
                      >
                        {r.name}
                      </Link>
                      {!r.active && (
                        <span className="block text-xs text-green-900/60">
                          niet meer in team
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      <span className="font-bold">{r.wins}</span>
                      <span className="text-green-900/60"> / {r.played}</span>
                    </td>
                    {showResults && (
                      <td className={td}>
                        {r.res ? (
                          <>
                            <span className="font-bold">{r.res.won501}</span>
                            <span className="text-green-900/60">
                              {" "}
                              / {r.res.played501}
                            </span>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                    )}
                    {showResults && (
                      <td className={td}>
                        {r.res && r.res.won + r.res.lost > 0 ? (
                          <>
                            <span className="font-bold">{r.res.won}</span>
                            <span className="text-green-900/60">
                              {" "}
                              - {r.res.lost}
                            </span>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                    )}
                    {showEighties && (
                      <td className={td}>{r.eighties || "-"}</td>
                    )}
                    {showFinishes && <td className={td}>{r.finish ?? "-"}</td>}
                    <td className={td}>{r.starts}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-green-900/60">
            Gewonnen: wedstrijden die het team won met hem in de basis, van het
            aantal gespeelde wedstrijden met uitslag. 501: gewonnen van
            gespeeld. Legs: gewonnen - verloren. Finish: hoogste finish. Basis:
            keer in de basis.
          </p>
        </section>
      )}

      {finishes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Hoogste finishes</h2>
          <ul className="space-y-2">
            {finishes.slice(0, 10).map((r, i) => (
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
