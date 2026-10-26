import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

type Subscription = { endpoint: string; p256dh: string; auth: string };

type PushInfo = {
  player: string;
  opponent: string | null;
  match_date: string;
  is_available: boolean | null;
  is_maybe?: boolean;
  subscriptions: Subscription[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const secret = process.env.PUSH_SECRET;
  if (!publicKey || !privateKey || !secret) {
    // Meldingen zijn nog niet ingesteld: niets te doen.
    return new Response(null, { status: 204 });
  }

  let body: { token?: string; playerId?: string; matchId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const { token, playerId, matchId } = body;
  if (
    !token ||
    !matchId ||
    !UUID.test(token) ||
    !UUID.test(matchId) ||
    (playerId && !UUID.test(playerId))
  ) {
    return new Response(null, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

  const { data, error } = await supabase.rpc("push_info", {
    p_secret: secret,
    p_token: token,
    p_player_id: playerId ?? null,
    p_match_id: matchId,
  });
  if (error || !data) {
    return new Response(null, { status: 404 });
  }

  const info = data as PushInfo;
  if (info.is_available === null || info.subscriptions.length === 0) {
    return new Response(null, { status: 204 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey,
    privateKey,
  );

  const date = new Date(info.match_date).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
  // Staat de speler in de opstelling en kan die niet (of weet het niet zeker), dan staat dat in de melding.
  let warning = "";
  if (!info.is_available) {
    const { data: lineup } = await supabase
      .from("lineup")
      .select("is_starter, players(name)")
      .eq("match_id", matchId)
      .returns<{ is_starter: boolean; players: { name: string } | null }[]>();
    const row = (lineup ?? []).find((l) => l.players?.name === info.player);
    if (row) {
      warning = `Staat ${row.is_starter ? "in de basis" : "als reserve"}! · `;
    }
  }
  const payload = JSON.stringify({
    title: info.is_maybe
      ? `${info.player} weet het nog niet`
      : info.is_available
        ? `${info.player} kan`
        : `${info.player} kan niet`,
    body: `${warning}${info.opponent || "Wedstrijd"} · ${date}`,
    url: `/wedstrijden/${matchId}`,
  });

  await Promise.all(
    info.subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        console.error("Pushmelding versturen mislukt", status ?? e);
        if (status === 404 || status === 410) {
          await supabase.rpc("push_remove", {
            p_secret: secret,
            p_endpoint: s.endpoint,
          });
        }
      }
    }),
  );

  return new Response(null, { status: 204 });
}
