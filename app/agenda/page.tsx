"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ScoreBadge from "@/components/ScoreBadge";
import { createClient } from "@/lib/supabase/client";

type Item = {
  key: string;
  kind: "match" | "tournament";
  date: string;
  title: string;
  sub: string;
  href?: string;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
};

// "2026-11-05" -> "november 2026"
const monthOf = (date: string) =>
  new Date(date).toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });

function groupByMonth(items: Item[]) {
  const groups: { month: string; items: Item[] }[] = [];
  for (const item of items) {
    const month = monthOf(item.date);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(item);
    else groups.push({ month, items: [item] });
  }
  return groups;
}

export default function AgendaPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [today, setToday] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [m, t] = await Promise.all([
      supabase
        .from("matches")
        .select(
          "id, opponent, match_date, is_home, location, status, score_for, score_against",
        ),
      supabase
        .from("tournaments")
        .select("id, name, tournament_date, location"),
    ]);

    if (m.error) {
      setError("Agenda laden mislukt.");
      setLoaded(true);
      return;
    }

    const matches: Item[] = (m.data ?? []).map((x) => ({
      key: `m-${x.id}`,
      kind: "match",
      date: x.match_date,
      title: x.opponent || "Tegenstander onbekend",
      sub: `${x.is_home ? "Thuis" : "Uit"}${x.location ? ` · ${x.location}` : ""}`,
      href: `/wedstrijden/${x.id}`,
      scoreFor: x.score_for,
      scoreAgainst: x.score_against,
    }));
    // Bestaat de tabel nog niet (SQL niet gedraaid), dan alleen de wedstrijden.
    const tournaments: Item[] = t.error
      ? []
      : (t.data ?? []).map((x) => ({
          key: `t-${x.id}`,
          kind: "tournament",
          date: x.tournament_date,
          title: x.name,
          sub: x.location ?? "",
        }));

    setToday(new Date().toISOString().slice(0, 10));
    setItems(
      [...matches, ...tournaments].sort((a, b) => a.date.localeCompare(b.date)),
    );
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upcoming = items.filter((i) => i.date >= today);
  const past = items.filter((i) => i.date < today).reverse();

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <Link href="/" className="text-sm text-green-700">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold">Agenda</h1>
        <p className="text-sm text-green-900/60">
          Alle wedstrijden en ranking toernooien op een rij.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loaded && !error && upcoming.length === 0 && (
        <p className="text-green-900/70">Er staat niets gepland.</p>
      )}

      {groupByMonth(upcoming).map((g) => (
        <Month key={g.month} month={g.month} items={g.items} />
      ))}

      {past.length > 0 && (
        <details className="space-y-3">
          <summary className="cursor-pointer font-semibold text-green-700">
            Eerder ({past.length})
          </summary>
          <div className="mt-3 space-y-6">
            {groupByMonth(past).map((g) => (
              <Month key={g.month} month={g.month} items={g.items} muted />
            ))}
          </div>
        </details>
      )}
    </main>
  );
}

function Month({
  month,
  items,
  muted,
}: {
  month: string;
  items: Item[];
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold capitalize">{month}</h2>
      <ul className="space-y-2">
        {items.map((i) => {
          const d = new Date(i.date);
          const body = (
            <div
              className={`flex items-center gap-3 rounded-lg border bg-white p-3 ${
                muted ? "opacity-70" : ""
              }`}
            >
              <div
                className={`w-14 shrink-0 rounded py-1 text-center ${
                  i.kind === "match"
                    ? "bg-green-100 text-green-900"
                    : "bg-amber-100 text-amber-950"
                }`}
              >
                <div className="text-xl font-bold leading-tight">
                  {d.getDate()}
                </div>
                <div className="text-xs uppercase">
                  {d.toLocaleDateString("nl-NL", { weekday: "short" })}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate font-semibold ${
                    i.kind === "match" ? "text-green-700" : ""
                  }`}
                >
                  {i.title}
                </div>
                <div className="truncate text-sm text-green-900/60">
                  {i.kind === "match" ? "Wedstrijd" : "Ranking toernooi"}
                  {i.sub && ` · ${i.sub}`}
                </div>
              </div>
              <ScoreBadge
                scoreFor={i.scoreFor ?? null}
                scoreAgainst={i.scoreAgainst ?? null}
              />
            </div>
          );
          return (
            <li key={i.key}>
              {i.href ? (
                <Link href={i.href} className="block">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
