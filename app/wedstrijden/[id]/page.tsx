"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AskAvailability from "@/components/AskAvailability";
import ScoreBadge from "@/components/ScoreBadge";
import { useIsAdmin } from "@/lib/useIsAdmin";

type Player = {
  id: string;
  name: string;
  is_reserve: boolean;
  is_active: boolean;
};
type Match = {
  opponent: string | null;
  match_date: string;
  is_home: boolean;
  location: string | null;
  score_for: number | null;
  score_against: number | null;
};
type Role = "none" | "starter" | "reserve";
type Highlight = {
  id: string;
  player_id: string;
  kind: "180" | "finish";
  value: number | null;
};

export default function WedstrijdPage() {
  return (
    <Suspense fallback={<p className="p-4">Laden...</p>}>
      <WedstrijdDetail />
    </Suspense>
  );
}

function WedstrijdDetail() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const isAdmin = useIsAdmin();
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const [maybe, setMaybe] = useState<Record<string, boolean>>({});
  const [lineup, setLineup] = useState<Record<string, Role>>({});
  const [scoreFor, setScoreFor] = useState("");
  const [scoreAgainst, setScoreAgainst] = useState("");
  const [editOpponent, setEditOpponent] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editIsHome, setEditIsHome] = useState(true);
  const [editLocation, setEditLocation] = useState("");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [hlPlayer, setHlPlayer] = useState("");
  const [hlKind, setHlKind] = useState<"180" | "finish">("180");
  const [hlValue, setHlValue] = useState("");
  const [error, setError] = useState("");
  const [upcoming, setUpcoming] = useState(false);

  async function load() {
    const [m, p, a, l] = await Promise.all([
      supabase
        .from("matches")
        .select(
          "opponent, match_date, is_home, location, score_for, score_against, status",
        )
        .eq("id", id)
        .single(),
      supabase
        .from("players")
        .select("id, name, is_reserve, is_active")
        .order("is_reserve")
        .order("name"),
      supabase
        .from("availability")
        .select("player_id, is_available")
        .eq("match_id", id),
      supabase
        .from("lineup")
        .select("player_id, is_starter")
        .eq("match_id", id),
    ]);

    if (m.error || p.error || a.error || l.error) {
      setError("Gegevens laden mislukt.");
      return;
    }
    setMatch(m.data);
    setUpcoming(
      m.data.status === "planned" &&
        m.data.match_date >= new Date().toISOString().slice(0, 10),
    );
    setScoreFor(m.data.score_for?.toString() ?? "");
    setScoreAgainst(m.data.score_against?.toString() ?? "");
    setEditOpponent(m.data.opponent ?? "");
    setEditDate(m.data.match_date);
    setEditIsHome(m.data.is_home);
    setEditLocation(m.data.location ?? "");
    // Spelers die het team hebben verlaten blijven alleen zichtbaar als ze bij deze wedstrijd horen.
    const linked = new Set([
      ...(a.data ?? []).map((r) => r.player_id),
      ...(l.data ?? []).map((r) => r.player_id),
    ]);
    setPlayers(
      (p.data ?? []).filter((pl) => pl.is_active || linked.has(pl.id)),
    );
    setAvailable(
      Object.fromEntries(
        (a.data ?? []).map((r) => [r.player_id, r.is_available]),
      ),
    );
    // "Nog niet zeker" apart ophalen: bestaat het veld nog niet (SQL niet bijgewerkt), dan blijft dit leeg.
    supabase
      .from("availability")
      .select("player_id, is_maybe")
      .eq("match_id", id)
      .then(({ data }) =>
        setMaybe(
          Object.fromEntries(
            (data ?? [])
              .filter((r) => r.is_maybe)
              .map((r) => [r.player_id, true]),
          ),
        ),
      );
    setLineup(
      Object.fromEntries(
        (l.data ?? []).map((r) => [
          r.player_id,
          r.is_starter ? "starter" : "reserve",
        ]),
      ),
    );
    // 180's en finishes apart ophalen: bestaat de tabel nog niet (SQL niet gedraaid), dan blijft dit leeg.
    supabase
      .from("highlights")
      .select("id, player_id, kind, value")
      .eq("match_id", id)
      .order("created_at")
      .then(({ data }) => setHighlights((data as Highlight[] | null) ?? []));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function setAvailability(playerId: string, isAvailable: boolean) {
    setError("");
    // Een handmatige keuze haalt ook "nog niet zeker" weg. Bestaat dat veld nog niet, dan zonder.
    let { error } = await supabase.from("availability").upsert({
      match_id: id,
      player_id: playerId,
      is_available: isAvailable,
      is_maybe: false,
    });
    if (error) {
      ({ error } = await supabase.from("availability").upsert({
        match_id: id,
        player_id: playerId,
        is_available: isAvailable,
      }));
    }

    if (error) {
      setError("Beschikbaarheid opslaan mislukt.");
      return;
    }
    setAvailable((prev) => ({ ...prev, [playerId]: isAvailable }));
    setMaybe((prev) => ({ ...prev, [playerId]: false }));
  }

  async function saveMatch(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const update = {
      opponent: editOpponent.trim(),
      match_date: editDate,
      is_home: editIsHome,
      location: editLocation.trim() || null,
    };

    const { error } = await supabase
      .from("matches")
      .update(update)
      .eq("id", id);

    if (error) {
      setError("Wedstrijd opslaan mislukt.");
      return;
    }
    setMatch((prev) => (prev ? { ...prev, ...update } : prev));
  }

  async function saveResult(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const filled = [scoreFor, scoreAgainst].filter((v) => v !== "").length;
    if (filled === 1) {
      setError("Vul beide scores in, of laat beide leeg.");
      return;
    }
    const both = filled === 2;
    const update = {
      score_for: both ? Number(scoreFor) : null,
      score_against: both ? Number(scoreAgainst) : null,
      ...(both && { status: "played" }),
    };

    const { error } = await supabase
      .from("matches")
      .update(update)
      .eq("id", id);

    if (error) {
      setError("Uitslag opslaan mislukt.");
      return;
    }
    setMatch((prev) => (prev ? { ...prev, ...update } : prev));
  }

  async function setRole(playerId: string, role: Role) {
    setError("");
    const { error } =
      role === "none"
        ? await supabase
            .from("lineup")
            .delete()
            .eq("match_id", id)
            .eq("player_id", playerId)
        : await supabase.from("lineup").upsert({
            match_id: id,
            player_id: playerId,
            is_starter: role === "starter",
          });

    if (error) {
      setError("Opstelling opslaan mislukt.");
      return;
    }
    setLineup((prev) => ({ ...prev, [playerId]: role }));
  }

  async function addHighlight(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!hlPlayer) {
      setError("Kies eerst een speler.");
      return;
    }
    const value = hlKind === "finish" ? Number(hlValue) : null;
    if (hlKind === "finish" && !(value && value >= 100 && value <= 170)) {
      setError("Een hoge finish ligt tussen 100 en 170.");
      return;
    }
    const { data, error } = await supabase
      .from("highlights")
      .insert({ match_id: id, player_id: hlPlayer, kind: hlKind, value })
      .select("id, player_id, kind, value")
      .single();
    if (error || !data) {
      setError(
        "Opslaan mislukt. Is supabase/hoogtepunten.sql al gedraaid in Supabase?",
      );
      return;
    }
    setHighlights((prev) => [...prev, data as Highlight]);
    setHlValue("");
  }

  async function removeHighlight(highlightId: string) {
    setError("");
    const { error } = await supabase
      .from("highlights")
      .delete()
      .eq("id", highlightId);
    if (error) {
      setError("Verwijderen mislukt.");
      return;
    }
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
  }

  const nameOf = (playerId: string) =>
    players.find((p) => p.id === playerId)?.name ?? "Onbekend";
  // Eerst wie er speelde, daarna de rest.
  const hlCandidates = [
    ...players.filter((p) => lineup[p.id]),
    ...players.filter((p) => !lineup[p.id] && p.is_active),
  ];

  const starters = players.filter((p) => lineup[p.id] === "starter");
  const reserves = players.filter((p) => lineup[p.id] === "reserve");

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <Link href="/wedstrijden" className="text-sm text-green-700">
        ← Wedstrijden
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{match?.opponent || "Wedstrijd"}</h1>
        {match && (
          <p className="text-sm text-green-900/60">
            {new Date(match.match_date).toLocaleDateString("nl-NL", {
              dateStyle: "full",
            })}
            {" · "}
            <span className="font-semibold">
              {match.is_home ? "Thuiswedstrijd" : "Uitwedstrijd"}
            </span>
            {match.location && ` · ${match.location}`}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isAdmin && upcoming && match && (
        <AskAvailability
          opponent={match.opponent}
          matchDate={match.match_date}
          isHome={match.is_home}
          players={players}
          available={available}
          maybe={maybe}
        />
      )}

      {match && match.score_for !== null && match.score_against !== null && (
        <div className="flex items-center gap-3">
          <span className="font-semibold">Uitslag</span>
          <ScoreBadge
            scoreFor={match.score_for}
            scoreAgainst={match.score_against}
          />
          <span className="text-sm text-green-900/60">
            wij - {match.opponent || "tegenstander"}
          </span>
        </div>
      )}

      {starters.length + reserves.length === 0 ? (
        <p className="text-green-900/70">De opstelling is nog niet bepaald.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 font-semibold">Opstelling</h2>
            <ul className="space-y-1">
              {starters.map((p) => (
                <li key={p.id} className="rounded bg-green-100 px-2 py-1">
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
          {reserves.length > 0 && (
            <div>
              <h2 className="mb-1 font-semibold">Reserve</h2>
              <ul className="space-y-1">
                {reserves.map((p) => (
                  <li key={p.id} className="rounded border px-2 py-1">
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(highlights.length > 0 || isAdmin) && (
        <section className="space-y-2 rounded border bg-white p-3">
          <h2 className="font-semibold">180&apos;s en hoge finishes</h2>
          {highlights.length === 0 && (
            <p className="text-sm text-green-900/60">Nog niets ingevuld.</p>
          )}
          <ul className="space-y-1">
            {highlights.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-2 rounded bg-green-50 px-2 py-1"
              >
                <span>
                  <span className="font-semibold">{nameOf(h.player_id)}</span>
                  {" · "}
                  {h.kind === "180" ? "180" : `finish ${h.value}`}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => removeHighlight(h.id)}
                    aria-label="Verwijderen"
                    className="px-2 text-red-600"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isAdmin && (
            <form onSubmit={addHighlight} className="flex flex-wrap gap-2">
              <select
                value={hlPlayer}
                onChange={(e) => setHlPlayer(e.target.value)}
                aria-label="Speler"
                className="rounded border border-green-300 p-2 text-gray-900"
              >
                <option value="">Speler...</option>
                {hlCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={hlKind}
                onChange={(e) => setHlKind(e.target.value as "180" | "finish")}
                aria-label="Soort"
                className="rounded border border-green-300 p-2 text-gray-900"
              >
                <option value="180">180</option>
                <option value="finish">Hoge finish</option>
              </select>
              {hlKind === "finish" && (
                <input
                  type="number"
                  min={100}
                  max={170}
                  inputMode="numeric"
                  aria-label="Finish"
                  placeholder="100-170"
                  value={hlValue}
                  onChange={(e) => setHlValue(e.target.value)}
                  className="w-24 rounded border border-green-300 p-2 text-gray-900"
                />
              )}
              <button
                type="submit"
                className="rounded bg-green-700 px-4 py-2 font-semibold text-white"
              >
                Toevoegen
              </button>
            </form>
          )}
        </section>
      )}

      {isAdmin && (
        <form
          onSubmit={saveResult}
          className="space-y-2 rounded border bg-white p-3"
        >
          <h2 className="font-semibold">Uitslag invullen</h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="Onze score"
              placeholder="Wij"
              value={scoreFor}
              onChange={(e) => setScoreFor(e.target.value)}
              className="w-20 rounded border border-green-300 p-2 text-gray-900"
            />
            <span>-</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="Score tegenstander"
              placeholder="Zij"
              value={scoreAgainst}
              onChange={(e) => setScoreAgainst(e.target.value)}
              className="w-20 rounded border border-green-300 p-2 text-gray-900"
            />
            <button
              type="submit"
              className="rounded bg-green-700 px-4 py-2 font-semibold text-white"
            >
              Opslaan
            </button>
          </div>
        </form>
      )}

      {isAdmin && (
        <details className="rounded border bg-white p-2">
          <summary className="cursor-pointer font-semibold text-green-700">
            Wedstrijd bewerken
          </summary>
          <form onSubmit={saveMatch} className="mt-2 space-y-3">
            <input
              type="text"
              placeholder="Tegenstander"
              value={editOpponent}
              onChange={(e) => setEditOpponent(e.target.value)}
              required
              className="w-full rounded border border-green-300 p-2 text-gray-900"
            />
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              required
              className="w-full rounded border border-green-300 p-2 text-gray-900"
            />
            <select
              value={editIsHome ? "home" : "away"}
              onChange={(e) => setEditIsHome(e.target.value === "home")}
              className="w-full rounded border border-green-300 p-2 text-gray-900"
            >
              <option value="home">Thuiswedstrijd</option>
              <option value="away">Uitwedstrijd</option>
            </select>
            <input
              type="text"
              placeholder="Locatie (optioneel)"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="w-full rounded border border-green-300 p-2 text-gray-900"
            />
            <button
              type="submit"
              className="rounded bg-green-700 px-4 py-2 font-semibold text-white"
            >
              Opslaan
            </button>
          </form>
        </details>
      )}

      {isAdmin && (
        <details className="rounded border bg-white p-2">
          <summary className="cursor-pointer font-semibold text-green-700">
            Opstelling aanpassen
          </summary>
          <ul className="mt-2 space-y-2">
            {players.map((p) => {
              const isAvailable = available[p.id] ?? false;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded border bg-white p-2"
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isAvailable}
                      disabled={!isAdmin}
                      onChange={(e) => setAvailability(p.id, e.target.checked)}
                    />
                    {p.name}
                    {!p.is_active && (
                      <span className="text-xs text-green-900/60">
                        (niet meer in team)
                      </span>
                    )}
                    {p.is_reserve && (
                      <span className="text-xs text-green-900/60">
                        (reserve)
                      </span>
                    )}
                  </label>
                  <select
                    value={lineup[p.id] ?? "none"}
                    disabled={!isAdmin}
                    onChange={(e) => setRole(p.id, e.target.value as Role)}
                    className="rounded border border-green-300 p-1 text-gray-900"
                  >
                    <option value="none">Niet opgesteld</option>
                    <option value="starter">Basis</option>
                    <option value="reserve">Reserve</option>
                  </select>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </main>
  );
}
