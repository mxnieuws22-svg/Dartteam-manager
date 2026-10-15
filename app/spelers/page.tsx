"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PushToggle from "@/components/PushToggle";
import { useIsAdmin } from "@/lib/useIsAdmin";

type Player = {
  id: string;
  name: string;
  is_reserve: boolean;
};

export default function SpelersPage() {
  const supabase = createClient();
  const isAdmin = useIsAdmin();
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [isReserve, setIsReserve] = useState(false);
  const [error, setError] = useState("");
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");
  const [teamToken, setTeamToken] = useState("");

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

  useEffect(() => {
    if (!isAdmin) return;
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
  }, [isAdmin]);

  function linkFor(p: Player) {
    return `${window.location.origin}/ik/${tokens[p.id]}`;
  }

  async function copyLink(p: Player) {
    await navigator.clipboard.writeText(linkFor(p));
    setCopied(p.id);
    setTimeout(() => setCopied(""), 2000);
  }

  function groupUrl() {
    return `${window.location.origin}/groep/${teamToken}`;
  }

  async function copyGroupLink() {
    await navigator.clipboard.writeText(groupUrl());
    setCopied("groep");
    setTimeout(() => setCopied(""), 2000);
  }

  function whatsappGroup() {
    const text = `Geef via deze link aan of je kunt voor de komende wedstrijden van Darten met je Hart: ${groupUrl()}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener",
    );
  }

  function whatsappLink(p: Player) {
    const text = `Hoi ${p.name}, geef via deze link aan of je kunt voor de wedstrijden van Darten met je Hart: ${linkFor(p)}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener",
    );
  }

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
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Spelers</h1>

      {isAdmin && (
        <form
          onSubmit={addPlayer}
          className="space-y-3 rounded-lg border bg-white p-4"
        >
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
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isAdmin && <PushToggle />}

      {isAdmin && teamToken && (
        <section className="space-y-2 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Link voor de groepsapp</h2>
          <p className="text-sm text-green-900/70">
            Eén link voor iedereen: spelers kiezen hun naam en geven aan of ze
            kunnen.
          </p>
          <div className="flex gap-2">
            <button
              onClick={copyGroupLink}
              className="rounded border border-green-300 px-4 py-2 text-sm font-semibold text-green-900"
            >
              {copied === "groep" ? "Gekopieerd!" : "Kopieer link"}
            </button>
            <button
              onClick={whatsappGroup}
              className="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Deel via WhatsApp
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Basisspelers ({starters.length})
        </h2>
        <ul className="space-y-2">
          {starters.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded border bg-white p-2"
            >
              {p.name}
              {isAdmin && (
                <div className="flex items-center gap-3 text-sm">
                  {tokens[p.id] && (
                    <>
                      <button
                        onClick={() => copyLink(p)}
                        className="text-green-700"
                      >
                        {copied === p.id ? "Gekopieerd!" : "Kopieer link"}
                      </button>
                      <button
                        onClick={() => whatsappLink(p)}
                        className="text-green-700"
                      >
                        WhatsApp
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deletePlayer(p.id)}
                    className="text-red-600"
                  >
                    Verwijderen
                  </button>
                </div>
              )}
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
              className="flex items-center justify-between gap-3 rounded border bg-white p-2"
            >
              {p.name}
              {isAdmin && (
                <div className="flex items-center gap-3 text-sm">
                  {tokens[p.id] && (
                    <>
                      <button
                        onClick={() => copyLink(p)}
                        className="text-green-700"
                      >
                        {copied === p.id ? "Gekopieerd!" : "Kopieer link"}
                      </button>
                      <button
                        onClick={() => whatsappLink(p)}
                        className="text-green-700"
                      >
                        WhatsApp
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deletePlayer(p.id)}
                    className="text-red-600"
                  >
                    Verwijderen
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
