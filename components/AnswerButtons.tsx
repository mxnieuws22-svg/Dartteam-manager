export type Answer = "yes" | "no" | "maybe";

// Wat er in de database staat -> het antwoord dat de speler gaf (of niets).
export function toAnswer(
  isAvailable: boolean | null | undefined,
  isMaybe?: boolean | null,
): Answer | undefined {
  if (isMaybe) return "maybe";
  if (isAvailable === true) return "yes";
  if (isAvailable === false) return "no";
  return undefined;
}

// Het antwoord -> wat naar de database gaat. "Nog niet zeker" geeft ook is_available = false.
// Bij ja of nee wordt p_maybe niet meegestuurd, zodat het ook werkt vóór de SQL is bijgewerkt.
export function answerArgs(answer: Answer) {
  return {
    p_available: answer === "yes",
    ...(answer === "maybe" ? { p_maybe: true } : {}),
  };
}

type Props = {
  value: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  disabled?: boolean;
};

const base = "rounded px-4 py-3 font-semibold disabled:opacity-40";
const off = "border border-green-300 text-green-900";

export default function AnswerButtons({ value, onAnswer, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        disabled={disabled}
        onClick={() => onAnswer("yes")}
        className={`${base} ${value === "yes" ? "bg-green-700 text-white" : off}`}
      >
        Ik kan
      </button>
      <button
        disabled={disabled}
        onClick={() => onAnswer("no")}
        className={`${base} ${value === "no" ? "bg-red-600 text-white" : off}`}
      >
        Ik kan niet
      </button>
      <button
        disabled={disabled}
        onClick={() => onAnswer("maybe")}
        className={`${base} col-span-2 ${
          value === "maybe" ? "bg-amber-400 text-amber-950" : off
        }`}
      >
        Nog niet zeker
      </button>
    </div>
  );
}
