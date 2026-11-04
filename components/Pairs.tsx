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
  // De beheerder kan koppels toevoegen en weghalen; anderen zien alleen de lijst.
  editable?: boolean;
};

// De koppels van een wedstrijd en of ze wonnen (gespeeld na de 501).
export default function Pairs({ matchId, players, editable }: Props) {
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
      <ul className="space-y-1">
        {pairs.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded bg-green-50 px-2 py-1"
          >
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
            {editable && (
              <button
                onClick={() => remove(p.id)}
                aria-label="Koppel verwijderen"
                className="px-2 text-red-600"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
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
