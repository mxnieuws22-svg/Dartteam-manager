"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Player = { id: string; name: string };

type UpcomingMatch = {
  id: string;
  opponent: string | null;
  match_date: string;
  is_home: boolean;
  location: string | null;
  availability: Record<string, boolean>;
};

type Team = { players: Player[]; matches: UpcomingMatch[] };

const STORAGE_KEY = "dartteam-speler";

export default function GroepPage() {
  return (
    <Suspense fallback={<p className="p-4">Laden...</p>}>
      <Groep />
    </Suspense>
  );
}

function Groep() {
  const { token } = useParams<{ token: string }>();
  const only = useSearchParams().get("w");
  const supabase = createClient();
  const [team, setTeam] = useState<Team | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "invalid">("loading");
  const [playerId, setPlayerId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const { data, error } = await supabase.rpc("team_availability", {
      p_token: token,
    });

    if (error) {
      setError("Laden mislukt. Probeer het later opnieuw.");
      setState("invalid");
      return;
    }
    if (!data) {
      setState("invalid");
      return;
    }
    const loaded = data as Team;
    setTeam(loaded);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && loaded.players.some((p) => p.id === saved)) {
        setPlayerId(saved);
      }
    } catch {
      // opslaan van de keuze is een gemak, geen vereiste
    }
    setState("ok");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function choosePlayer(id: string) {
    setPlayerId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // zie hierboven
    }
  }

  async function answer(matchId: string, available: boolean) {
    setError("");
    const { error } = await supabase.rpc("set_team_availability", {
      p_token: token,
      p_player_id: playerId,
      p_match_id: matchId,
      p_available: available,
    });

    if (error) {
      setError("Opslaan mislukt. Probeer het opnieuw.");
      return;
    }

    fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, playerId, matchId }),
    }).catch(() => {});
    setTeam((prev) =>
      prev
        ? {
            ...prev,
            matches: prev.matches.map((m) =>
              m.id === matchId
                ? {
                    ...m,
                    availability: { ...m.availability, [playerId]: available },
                  }
                : m,
            ),
          }
        : prev,
    );
  }

  if (state === "loading") return <p className="p-4">Laden...</p>;

  if (state === "invalid" || !team) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        <h1 className="text-2xl font-bold">Link werkt niet</h1>
        <p>
          {error || "Deze link is ongeldig. Vraag de beheerder om een nieuwe."}
        </p>
      </main>
    );
  }

  // Met ?w=<wedstrijd> alleen die ene wedstrijd tonen, zolang die nog komt.
  const single = only ? team.matches.find((m) => m.id === only) : undefined;
  const shown = single ? [single] : team.matches;

  const names = (match: UpcomingMatch, value: boolean | undefined) =>
    team.players
      .filter((p) => match.availability[p.id] === value)
      .map((p) => p.name);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">
          {single
            ? `Kun je op ${new Date(single.match_date).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}?`
            : "Kun je?"}
        </h1>
        <p className="text-green-900/70">
          Kies je naam en geef aan of je kunt. Je kunt het later nog wijzigen.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="font-semibold">Wie ben jij?</span>
        <select
          value={playerId}
          onChange={(e) => choosePlayer(e.target.value)}
          className="w-full rounded border border-green-300 bg-white p-3 text-gray-900"
        >
          <option value="">Kies je naam...</option>
          {team.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {shown.length === 0 && <p>Er staan geen wedstrijden gepland.</p>}

      <ul className="space-y-3">
        {shown.map((m) => {
          const date = new Date(m.match_date).toLocaleDateString("nl-NL", {
            dateStyle: "full",
          });
          const mine = playerId ? m.availability[playerId] : undefined;
          const yes = names(m, true);
          const no = names(m, false);
          const open = names(m, undefined);
          return (
            <li key={m.id} className="space-y-3 rounded-lg border bg-white p-4">
              <div>
                <div className="text-lg font-bold text-green-700">
                  {m.opponent || "Tegenstander onbekend"}
                </div>
                <div className="text-sm text-green-900/70">
                  {date} · {m.is_home ? "Thuis" : "Uit"}
                  {m.location && ` · ${m.location}`}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={!playerId}
                  onClick={() => answer(m.id, true)}
                  className={`rounded px-4 py-3 font-semibold disabled:opacity-40 ${
                    mine === true
                      ? "bg-green-700 text-white"
                      : "border border-green-300 text-green-900"
                  }`}
                >
                  Ik kan
                </button>
                <button
                  disabled={!playerId}
                  onClick={() => answer(m.id, false)}
                  className={`rounded px-4 py-3 font-semibold disabled:opacity-40 ${
                    mine === false
                      ? "bg-red-600 text-white"
                      : "border border-green-300 text-green-900"
                  }`}
                >
                  Ik kan niet
                </button>
              </div>
              <div className="space-y-1 border-t pt-3 text-sm">
                <p>
                  <span className="font-semibold text-green-700">Kunnen:</span>{" "}
                  {yes.length > 0 ? yes.join(", ") : "-"}
                </p>
                <p>
                  <span className="font-semibold text-red-600">
                    Kunnen niet:
                  </span>{" "}
                  {no.length > 0 ? no.join(", ") : "-"}
                </p>
                <p className="text-green-900/60">
                  <span className="font-semibold">Nog niet gereageerd:</span>{" "}
                  {open.length > 0 ? open.join(", ") : "-"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {single && team.matches.length > 1 && (
        <p className="text-center text-sm">
          <Link href={`/groep/${token}`} className="text-green-700 underline">
            Alle komende wedstrijden bekijken
          </Link>
        </p>
      )}
    </main>
  );
}
