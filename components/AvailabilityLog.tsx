"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Entry = {
  id: string;
  player_id: string;
  match_id: string;
  old_answer: string;
  new_answer: string;
  created_at: string;
};

type Props = {
  matchId: string;
  // De namen van de spelers, om de regels leesbaar te maken.
  players: { id: string; name: string }[];
  // Verandert zodra er iets is ingevuld, zodat het logboek meeloopt.
  refreshKey?: unknown;
};

const color: Record<string, string> = {
  kan: "text-green-700",
  "kan niet": "text-red-600",
  "nog niet zeker": "text-amber-700",
  open: "text-green-900/60",
};

function when(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `vandaag ${time}`
    : `${d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} ${time}`;
}

// Voor de beheerder: de laatste wijzigingen in wie kan, voor deze wedstrijd.
export default function AvailabilityLog({
  matchId,
  players,
  refreshKey,
}: Props) {
  const supabase = createClient();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    supabase
      .from("availability_log")
      .select("id, player_id, match_id, old_answer, new_answer, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data, error }) => {
        // Bestaat het logboek nog niet (SQL niet gedraaid), dan blijft het leeg.
        setEntries(error ? [] : (data ?? []));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, refreshKey]);

  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Onbekend";

  return (
    <details className="border-t pt-3">
      <summary className="cursor-pointer text-sm font-semibold text-green-700">
        Laatste wijzigingen{entries.length > 0 ? ` (${entries.length})` : ""}
      </summary>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-green-900/60">
          Nog geen wijzigingen. Het logboek begint zodra{" "}
          <code>supabase/wijzigingen.sql</code> is gedraaid.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="font-semibold">{nameOf(e.player_id)}</span>:{" "}
              <span className={color[e.old_answer]}>
                {e.old_answer === "open" ? "nog niet gereageerd" : e.old_answer}
              </span>{" "}
              →{" "}
              <span className={`font-semibold ${color[e.new_answer]}`}>
                {e.new_answer === "open" ? "weggehaald" : e.new_answer}
              </span>
              <span className="block text-xs text-green-900/60">
                {when(e.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
