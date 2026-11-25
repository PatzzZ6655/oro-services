export type AgencyClient = {
  id: string;
  name: string;
  company: string;
  address: string;
};

const ignored = new Set(["pty", "ltd", "limited", "group", "the", "and", "real", "estate", "agency"]);
const streetWords = new Set([
  "street",
  "st",
  "road",
  "rd",
  "avenue",
  "ave",
  "drive",
  "dr",
  "court",
  "ct",
  "place",
  "pl",
  "parade",
  "pde",
  "lane",
  "ln",
  "crescent",
  "cres",
  "boulevard",
  "blvd",
  "highway",
  "hwy",
  "vic",
  "nsw",
  "qld",
  "sa",
  "wa",
  "tas",
  "nt",
  "act",
  "australia",
  "aus",
]);

function plain(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value: string): string[] {
  return plain(value).split(" ").filter((word) => word.length > 1 && !ignored.has(word));
}

function placeWords(hint: string): string[] {
  return plain(hint)
    .split(" ")
    .filter((word) => word.length > 2 && !streetWords.has(word) && !/^\d+$/.test(word));
}

export function matchAgencyClients(
  agency: string,
  hint: string,
  clients: AgencyClient[],
): { pick: AgencyClient | null; suggestions: AgencyClient[] } {
  const wanted = words(agency);
  if (wanted.length === 0) return { pick: null, suggestions: [] };
  const phrase = wanted.join(" ");
  const scored = clients
    .map((client) => {
      const name = words(client.name).join(" ");
      const company = words(client.company).join(" ");
      const blob = `${name} ${company}`.trim();
      let score = 0;
      if (name === phrase || company === phrase) score = 100;
      else if (name.startsWith(`${phrase} `) || company.startsWith(`${phrase} `) || blob.includes(phrase)) score = 80;
      else if (wanted.every((word) => blob.includes(word))) score = 70;
      return { client, score };
    })
    .filter((row) => row.score > 0);
  if (scored.length === 0) return { pick: null, suggestions: [] };

  const places = placeWords(hint);
  let pool = scored;
  if (places.length > 0 && scored.length > 1) {
    const narrowed = scored.filter((row) => {
      const hay = plain(`${row.client.name} ${row.client.company} ${row.client.address}`);
      return places.some((place) => hay.includes(place));
    });
    if (narrowed.length > 0) pool = narrowed;
  }
  pool.sort((left, right) => right.score - left.score || left.client.name.localeCompare(right.client.name, "en-AU"));
  const top = pool[0]?.score ?? 0;
  const best = pool.filter((row) => row.score === top);
  const suggestions = pool.slice(0, 8).map((row) => row.client);
  const only = best.length === 1 ? best[0] : null;
  if (only && only.score >= 80) return { pick: only.client, suggestions };
  return { pick: null, suggestions };
}
