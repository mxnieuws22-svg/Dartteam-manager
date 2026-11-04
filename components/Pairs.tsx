"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Pair = {
  id: string;
  player_a: string;
  player_b: string;
  won: boolean | null;
  legs_won: number | null;
  legs_lost: number | null;
};

type Props = {
  matchId: string;
  // Spelers om uit te kiezen; zet wie er speelde vooraan.
  players: { id: string; name: string }[];
  // De beheerder kan koppels toevoegen, wisselen en weghalen; anderen zien alleen de lijst.
  editable?: boolean;
  // De spelers in de basis, om koppels uit te loten.
  starterIds?: string[];
};

// De koppels van een wedstrijd en of ze wonnen (gespeeld na de 501).
export default function Pairs({
  matchId,
  players,
  editable,
  starterIds = [],
}: Props) {
  const supabase = createClient();
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [result, setResult] = useState("");
  const [legsWon, setLegsWon] = useState("");
  const [legsLost, setLegsLost] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("pairs")
      .select("id, player_a, player_b, won, legs_won, legs_lost")
      .eq("match_id", matchId)
      .order("created_at");
    // Bestaat de tabel nog niet (SQL niet gedraaid), dan blijft het leeg.
    setPairs(error ? [] : (data ?? []));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Onbekend";

  // Past één koppel aan in de database en in het scherm.
  async function patch(id: string, changes: Partial<Pair>) {
    const { error } = await supabase.from("pairs").update(changes).eq("id", id);
    if (error) {
      setError("Opslaan mislukt.");
      return false;
    }
    setPairs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    );
    return true;
  }

  // Een andere speler in een koppel zetten. Staat die speler al in een koppel van deze wedstrijd,
  // dan wisselen de twee van plek.
  async function changePlayer(
    pair: Pair,
    slot: "player_a" | "player_b",
    to: string,
  ) {
    setError("");
    const from = pair[slot];
    if (!to || to === from) return;
    const other = slot === "player_a" ? "player_b" : "player_a";

    if (pair[other] === to) {
      await patch(pair.id, {
        player_a: pair.player_b,
        player_b: pair.player_a,
      });
      return;
    }
    const elsewhere = pairs.find(
      (p) => p.id !== pair.id && (p.player_a === to || p.player_b === to),
    );
    if (!(await patch(pair.id, { [slot]: to }))) return;
    if (elsewhere) {
      const theirSlot = elsewhere.player_a === to ? "player_a" : "player_b";
      await patch(elsewhere.id, { [theirSlot]: from });
    }
  }

  // Loot van de spelers in de basis nieuwe koppels, twee aan twee.
  async function draw() {
    if (
      pairs.length > 0 &&
      !confirm("De huidige koppels vervangen door geloote koppels?")
    ) {
      return;
    }
    setError("");
    const ids = [...starterIds];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const rows = [];
    for (let i = 0; i + 1 < ids.length; i += 2) {
      rows.push({ match_id: matchId, player_a: ids[i], player_b: ids[i + 1] });
    }
    const del = await supabase.from("pairs").delete().eq("match_id", matchId);
    const ins = del.error
      ? del
      : rows.length > 0
        ? await supabase.from("pairs").insert(rows)
        : del;
    if (ins.error) {
      setError(
        "Loten mislukt. Is supabase/koppels.sql al gedraaid in Supabase?",
      );
      return;
    }
    load();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!a || !b || a === b) {
      setError("Kies twee verschillende spelers.");
      return;
    }
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const { error } = await supabase.from("pairs").insert({
      match_id: matchId,
      player_a: a,
      player_b: b,
      won: result === "" ? null : result === "won",
      legs_won: num(legsWon),
      legs_lost: num(legsLost),
    });
    if (error) {
      setError(
        "Opslaan mislukt. Is supabase/koppels.sql al gedraaid in Supabase?",
      );
      return;
    }
    setA("");
    setB("");
    setResult("");
    setLegsWon("");
    setLegsLost("");
    load();
  }

  async function remove(id: string) {
    setError("");
    const { error } = await supabase.from("pairs").delete().eq("id", id);
    if (error) {
      setError("Verwijderen mislukt.");
      return;
    }
    setPairs((prev) => prev.filter((p) => p.id !== id));
  }

  if (!editable && pairs.length === 0) return null;

  const field = "rounded border border-green-300 p-2 text-gray-900";

  return (
    <section className="space-y-2 rounded border bg-white p-3">
      <h2 className="font-semibold">Koppels</h2>
      {pairs.length === 0 && (
        <p className="text-sm text-green-900/60">Nog geen koppels ingevuld.</p>
      )}
      <ul className="space-y-2">
        {pairs.map((p) => (
          <li
            key={p.id}
            className="space-y-1.5 rounded bg-green-50 px-2 py-1.5"
          >
            {editable ? (
              <>
                <div className="flex items-center gap-1.5">
                  {(["player_a", "player_b"] as const).map((slot, i) => (
                    <span key={slot} className="contents">
                      {i === 1 && <span>&amp;</span>}
                      <select
                        value={p[slot]}
                        onChange={(e) => changePlayer(p, slot, e.target.value)}
                        aria-label={`Koppel speler ${i + 1}`}
                        className="min-w-0 flex-1 rounded border border-green-300 bg-white p-1.5 text-gray-900"
                      >
                        {players.map((pl) => (
                          <option key={pl.id} value={pl.id}>
                            {pl.name}
                          </option>
                        ))}
                      </select>
                    </span>
                  ))}
                  <button
                    onClick={() => remove(p.id)}
                    aria-label="Koppel verwijderen"
                    className="px-2 text-red-600"
                  >
                    ×
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <select
                    value={p.won === null ? "" : p.won ? "won" : "lost"}
                    onChange={(e) =>
                      patch(p.id, {
                        won:
                          e.target.value === ""
                            ? null
                            : e.target.value === "won",
                      })
                    }
                    aria-label="Uitslag koppel"
                    className="rounded border border-green-300 bg-white p-1.5 text-gray-900"
                  >
                    <option value="">Uitslag nog niet bekend</option>
                    <option value="won">Gewonnen</option>
                    <option value="lost">Verloren</option>
                  </select>
                </div>
              </>
            ) : (
              <span>
                <span className="font-semibold">
                  {nameOf(p.player_a)} &amp; {nameOf(p.player_b)}
                </span>
                {p.won !== null && (
                  <span
                    className={`ml-2 text-sm font-semibold ${
                      p.won ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {p.won ? "gewonnen" : "verloren"}
                  </span>
                )}
                {(p.legs_won !== null || p.legs_lost !== null) && (
                  <span className="ml-2 text-sm text-green-900/70">
                    {p.legs_won ?? 0}-{p.legs_lost ?? 0} legs
                  </span>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {editable && starterIds.length >= 2 && (
        <button
          onClick={draw}
          className="rounded border border-green-300 px-4 py-2 font-semibold text-green-900"
        >
          Loot koppels uit de basis
        </button>
      )}
      {editable && (
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <select
            value={a}
            onChange={(e) => setA(e.target.value)}
            aria-label="Eerste speler"
            className={field}
          >
            <option value="">Speler 1...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={b}
            onChange={(e) => setB(e.target.value)}
            aria-label="Tweede speler"
            className={field}
          >
            <option value="">Speler 2...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            aria-label="Uitslag koppel"
            className={field}
          >
            <option value="">Uitslag nog niet bekend</option>
            <option value="won">Gewonnen</option>
            <option value="lost">Verloren</option>
          </select>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label="Legs gewonnen"
            placeholder="Won"
            value={legsWon}
            onChange={(e) => setLegsWon(e.target.value)}
            className={`w-16 ${field}`}
          />
          <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label="Legs verloren"
            placeholder="Verl."
            value={legsLost}
            onChange={(e) => setLegsLost(e.target.value)}
            className={`w-16 ${field}`}
          />
          <button
            type="submit"
            className="rounded bg-green-700 px-4 py-2 font-semibold text-white"
          >
            Koppel toevoegen
          </button>
        </form>
      )}
    </section>
  );
}
