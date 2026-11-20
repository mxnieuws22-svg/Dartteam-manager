"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Welke wedstrijden een datum hebben die nog niet zeker is (wedstrijd-id -> true).
// Bestaat het veld nog niet (SQL niet gedraaid), dan blijft het leeg.
export function useTentative(): Record<string, boolean> {
  const [map, setMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    createClient()
      .from("matches")
      .select("id, date_tentative")
      .then(({ data, error }) => {
        if (error) return;
        setMap(
          Object.fromEntries(
            (data ?? [])
              .filter((m) => m.date_tentative)
              .map((m) => [m.id, true]),
          ),
        );
      });
  }, []);

  return map;
}
