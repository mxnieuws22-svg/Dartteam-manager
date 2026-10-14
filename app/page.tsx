"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIsAdmin } from "@/lib/useIsAdmin";

type Match = {
  id: string;
  opponent: string | null;
  match_date: string;
  location: string | null;
  is_home: boolean;
};

type Player = { id: string; name: string };
type Role = "none" | "starter" | "reserve";

export default function Home() {
  const supabase = createClient();
  const isAdmin = useIsAdmin();
  const [loaded, setLoaded] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roles, setRoles] = useState<Record<string, Role>>({});
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
      const [playersRes, lineupRes] = await Promise.all([
        supabase
          .from("players")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("lineup")
          .select("player_id, is_starter")
          .eq("match_id", next.id),
      ]);

      if (playersRes.error || lineupRes.error) {
        setError("Opstelling laden mislukt.");
      } else {
        setPlayers(playersRes.data ?? []);
        setRoles(
          Object.fromEntries(
            (lineupRes.data ?? []).map((r) => [
              r.player_id,
              r.is_starter ? "starter" : "reserve",
            ])
          )
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
                    Spelers
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
                    Reserve
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

            {isAdmin && (
              <details className="rounded border p-2">
                <summary className="cursor-pointer font-semibold text-green-700">
                  Spelers toevoegen of weghalen
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
                        <option value="starter">Speler</option>
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

      <Link
        href="/statistieken"
        className="block rounded-lg border bg-white p-4 font-semibold text-green-700"
      >
        Statistieken: wie stond hoe vaak in de basis →
      </Link>
    </main>
  );
}
