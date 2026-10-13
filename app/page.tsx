import Link from "next/link";
import AuthButton from "@/components/AuthButton";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dartteam beheer</h1>
        <AuthButton />
      </div>

      <nav className="space-y-2">
        <Link
          href="/spelers"
          className="block rounded-lg border bg-white p-4 font-semibold"
        >
          Spelers
        </Link>
        <Link
          href="/wedstrijden"
          className="block rounded-lg border bg-white p-4 font-semibold"
        >
          Wedstrijden
        </Link>
      </nav>
    </main>
  );
}