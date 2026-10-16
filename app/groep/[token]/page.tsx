"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AnswerButtons, {
  answerArgs,
  toAnswer,
  type Answer,
} from "@/components/AnswerButtons";
import AvailabilityOverview from "@/components/AvailabilityOverview";
import { decodeToken, encodeToken, isMatch } from "@/lib/links";
import { createClient } from "@/lib/supabase/client";

type Player = { id: string; name: string };

type UpcomingMatch = {
  id: string;
  opponent: string | null;
  match_date: string;
  is_home: boolean;
  location: string | null;
  availability: Record<string, boolean>;
  maybe?: Record<string, boolean>;
};

type Team = { players: Player[]; matches: UpcomingMatch[] };

const STORAGE_KEY = "dartteam-speler";
const NAME_KEY = "dartteam-speler-naam";

export default function GroepPage() {
  return (
    <Suspense fallback={<p className="p-4">Laden...</p>}>
      <Groep />
    </Suspense>
  );
}

function Groep() {
  const { token: linkToken } = useParams<{ token: string }>();
  // In de link staat een korte code; de database gebruikt de lange uuid.
  const token = decodeToken(linkToken);
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
      } else {
        // Eerder je persoonlijke link geopend op dit toestel: dan weten we wie je bent.
        // Alleen als de naam precies één speler is, anders liever zelf laten kiezen.
        const name = localStorage.getItem(NAME_KEY)?.trim().toLowerCase();
        const matches = name
          ? loaded.players.filter((p) => p.name.trim().toLowerCase() === name)
          : [];
        if (matches.length === 1) {
          setPlayerId(matches[0].id);
          localStorage.setItem(STORAGE_KEY, matches[0].id);
        }
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

  async function answer(matchId: string, given: Answer) {
    setError("");
    const { error } = await supabase.rpc("set_team_availability", {
      p_token: token,
      p_player_id: playerId,
      p_match_id: matchId,
      ...answerArgs(given),
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
                    availability: {
                      ...m.availability,
                      [playerId]: given === "yes",
                    },
                    maybe: { ...m.maybe, [playerId]: given === "maybe" },
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
  const selected = only ? team.matches.filter((m) => isMatch(m, only)) : [];
  const single = selected[0];
  const shown = selected.length > 0 ? selected : team.matches;

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
          const mine = playerId
            ? toAnswer(m.availability[playerId], m.maybe?.[playerId])
            : undefined;
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
              <AnswerButtons
                value={mine}
                disabled={!playerId}
                onAnswer={(given) => answer(m.id, given)}
              />
              <AvailabilityOverview
                players={team.players}
                answers={m.availability}
                maybe={m.maybe}
                me={playerId}
              />
            </li>
          );
        })}
      </ul>

      {single && team.matches.length > selected.length && (
        <p className="text-center text-sm">
          <Link
            href={`/groep/${encodeToken(token)}`}
            className="text-green-700 underline"
          >
            Alle komende wedstrijden bekijken
          </Link>
        </p>
      )}
    </main>
  );
}
