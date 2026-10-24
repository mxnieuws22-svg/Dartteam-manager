"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ScoreBadge from "@/components/ScoreBadge";
import { createClient } from "@/lib/supabase/client";

type MatchInfo = {
  id: string;
  opponent: string | null;
  match_date: string;
  status: string;
  is_home: boolean;
  score_for: number | null;
  score_against: number | null;
};

type Row = {
  is_starter: boolean;
  legs_won?: number | null;
  legs_lost?: number | null;
  won_501?: boolean | null;
  matches: MatchInfo | null;
};

type Highlight = { kind: "180" | "finish"; value: number | null };

export default function SpelerStatistiekenPage() {
  return (
    <Suspense fallback={<p className="p-4">Laden...</p>}>
      <SpelerStatistieken />
    </Suspense>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-3 text-center">
      <div className="text-2xl font-bold text-green-700">{value}</div>
      <div className="text-xs text-green-900/60">{label}</div>
    </div>
  );
}

function SpelerStatistieken() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const matchFields =
      "matches(id, opponent, match_date, status, is_home, score_for, score_against)";
    const withLegs = await supabase
      .from("lineup")
      .select(`is_starter, won_501, legs_won, legs_lost, ${matchFields}`)
      .eq("player_id", id)
      .returns<Row[]>();
    // Bestaan de velden voor legs nog niet (SQL niet gedraaid), dan zonder.
    const lineup = withLegs.error
      ? await supabase
          .from("lineup")
          .select(`is_starter, ${matchFields}`)
          .eq("player_id", id)
          .returns<Row[]>()
      : withLegs;
    const player = await supabase
      .from("players")
      .select("name")
      .eq("id", id)
      .maybeSingle();

    if (lineup.error || player.error || !player.data) {
      setError("Speler niet gevonden.");
      setLoaded(true);
      return;
    }
    setName(player.data.name);
    setRows(lineup.data ?? []);
    setLoaded(true);

    const hl = await supabase
      .from("highlights")
      .select("kind, value")
      .eq("player_id", id);
    setHighlights((hl.data as Highlight[] | null) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!loaded) return <p className="p-4">Laden...</p>;

  // Een wedstrijd telt mee als hij gespeeld is of de datum voorbij is.
  const today = new Date().toISOString().slice(0, 10);
  const played = rows
    .filter(
      (r) =>
        r.matches &&
        (r.matches.status === "played" || r.matches.match_date <= today),
    )
    .sort((a, b) => b.matches!.match_date.localeCompare(a.matches!.match_date));

  const starts = played.filter((r) => r.is_starter).length;
  const withScore = played.filter(
    (r) => r.matches!.score_for !== null && r.matches!.score_against !== null,
  );
  const teamWins = withScore.filter(
    (r) => r.matches!.score_for! > r.matches!.score_against!,
  ).length;
  const legsWon = played.reduce((n, r) => n + (r.legs_won ?? 0), 0);
  const legsLost = played.reduce((n, r) => n + (r.legs_lost ?? 0), 0);
  const played501 = played.filter((r) => r.won_501 != null);
  const won501 = played501.filter((r) => r.won_501 === true).length;

  const oneEighties = highlights.filter((h) => h.kind === "180").length;
  const finishes = highlights
    .filter((h) => h.kind === "finish" && h.value)
    .map((h) => h.value!)
    .sort((a, b) => b - a);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <Link href="/statistieken" className="text-sm text-green-700">
          ← Statistieken
        </Link>
        <h1 className="text-2xl font-bold">{name || "Speler"}</h1>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!error && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Wedstrijden" value={played.length} />
            <Stat label="In de basis" value={starts} />
            <Stat label="Reserve" value={played.length - starts} />
            <Stat
              label="Team won"
              value={withScore.length ? `${teamWins}/${withScore.length}` : "-"}
            />
            <Stat label="Legs gewonnen" value={legsWon} />
            <Stat label="Legs verloren" value={legsLost} />
            <Stat
              label="Legs gewonnen %"
              value={
                legsWon + legsLost
                  ? `${Math.round((legsWon / (legsWon + legsLost)) * 100)}%`
                  : "-"
              }
            />
            <Stat
              label="501 gewonnen"
              value={played501.length ? `${won501}/${played501.length}` : "-"}
            />
            <Stat label="180's" value={oneEighties} />
          </div>

          {finishes.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">Hoge finishes</h2>
              <p className="flex flex-wrap gap-1.5">
                {finishes.map((f, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-950"
                  >
                    {f}
                  </span>
                ))}
              </p>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-lg font-semibold">Wedstrijden</h2>
            {played.length === 0 && (
              <p className="text-sm text-green-900/60">
                Nog niet gespeeld voor het team.
              </p>
            )}
            <ul className="space-y-2">
              {played.map((r) => {
                const m = r.matches!;
                const legs =
                  r.legs_won != null || r.legs_lost != null
                    ? `${r.legs_won ?? 0}-${r.legs_lost ?? 0} legs`
                    : "";
                return (
                  <li key={m.id}>
                    <Link
                      href={`/wedstrijden/${m.id}`}
                      className="flex items-center gap-3 rounded-lg border bg-white p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-green-700">
                          {m.opponent || "Tegenstander onbekend"}
                        </div>
                        <div className="truncate text-sm text-green-900/60">
                          {new Date(m.match_date).toLocaleDateString("nl-NL", {
                            dateStyle: "medium",
                          })}
                          {" · "}
                          {r.is_starter ? "Basis" : "Reserve"}
                          {legs && ` · ${legs}`}
                          {r.won_501 != null &&
                            ` · 501 ${r.won_501 ? "gewonnen" : "verloren"}`}
                        </div>
                      </div>
                      <ScoreBadge
                        scoreFor={m.score_for}
                        scoreAgainst={m.score_against}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
