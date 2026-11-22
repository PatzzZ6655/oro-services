/**
 * Compare a screenshot address with a job address.
 * Case, unit numbers, street abbreviations, suburb, state, and postcode are ignored.
 * "12 Test St, Doncaster East" and "Unit 4/12 Test Street, Fitzroy VIC 3065" share one key: "12 test street".
 */

const streetTypes: Record<string, string> = {
  st: "street",
  street: "street",
  rd: "road",
  road: "road",
  ave: "avenue",
  av: "avenue",
  avenue: "avenue",
  dr: "drive",
  drive: "drive",
  ct: "court",
  court: "court",
  cres: "crescent",
  cr: "crescent",
  crescent: "crescent",
  pde: "parade",
  parade: "parade",
  hwy: "highway",
  highway: "highway",
  ln: "lane",
  lane: "lane",
  pl: "place",
  place: "place",
  tce: "terrace",
  ter: "terrace",
  terrace: "terrace",
  cct: "circuit",
  circuit: "circuit",
  blvd: "boulevard",
  bvd: "boulevard",
  boulevard: "boulevard",
  cl: "close",
  close: "close",
  way: "way",
  gr: "grove",
  grove: "grove",
  sq: "square",
  square: "square",
  esp: "esplanade",
  esplanade: "esplanade",
};

const unitWords = new Set(["unit", "apt", "apartment", "flat", "suite", "shop", "lot", "lvl", "level", "u"]);
const stopWords = new Set(["vic", "nsw", "qld", "sa", "wa", "tas", "nt", "act", "victoria", "australia"]);

function tokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9/]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Street number plus street name, or "" when the text has no street. */
export function smsAddressKey(raw: string): string {
  const parts = tokens(raw);
  const cleaned: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const token = parts[i] ?? "";
    if (unitWords.has(token)) {
      const next = parts[i + 1] ?? "";
      if (/^[a-z]?\d+[a-z]?$/.test(next)) i += 1;
      continue;
    }
    cleaned.push(token);
  }
  let number = "";
  let start = -1;
  for (let i = 0; i < cleaned.length; i += 1) {
    const token = cleaned[i] ?? "";
    const slash = /^(?:[a-z]?\d+[a-z]?)\/(\d+[a-z]?)$/.exec(token);
    if (slash?.[1]) {
      number = slash[1];
      start = i + 1;
      break;
    }
    if (/^\d+[a-z]?$/.test(token)) {
      number = token;
      start = i + 1;
      break;
    }
  }
  if (!number || start < 0) return "";
  const name: string[] = [];
  let typed = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const token = cleaned[i] ?? "";
    const type = streetTypes[token];
    if (type) {
      name.push(type);
      typed = true;
      break;
    }
    if (/^\d{4}$/.test(token) || stopWords.has(token)) break;
    name.push(token);
    if (name.length >= 4) break;
  }
  if (!typed || name.length === 0) return "";
  return `${number} ${name.join(" ")}`;
}

export function smsAddressesMatch(left: string, right: string): boolean {
  const a = smsAddressKey(left);
  const b = smsAddressKey(right);
  return a.length > 0 && a === b;
}
