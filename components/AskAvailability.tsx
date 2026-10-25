"use client";

import { useEffect, useState } from "react";
import AvailabilityOverview from "@/components/AvailabilityOverview";
import { dateCode, encodeToken } from "@/lib/links";
import { createClient } from "@/lib/supabase/client";

type Player = { id: string; name: string; is_active?: boolean };

type Props = {
  opponent: string | null;
  matchDate: string;
  isHome: boolean;
  players: Player[];
  // Wat spelers al hebben doorgegeven voor deze wedstrijd (speler-id -> kan wel/niet).
  available: Record<string, boolean>;
  // speler-id -> true bij "nog niet zeker"
  maybe?: Record<string, boolean>;
};

// Voor de beheerder: de groepslink en de persoonlijke links om te vragen wie er kan bij één wedstrijd.
export default function AskAvailability({
  opponent,
  matchDate,
  isHome,
  players,
  available,
  maybe,
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

  // Vaste groepslink: toont altijd alle komende wedstrijden, dus één keer vastzetten is genoeg.
  const fixedLink = () =>
    `${window.location.origin}/groep/${encodeToken(teamToken)}`;
  // Groepslink alleen voor deze wedstrijd.
  const groupLink = () =>
    `${window.location.origin}/groep/${encodeToken(teamToken)}?w=${dateCode(matchDate)}`;
  const personalLink = (playerId: string) =>
    `${window.location.origin}/ik/${encodeToken(tokens[playerId])}?w=${dateCode(matchDate)}`;

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

  // Eén bericht voor de groep: per naam een eigen link, iedereen tikt op zijn eigen naam.
  function groupMessage(onlyOpen: boolean) {
    const list = askable.filter(
      (p) => !onlyOpen || !(p.id in available) || maybe?.[p.id] === true,
    );
    const lines = list.map((p) => `${p.name}: ${personalLink(p.id)}`);
    whatsApp(
      `${isHome ? "Thuiswedstrijd" : "Uitwedstrijd"} tegen ${opponentName} op ${longDate()}. Kun je? Tik op jouw eigen naam en geef het door:\n\n${lines.join("\n\n")}`,
    );
  }

  const active = players.filter((p) => p.is_active !== false);
  const askable = active.filter((p) => tokens[p.id]);
  // Wie nog helemaal niet gereageerd heeft.
  const noReply = active.filter((p) => !(p.id in available));

  return (
    <>
      {active.length > 0 && (
        <section className="space-y-3 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Wie kan er?</h2>
          <AvailabilityOverview
            players={active}
            answers={available}
            maybe={maybe}
          />
        </section>
      )}

      {teamToken && (
        <section className="space-y-3 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Vraag wie er kan</h2>

          <div className="space-y-2">
            <p className="text-sm text-green-900/70">
              Meld deze wedstrijd in de groepsapp met de vaste link. Die staat
              het best vastgezet in de groep en toont altijd alle komende
              wedstrijden.
            </p>
            <button
              onClick={() =>
                whatsApp(
                  `Nieuwe wedstrijd: ${isHome ? "thuis" : "uit"} tegen ${opponentName} op ${longDate()}. Geef door of je kunt via de vaste link: ${fixedLink()}`,
                )
              }
              className="w-full rounded bg-green-700 px-4 py-2 font-semibold text-white"
            >
              Meld wedstrijd in de groep
            </button>
            {noReply.length > 0 && (
              <button
                onClick={() =>
                  whatsApp(
                    `Herinnering: ${isHome ? "thuiswedstrijd" : "uitwedstrijd"} tegen ${opponentName} op ${longDate()}. Nog niet gereageerd: ${noReply.map((p) => p.name).join(", ")}. Geef het even door via de vaste link: ${fixedLink()}`,
                  )
                }
                className="w-full rounded border border-green-300 px-4 py-2 font-semibold text-green-900"
              >
                Herinner wie nog niet gereageerd heeft ({noReply.length})
              </button>
            )}
          </div>

          <details className="border-t pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-green-700">
              Of een link alleen voor deze wedstrijd
            </summary>
            <div className="mt-2 flex gap-2">
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
                className="rounded border border-green-300 px-4 py-2 text-sm font-semibold text-green-900"
              >
                Deel via WhatsApp
              </button>
            </div>
          </details>
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
          <div className="mt-3 space-y-2 rounded border border-green-300 p-3">
            <p className="text-sm font-semibold">
              In één bericht naar de groep
            </p>
            <p className="text-sm text-green-900/70">
              Eén bericht met per naam een eigen link. Iedereen tikt op zijn
              eigen naam en kan direct antwoorden. Let op: iedereen in de groep
              ziet daarmee ook de links van de anderen.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => groupMessage(false)}
                className="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Iedereen
              </button>
              <button
                onClick={() => groupMessage(true)}
                disabled={askable.every(
                  (p) => p.id in available && maybe?.[p.id] !== true,
                )}
                className="rounded border border-green-300 px-4 py-2 text-sm font-semibold text-green-900 disabled:opacity-40"
              >
                Alleen wie nog open staat of twijfelt
              </button>
            </div>
          </div>
          <ul className="mt-2 space-y-2">
            {askable.map((p) => {
              const answer =
                maybe?.[p.id] === true && !available[p.id]
                  ? "nog niet zeker"
                  : p.id in available
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
                            : answer === "nog niet zeker"
                              ? "text-amber-700"
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
