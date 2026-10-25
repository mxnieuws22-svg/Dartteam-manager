"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "@/components/AuthButton";
import { useIsAdmin } from "@/lib/useIsAdmin";

const links = [
  { href: "/", label: "Home" },
  { href: "/spelers", label: "Spelers" },
  { href: "/wedstrijden", label: "Wedstrijden" },
  { href: "/agenda", label: "Agenda" },
  { href: "/statistieken", label: "Statistieken" },
];

export default function NavBar() {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();

  if (!isAdmin) return null;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-2xl items-center gap-2 p-2">
        <div className="relative min-w-0 flex-1">
          <nav className="flex gap-1 overflow-x-auto pr-6">
            {links.map((l) => {
              const active =
                l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`shrink-0 whitespace-nowrap rounded px-2.5 py-1.5 text-sm font-semibold ${
                    active ? "bg-green-700 text-white" : "text-green-900"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
        </div>
        <AuthButton />
      </div>
    </header>
  );
}
