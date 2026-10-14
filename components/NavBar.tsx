"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "@/components/AuthButton";
import { useIsAdmin } from "@/lib/useIsAdmin";

const links = [
  { href: "/", label: "Home" },
  { href: "/spelers", label: "Spelers" },
  { href: "/wedstrijden", label: "Wedstrijden" },
  { href: "/statistieken", label: "Statistieken" },
];

export default function NavBar() {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();

  if (!isAdmin) return null;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 p-3">
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => {
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
