"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Alleen voor de weergave: de echte beveiliging zit in de RLS-regels van Supabase.
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setIsAdmin(!!session)
    );
    return () => subscription.unsubscribe();
  }, []);

  return isAdmin;
}
