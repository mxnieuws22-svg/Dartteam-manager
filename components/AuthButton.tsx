"use client";

import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { useIsAdmin } from "@/lib/useIsAdmin";

export default function AuthButton() {
  const isAdmin = useIsAdmin();

  if (isAdmin) return <LogoutButton />;

  return (
    <Link
      href="/login"
      className="shrink-0 rounded border border-green-300 px-3 py-1.5 text-sm"
    >
      Inloggen
    </Link>
  );
}
