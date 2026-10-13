import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Dartteam</h1>

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