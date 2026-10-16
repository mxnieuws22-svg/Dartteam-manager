"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Player = { id: string; name: string; is_active?: boolean };

type Props = {
  matchId: string;
  opponent: string | null;
  matchDate: string;
  isHome: boolean;
  players: Player[];
  // Wat spelers al hebben doorgegeven voor deze wedstrijd (speler-id -> kan wel/niet).
  available: Record<string, boolean>;
};

// Voor de beheerder: de groepslink en de persoonlijke links om te vragen wie er kan bij één wedstrijd.
export default function AskAvailability({
  matchId,
  opponent,
  matchDate,
  isHome,
  players,
  available,
}: Props) {
  const supabase = createClient();
  const [teamToken, setTeamToken] = useState("");
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");

  useEffect(() => {
    supabase
      .from("team_link")
      .select("token")
      .maybeSingle()
      .then(({ data }) => setTeamToken(data?.token ?? ""));
    supabase
      .from("player_tokens")
      .select("player_id, token")
      .then(({ data }) =>
        setTokens(
          Object.fromEntries((data ?? []).map((t) => [t.player_id, t.token])),
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupLink = () =>
    `${window.location.origin}/groep/${teamToken}?w=${matchId}`;
  const personalLink = (playerId: string) =>
    `${window.location.origin}/ik/${tokens[playerId]}?w=${matchId}`;

  const longDate = () =>
    new Date(matchDate).toLocaleDateString("nl-NL", { dateStyle: "full" });
  const opponentName = opponent || "de tegenstander";

  async function copy(key: string, link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  function whatsApp(text: string) {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener",
    );
  }

  const askable = players.filter((p) => p.is_active !== false && tokens[p.id]);

  return (
    <>
      {teamToken && (
        <section className="space-y-2 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Vraag wie er kan</h2>
          <p className="text-sm text-green-900/70">
            Stuur deze link naar de groep: spelers kiezen hun naam en geven voor
            alleen deze wedstrijd aan of ze kunnen.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => copy("groep", groupLink())}
              className="rounded border border-green-300 px-4 py-2 text-sm font-semibold text-green-900"
            >
              {copied === "groep" ? "Gekopieerd!" : "Kopieer link"}
            </button>
            <button
              onClick={() =>
                whatsApp(
                  `${isHome ? "Thuiswedstrijd" : "Uitwedstrijd"} tegen ${opponentName} op ${longDate()}. Kun je? Geef het door via deze link: ${groupLink()}`,
                )
              }
              className="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Deel via WhatsApp
            </button>
          </div>
        </section>
      )}

      {askable.length > 0 && (
        <details className="rounded-lg border bg-white p-4">
          <summary className="cursor-pointer font-semibold text-green-700">
            Persoonlijke links per speler
          </summary>
          <p className="mt-2 text-sm text-green-900/70">
            Elke speler heeft een eigen link voor alleen deze wedstrijd. Handig
            om iemand te herinneren die nog niet gereageerd heeft.
          </p>
          <ul className="mt-2 space-y-2">
            {askable.map((p) => {
              const answer =
                p.id in available
                  ? available[p.id]
                    ? "kan"
                    : "kan niet"
                  : "nog niet gereageerd";
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div
                      className={`text-sm ${
                        answer === "kan"
                          ? "text-green-700"
                          : answer === "kan niet"
                            ? "text-red-600"
                            : "text-green-900/60"
                      }`}
                    >
                      {answer}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    <button
                      onClick={() => copy(p.id, personalLink(p.id))}
                      className="text-green-700"
                    >
                      {copied === p.id ? "Gekopieerd!" : "Kopieer"}
                    </button>
                    <button
                      onClick={() =>
                        whatsApp(
                          `Hoi ${p.name}, ${isHome ? "thuiswedstrijd" : "uitwedstrijd"} tegen ${opponentName} op ${longDate()}. Kun je? Geef het door via jouw eigen link: ${personalLink(p.id)}`,
                        )
                      }
                      className="text-green-700"
                    >
                      WhatsApp
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </>
  );
}
