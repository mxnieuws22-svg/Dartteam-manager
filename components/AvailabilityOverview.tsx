type Person = { id: string; name: string };

type Props = {
  players: Person[];
  // speler-id -> kan wel (true) of niet (false); wie ontbreekt heeft nog niet gereageerd
  answers: Record<string, boolean>;
  // speler-id -> true als de speler "nog niet zeker" koos (komt dan ook in answers voor als false)
  maybe?: Record<string, boolean>;
  // optioneel: de speler die de pagina bekijkt, wordt vet getoond
  me?: string;
};

function Group({
  title,
  color,
  people,
  chip,
  me,
}: {
  title: string;
  color: string;
  people: Person[];
  chip: string;
  me?: string;
}) {
  if (people.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h3 className={`text-sm font-semibold ${color}`}>
        {title} ({people.length})
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {people.map((p) => (
          <li
            key={p.id}
            className={`rounded-full px-2.5 py-1 text-sm ${chip} ${
              p.id === me ? "font-bold ring-2 ring-green-900/40" : "font-medium"
            }`}
          >
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Wie kan, wie kan niet en wie heeft nog niet gereageerd, met een balk en aantallen.
export default function AvailabilityOverview({
  players,
  answers,
  maybe,
  me,
}: Props) {
  const isMaybe = (p: Person) =>
    maybe?.[p.id] === true && answers[p.id] !== true;
  const yes = players.filter((p) => answers[p.id] === true);
  const unsure = players.filter(isMaybe);
  const no = players.filter((p) => answers[p.id] === false && !isMaybe(p));
  const open = players.filter((p) => answers[p.id] === undefined);
  const total = players.length;

  if (total === 0) return null;

  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-sm">
        <span className="font-semibold text-green-700">
          {yes.length} kunnen
        </span>
        {" · "}
        <span className="font-semibold text-red-600">
          {no.length} kunnen niet
        </span>
        {unsure.length > 0 && (
          <>
            {" · "}
            <span className="font-semibold text-amber-700">
              {unsure.length} nog niet zeker
            </span>
          </>
        )}
        {" · "}
        <span className="text-green-900/60">{open.length} nog open</span>
      </p>

      <Group
        title="Kunnen"
        color="text-green-700"
        people={yes}
        chip="bg-green-100 text-green-900"
        me={me}
      />
      <Group
        title="Kunnen niet"
        color="text-red-600"
        people={no}
        chip="bg-red-100 text-red-900"
        me={me}
      />
      <Group
        title="Nog niet zeker"
        color="text-amber-700"
        people={unsure}
        chip="bg-amber-100 text-amber-900"
        me={me}
      />
      <Group
        title="Nog niet gereageerd"
        color="text-green-900/60"
        people={open}
        chip="border text-green-900/70"
        me={me}
      />
    </div>
  );
}
