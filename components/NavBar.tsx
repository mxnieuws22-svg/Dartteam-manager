"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "@/components/AuthButton";
import { useIsAdmin } from "@/lib/useIsAdmin";

const links = [
  { href: "/", label: "Home", adminOnly: false },
  { href: "/spelers", label: "Spelers", adminOnly: true },
  { href: "/wedstrijden", label: "Wedstrijden", adminOnly: true },
];

export default function NavBar() {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 p-3">
        <nav className="flex gap-1">
          {links
            .filter((l) => isAdmin || !l.adminOnly)
            .map((l) => {
              const active =
                l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded px-3 py-1.5 text-sm font-semibold ${
                    active ? "bg-green-700 text-white" : "text-green-900"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
        </nav>
        <AuthButton />
      </div>
    </header>
  );
}
