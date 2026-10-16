// Korte links: de geheime code (uuid) en de wedstrijd worden compact in de link gezet.
// Lange links van vóór deze wijziging blijven gewoon werken.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// uuid (36 tekens) -> 22 tekens
export function encodeToken(uuid: string): string {
  if (!UUID.test(uuid)) return uuid;
  const hex = uuid.replace(/-/g, "");
  let binary = "";
  for (let i = 0; i < hex.length; i += 2) {
    binary += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// 22 tekens (of een lange uuid uit een oude link) -> uuid
export function decodeToken(value: string): string {
  if (UUID.test(value)) return value;
  if (!/^[A-Za-z0-9_-]{22}$/.test(value)) return value;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "==");
    const hex = Array.from(binary, (c) =>
      c.charCodeAt(0).toString(16).padStart(2, "0"),
    ).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return value;
  }
}

// "2026-10-30" -> "261030"
export function dateCode(date: string): string {
  return date.replace(/-/g, "").slice(2, 8);
}

// Hoort deze wedstrijd bij de waarde uit de link? Dat kan de datumcode zijn
// (261030 of 2026-10-30) of, in oude links, het id van de wedstrijd.
export function isMatch(
  match: { id: string; match_date: string },
  value: string,
): boolean {
  if (match.id === value) return true;
  const code = value.replace(/-/g, "");
  return (
    dateCode(match.match_date) === (code.length === 8 ? code.slice(2) : code)
  );
}
