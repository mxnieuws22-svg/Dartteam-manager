"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIsAdmin } from "@/lib/useIsAdmin";

type Tournament = {
  id: string;
  name: string;
  tournament_date: string;
  location: string | null;
};

type Props = {
  // Op de startpagina: alleen de komende toernooien, zonder formulier.
  compact?: boolean;
};

// Ranking toernooien met hun datum. De beheerder voegt ze toe en verwijdert ze.
export default function Tournaments({ compact }: Props) {
  const supabase = createClient();
  const isAdmin = useIsAdmin();
  const [items, setItems] = useState<Tournament[]>([]);
  const [today, setToday] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("tournaments")
      .select("id, name, tournament_date, location")
      .order("tournament_date");
    setToday(new Date().toISOString().slice(0, 10));
    // Bestaat de tabel nog niet (SQL niet gedraaid), dan blijft het blok leeg.
    setItems(error ? [] : (data ?? []));
    setReady(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.from("tournaments").insert({
      name: name.trim() || "Ranking toernooi",
      tournament_date: date,
      location: location.trim() || null,
    });
    if (error) {
      setError(
        "Opslaan mislukt. Is supabase/toernooien.sql al gedraaid in Supabase?",
      );
      return;
    }
    setName("");
    setDate("");
    setLocation("");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Dit toernooi verwijderen?")) return;
    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) {
      setError("Verwijderen mislukt.");
      return;
    }
    load();
  }

  const upcoming = items.filter((t) => t.tournament_date >= today);
  const past = items
    .filter((t) => t.tournament_date < today)
    .sort((a, b) => b.tournament_date.localeCompare(a.tournament_date));

  if (!ready) return null;
  if (compact && upcoming.length === 0) return null;

  const row = (t: Tournament, muted?: boolean) => {
    const d = new Date(t.tournament_date);
    return (
      <li
        key={t.id}
        className={`flex items-center gap-3 rounded-lg border bg-white p-3 ${
          muted ? "opacity-70" : ""
        }`}
      >
        <div className="w-14 shrink-0 rounded bg-amber-100 py-1 text-center text-amber-950">
          <div className="text-xl font-bold leading-tight">{d.getDate()}</div>
          <div className="text-xs uppercase">
            {d.toLocaleDateString("nl-NL", { month: "short" })}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{t.name}</div>
          <div className="truncate text-sm text-green-900/60">
            {d.toLocaleDateString("nl-NL", { weekday: "long" })}
            {t.location && ` · ${t.location}`}
          </div>
        </div>
        {isAdmin && !compact && (
          <button onClick={() => remove(t.id)} className="text-sm text-red-600">
            Verwijderen
          </button>
        )}
      </li>
    );
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        Ranking toernooien{compact ? "" : ` (${upcoming.length})`}
      </h2>

      {isAdmin && !compact && (
        <form
          onSubmit={add}
          className="space-y-3 rounded-lg border bg-white p-4"
        >
          <input
            type="text"
            placeholder="Naam (optioneel, bijv. Ranking 3)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-green-300 p-2 text-gray-900"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded border border-green-300 p-2 text-gray-900"
          />
          <input
            type="text"
            placeholder="Locatie (optioneel)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded border border-green-300 p-2 text-gray-900"
          />
          <button
            type="submit"
            className="rounded bg-green-700 px-4 py-2 font-semibold text-white"
          >
            Toernooi toevoegen
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!compact && upcoming.length === 0 && (
        <p className="text-sm text-green-900/60">Geen toernooien gepland.</p>
      )}
      <ul className="space-y-2">{upcoming.map((t) => row(t))}</ul>

      {!compact && past.length > 0 && (
        <>
          <h3 className="pt-2 font-semibold text-green-900/70">
            Eerdere toernooien
          </h3>
          <ul className="space-y-2">{past.map((t) => row(t, true))}</ul>
        </>
      )}
    </section>
  );
}
