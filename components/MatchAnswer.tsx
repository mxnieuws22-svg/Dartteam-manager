"use client";

import { useState } from "react";
import AnswerButtons, { type Answer } from "@/components/AnswerButtons";
import AvailabilityOverview from "@/components/AvailabilityOverview";

type Props = {
  value: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  disabled?: boolean;
  players: { id: string; name: string }[];
  answers: Record<string, boolean>;
  maybe?: Record<string, boolean>;
  me?: string;
};

const given: Record<Answer, { text: string; color: string }> = {
  yes: { text: "Ik kan", color: "text-green-700" },
  no: { text: "Ik kan niet", color: "text-red-600" },
  maybe: { text: "Nog niet zeker", color: "text-amber-700" },
};

// Nog niet geantwoord: de knoppen. Wel geantwoord: een bedankje met het teamoverzicht,
// en een knop om het antwoord te wijzigen.
export default function MatchAnswer({
  value,
  onAnswer,
  disabled,
  players,
  answers,
  maybe,
  me,
}: Props) {
  const [editing, setEditing] = useState(false);

  if (!value || editing) {
    return (
      <AnswerButtons
        value={value}
        disabled={disabled}
        onAnswer={(a) => {
          setEditing(false);
          onAnswer(a);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p>
          Bedankt, doorgegeven:{" "}
          <span className={`font-bold ${given[value].color}`}>
            {given[value].text}
          </span>
        </p>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-sm text-green-700 underline"
        >
          Wijzigen
        </button>
      </div>
      <AvailabilityOverview
        players={players}
        answers={answers}
        maybe={maybe}
        me={me}
      />
    </div>
  );
}
