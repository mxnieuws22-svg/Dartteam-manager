"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "unsupported" | "ios" | "off" | "on" | "denied";

function toKey(base64: string) {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return reg ? reg.pushManager.getSubscription() : null;
}

export default function PushToggle() {
  const supabase = createClient();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    async function check() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        const apple = /iPhone|iPad|iPod/.test(navigator.userAgent);
        setStatus(apple ? "ios" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        setStatus((await currentSubscription()) ? "on" : "off");
      } catch {
        // Niet te controleren (bijvoorbeeld in een privévenster): gewoon laten aanzetten.
        setStatus("off");
      }
    }
    check();
  }, []);

  async function enable() {
    setError("");
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) {
      setError("Meldingen zijn op de website nog niet ingesteld.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toKey(key),
        }));
      const json = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      if (error) {
        setError("Opslaan mislukt. Is de SQL voor meldingen gedraaid?");
        return;
      }
      setStatus("on");
    } catch {
      setError("Meldingen aanzetten is niet gelukt.");
    }
  }

  async function disable() {
    setError("");
    try {
      const sub = await currentSubscription();
      if (sub) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("Meldingen uitzetten is niet gelukt.");
    }
  }

  return (
    <section className="space-y-2 rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Meldingen op deze telefoon</h2>
      <p className="text-sm text-green-900/70">
        Krijg een melding zodra een speler aangeeft of hij kan.
      </p>

      {status === "checking" && (
        <p className="text-sm text-green-900/60">Even kijken...</p>
      )}
      {status === "ios" && (
        <p className="text-sm">
          Op een iPhone werkt dit alleen vanuit de app op je beginscherm. Zet de
          site eerst op je beginscherm (deel-knop, dan &quot;Zet op
          beginscherm&quot;), open de app en log daar in.
        </p>
      )}
      {status === "unsupported" && (
        <p className="text-sm">Deze browser ondersteunt geen meldingen.</p>
      )}
      {status === "denied" && (
        <p className="text-sm">
          Meldingen zijn geblokkeerd. Sta ze toe in de instellingen van je
          browser of telefoon.
        </p>
      )}
      {status === "off" && (
        <button
          onClick={enable}
          className="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Meldingen aanzetten
        </button>
      )}
      {status === "on" && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-green-700">
            Meldingen staan aan
          </span>
          <button
            onClick={disable}
            className="rounded border border-green-300 px-3 py-1 text-sm"
          >
            Uitzetten
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
