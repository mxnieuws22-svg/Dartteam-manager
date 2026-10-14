export default function ScoreBadge({
  scoreFor,
  scoreAgainst,
}: {
  scoreFor: number | null;
  scoreAgainst: number | null;
}) {
  if (scoreFor === null || scoreAgainst === null) return null;

  const color =
    scoreFor > scoreAgainst
      ? "bg-green-700 text-white"
      : scoreFor < scoreAgainst
        ? "bg-red-600 text-white"
        : "bg-amber-400 text-amber-950";
  const label =
    scoreFor > scoreAgainst
      ? "Gewonnen"
      : scoreFor < scoreAgainst
        ? "Verloren"
        : "Gelijk";

  return (
    <span
      title={label}
      className={`shrink-0 rounded px-2 py-1 text-sm font-bold ${color}`}
    >
      {scoreFor} - {scoreAgainst}
    </span>
  );
}
