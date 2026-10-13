"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Player = {
  id: string;
  name: string;
  is_reserve: boolean;
};

export default function SpelersPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [isReserve, setIsReserve] = useState(false);
  const [error, setError] = useState("");

  async function loadPlayers() {
    const { data, error } = await supabase
      .from("players")
      .select("id, name, is_reserve")
      .order("is_reserve")
      .order("name");

    if (error) {
      setError("Spelers laden mislukt.");
      return;
    }
    setPlayers(data ?? []);
  }

  useEffect(() => {
    loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const { error } = await supabase
      .from("players")
      .insert({ name: name.trim(), is_reserve: isReserve });

    if (error) {
      setError("Speler toevoegen mislukt.");
      return;
    }
    setName("");
    setIsReserve(false);
    loadPlayers();
  }

  async function deletePlayer(id: string) {
    if (!confirm("Deze speler verwijderen?")) return;

    const { error } = await supabase.from("players").delete().eq("id", id);

    if (error) {
      setError("Speler verwijderen mislukt.");
      return;
    }
    loadPlayers();
  }

  const starters = players.filter((p) => !p.is_reserve);
  const reserves = players.filter((p) => p.is_reserve);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Spelers</h1>

      <form onSubmit={addPlayer} className="space-y-3 rounded-lg border bg-white p-4">
        <input
          type="text"
          placeholder="Naam van de speler"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded border border-green-300 p-2 text-gray-900"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isReserve}
            onChange={(e) => setIsReserve(e.target.checked)}
          />
          Reserve
        </label>
        <button
          type="submit"
          className="rounded bg-green-700 px-4 py-2 font-semibold text-white"
        >
          Toevoegen
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Basisspelers ({starters.length})
        </h2>
        <ul className="space-y-2">
          {starters.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border bg-white p-2"
            >
              {p.name}
              <button
                onClick={() => deletePlayer(p.id)}
                className="text-sm text-red-600"
              >
                Verwijderen
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Reserves ({reserves.length})
        </h2>
        <ul className="space-y-2">
          {reserves.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border bg-white p-2"
            >
              {p.name}
              <button
                onClick={() => deletePlayer(p.id)}
                className="text-sm text-red-600"
              >
                Verwijderen
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}