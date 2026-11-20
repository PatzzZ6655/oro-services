export const REQUIRED_ITEMS = [
  "Before-and-after photos taken",
  "Water, power and gas restored, tested, no leaks",
  "Site cleaned and furniture put back",
  "Tools and materials taken",
  "Doors and windows locked",
] as const;

export const OPTIONAL_ITEMS = [
  "Keys returned, including new keys after a lock change, back to the agency",
  "Told the tenant what was repaired (skip if they are out)",
] as const;

export function checklistText(checked: ReadonlySet<string>): { text: string; missing: string[] } {
  const lines: string[] = [];
  const missing: string[] = [];
  for (const item of REQUIRED_ITEMS) {
    if (checked.has(item)) lines.push(`✔ ${item}`);
    else {
      lines.push(`✘ ${item}`);
      missing.push(item);
    }
  }
  for (const item of OPTIONAL_ITEMS) {
    lines.push(checked.has(item) ? `✔ ${item}` : `✘ ${item}`);
  }
  return { text: lines.join("; "), missing };
}
