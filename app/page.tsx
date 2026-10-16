"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AskAvailability from "@/components/AskAvailability";
import ScoreBadge from "@/components/ScoreBadge";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useStandalone } from "@/lib/useStandalone";

type Match = {
  id: string;
  opponent: string | null;
  match_date: string;
  location: string | null;
  is_home: boolean;
  score_for: number | null;
  score_against: number | null;
};

type Player = { id: string; name: string };
type Role = "none" | "starter" | "reserve";
type Played = { starters: string[]; reserves: string[] };

type PlayedRow = {
  match_id: string;
  is_starter: boolean;
  players: { name: string } | null;
};

export default function Home() {
  const supabase = createClient();
  const isAdmin = useIsAdmin();
  const isApp = useStandalone();
  const [loaded, setLoaded] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [later, setLater] = useState<Match[]>([]);
  const [earlier, setEarlier] = useState<Match[]>([]);
  const [played, setPlayed] = useState<Record<string, Played>>({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const { data: all, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, opponent, match_date, location, is_home, status, score_for, score_against",
      )
      .order("match_date");

    if (matchError) {
      setError("Wedstrijden laden mislukt.");
      setLoaded(true);
      return;
    }
    const upcoming = (all ?? []).filter(
      (m) => m.status === "planned" && m.match_date >= today,
    );
    const next = upcoming[0] ?? null;
    setMatch(next);
    setLater(upcoming.slice(1, 4));
    const recent = (all ?? [])
      .filter((m) => !upcoming.includes(m))
      .sort((x, y) => y.match_date.localeCompare(x.match_date))
      .slice(0, 3);
    setEarlier(recent);

    if (recent.length > 0) {
      const { data: rows } = await supabase
        .from("lineup")
        .select("match_id, is_starter, players(name)")
        .in(
          "match_id",
          recent.map((m) => m.id),
        )
        .returns<PlayedRow[]>();

      const byMatch: Record<string, Played> = {};
      for (const r of rows ?? []) {
        if (!r.players) continue;
        const entry = (byMatch[r.match_id] ??= { starters: [], reserves: [] });
        (r.is_starter ? entry.starters : entry.reserves).push(r.players.name);
      }
      for (const e of Object.values(byMatch)) {
        e.starters.sort();
        e.reserves.sort();
      }
      setPlayed(byMatch);
    }

    if (next) {
      const [playersRes, lineupRes, availabilityRes] = await Promise.all([
        supabase
          .from("players")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("lineup")
          .select("player_id, is_starter")
          .eq("match_id", next.id),
        supabase
          .from("availability")
          .select("player_id, is_available")
          .eq("match_id", next.id),
      ]);

      if (playersRes.error || lineupRes.error) {
        setError("Opstelling laden mislukt.");
      } else {
        setPlayers(playersRes.data ?? []);
        setAvailability(
          Object.fromEntries(
            (availabilityRes.data ?? []).map((r) => [
              r.player_id,
              r.is_available,
            ]),
          ),
        );
        setRoles(
          Object.fromEntries(
            (lineupRes.data ?? []).map((r) => [
              r.player_id,
              r.is_starter ? "starter" : "reserve",
            ]),
          ),
        );
      }
    }
    setLoaded(true);
  }

  async function setRole(playerId: string, role: Role) {
    if (!match) return;
    setError("");
    const { error } =
      role === "none"
        ? await supabase
            .from("lineup")
            .delete()
            .eq("match_id", match.id)
            .eq("player_id", playerId)
        : await supabase.from("lineup").upsert({
            match_id: match.id,
            player_id: playerId,
            is_starter: role === "starter",
          });

    if (error) {
      setError("Opstelling opslaan mislukt.");
      return;
    }
    setRoles((prev) => ({ ...prev, [playerId]: role }));
  }

  function shareWhatsApp() {
    if (!match) return;
    const date = new Date(match.match_date).toLocaleDateString("nl-NL", {
      dateStyle: "full",
    });
    const lines = [
      "🎯 Darten met je Hart - 't Berghje",
      `Volgende wedstrijd: tegen ${match.opponent || "onbekende tegenstander"}`,
      `📅 ${date} · ${match.is_home ? "Thuiswedstrijd" : "Uitwedstrijd"}${
        match.location ? ` · ${match.location}` : ""
      }`,
    ];
    if (starters.length > 0) lines.push(`Opstelling: ${starters.join(", ")}`);
    if (reserves.length > 0) lines.push(`Reserve: ${reserves.join(", ")}`);
    lines.push(window.location.origin);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
      "noopener",
    );
  }

  const names = (role: Role) =>
    players.filter((p) => roles[p.id] === role).map((p) => p.name);
  const starters = names("starter");
  const reserves = names("reserve");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="sr-only">Darten met je Hart - &apos;t Berghje</h1>
      <Image
        src="/logo.png"
        alt="Darten met je Hart - 't Berghje"
        width={1152}
        height={768}
        priority
        className="w-full rounded-lg"
      />

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
                  <h3 className="mb-1 font-semibold">Opstelling</h3>
                  <ul className="space-y-1">
                    {starters.map((n) => (
                      <li key={n} className="rounded bg-green-100 px-2 py-1">
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">Reserve</h3>
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

            {isAdmin && (
              <button
                type="button"
                onClick={shareWhatsApp}
                className="w-full rounded bg-green-700 px-4 py-2 font-semibold text-white"
              >
                Deel via WhatsApp
              </button>
            )}

            {isAdmin && (
              <details className="rounded border p-2">
                <summary className="cursor-pointer font-semibold text-green-700">
                  Opstelling aanpassen
                </summary>
                <ul className="mt-2 space-y-2">
                  {players.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2"
                    >
                      {p.name}
                      <select
                        value={roles[p.id] ?? "none"}
                        onChange={(e) => setRole(p.id, e.target.value as Role)}
                        className="rounded border border-green-300 p-1 text-gray-900"
                      >
                        <option value="none">Niet opgesteld</option>
                        <option value="starter">Basis</option>
                        <option value="reserve">Reserve</option>
                      </select>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      {isAdmin && match && (
        <AskAvailability
          matchId={match.id}
          opponent={match.opponent}
          matchDate={match.match_date}
          isHome={match.is_home}
          players={players}
          available={availability}
        />
      )}

      <MatchList title="Hierna" matches={later} />
      <MatchList
        title="Laatste wedstrijden"
        matches={earlier}
        played={played}
      />

      <Link
        href="/statistieken"
        className="block rounded-lg border bg-white p-4 font-semibold text-green-700"
      >
        Statistieken: wie stond hoe vaak in de basis →
      </Link>

      {isApp && !isAdmin && (
        <p className="pt-2 text-center text-sm">
          <Link href="/login" className="text-green-900/60 underline">
            Beheerder inloggen
          </Link>
        </p>
      )}
    </main>
  );
}

function MatchList({
  title,
  matches,
  played,
}: {
  title: string;
  matches: Match[];
  played?: Record<string, Played>;
}) {
  if (matches.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <ul className="space-y-2">
        {matches.map((m) => {
          const date = new Date(m.match_date);
          const lineup = played?.[m.id];
          return (
            <li key={m.id}>
              <Link
                href={`/wedstrijden/${m.id}`}
                className="block space-y-3 rounded-lg border bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 shrink-0 rounded bg-green-100 py-1 text-center text-green-900">
                    <div className="text-xl font-bold leading-tight">
                      {date.getDate()}
                    </div>
                    <div className="text-xs uppercase">
                      {date.toLocaleDateString("nl-NL", { month: "short" })}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-green-700">
                      {m.opponent || "Tegenstander onbekend"}
                    </div>
                    <div className="truncate text-sm text-green-900/60">
                      {m.is_home ? "Thuis" : "Uit"}
                      {m.location && ` · ${m.location}`}
                    </div>
                  </div>
                  <ScoreBadge
                    scoreFor={m.score_for}
                    scoreAgainst={m.score_against}
                  />
                </div>
                {lineup && (
                  <div className="flex flex-wrap gap-1.5 border-t pt-3">
                    {lineup.starters.map((n) => (
                      <span
                        key={n}
                        className="rounded-full bg-green-100 px-2.5 py-1 text-sm font-medium text-green-900"
                      >
                        {n}
                      </span>
                    ))}
                    {lineup.reserves.map((n) => (
                      <span
                        key={n}
                        className="rounded-full border px-2.5 py-1 text-sm text-green-900/70"
                      >
                        {n} (reserve)
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
