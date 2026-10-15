"use client";

import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type UpcomingMatch = {
  id: string;
  opponent: string | null;
  match_date: string;
  is_home: boolean;
  location: string | null;
  is_available: boolean | null;
};

type Me = { name: string; matches: UpcomingMatch[] };

export default function IkPage() {
  return (
    <Suspense fallback={<p className="p-4">Laden...</p>}>
      <Beschikbaarheid />
    </Suspense>
  );
}

function Beschikbaarheid() {
  const { token } = useParams<{ token: string }>();
  const supabase = createClient();
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "invalid">("loading");
  const [error, setError] = useState("");

  async function load() {
    const { data, error } = await supabase.rpc("my_availability", {
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
    setMe(data as Me);
    setState("ok");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function answer(matchId: string, available: boolean) {
    setError("");
    const { error } = await supabase.rpc("set_my_availability", {
      p_token: token,
      p_match_id: matchId,
      p_available: available,
    });

    if (error) {
      setError("Opslaan mislukt. Probeer het opnieuw.");
      return;
    }
    setMe((prev) =>
      prev
        ? {
            ...prev,
            matches: prev.matches.map((m) =>
              m.id === matchId ? { ...m, is_available: available } : m,
            ),
          }
        : prev,
    );
  }

  if (state === "loading") return <p className="p-4">Laden...</p>;

  if (state === "invalid" || !me) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        <h1 className="text-2xl font-bold">Link werkt niet</h1>
        <p>
          {error || "Deze link is ongeldig. Vraag de beheerder om een nieuwe."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Hoi {me.name}!</h1>
        <p className="text-green-900/70">
          Geef hieronder aan of je kunt. Je kunt het later nog wijzigen.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {me.matches.length === 0 && <p>Er staan geen wedstrijden gepland.</p>}

      <ul className="space-y-3">
        {me.matches.map((m) => {
          const date = new Date(m.match_date).toLocaleDateString("nl-NL", {
            dateStyle: "full",
          });
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
                  onClick={() => answer(m.id, true)}
                  className={`rounded px-4 py-3 font-semibold ${
                    m.is_available === true
                      ? "bg-green-700 text-white"
                      : "border border-green-300 text-green-900"
                  }`}
                >
                  Ik kan
                </button>
                <button
                  onClick={() => answer(m.id, false)}
                  className={`rounded px-4 py-3 font-semibold ${
                    m.is_available === false
                      ? "bg-red-600 text-white"
                      : "border border-green-300 text-green-900"
                  }`}
                >
                  Ik kan niet
                </button>
              </div>
              {m.is_available === null && (
                <p className="text-sm text-green-900/60">
                  Je hebt nog niet gereageerd.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
