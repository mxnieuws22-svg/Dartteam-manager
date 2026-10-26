type Role = "none" | "starter" | "reserve";

type Props = {
  players: { id: string; name: string }[];
  roles: Record<string, Role>;
  // speler-id -> kan wel (true) of niet (false); wie ontbreekt heeft nog niet gereageerd
  available: Record<string, boolean>;
  // speler-id -> true bij "nog niet zeker"
  maybe?: Record<string, boolean>;
  onRemove: (playerId: string) => void;
};

// Waarschuwt de beheerder als iemand in de opstelling staat die zich heeft afgemeld of het nog niet zeker weet.
export default function LineupWarning({
  players,
  roles,
  available,
  maybe,
  onRemove,
}: Props) {
  const conflicts = players.filter(
    (p) =>
      (roles[p.id] === "starter" || roles[p.id] === "reserve") &&
      available[p.id] === false,
  );
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3">
      <h2 className="font-semibold text-red-700">
        Let op: de opstelling klopt niet meer
      </h2>
      <ul className="space-y-2">
        {conflicts.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3">
            <span className="text-sm text-red-900">
              <span className="font-semibold">{p.name}</span> staat{" "}
              {roles[p.id] === "starter" ? "in de basis" : "als reserve"} maar{" "}
              {maybe?.[p.id] ? "weet het nog niet zeker" : "kan niet"}.
            </span>
            <button
              onClick={() => onRemove(p.id)}
              className="shrink-0 rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700"
            >
              Uit opstelling halen
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
