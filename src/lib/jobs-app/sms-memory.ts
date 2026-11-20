export type SmsMemoryEntry = { ticked: string[]; known: string[]; savedAt: number };
export type SmsMemory = Record<string, SmsMemoryEntry>;

export type SmsMemoryStore = {
  read(): SmsMemory;
  write(value: SmsMemory): void;
};

const KEY = "oro.jobs.sms.v1";
const MAX_JOBS = 30;

function entryOf(memory: SmsMemory, jobId: string): SmsMemoryEntry | null {
  const entry = memory[jobId];
  if (!entry || !Array.isArray(entry.ticked) || !Array.isArray(entry.known)) return null;
  return {
    ticked: entry.ticked.filter((phone) => typeof phone === "string"),
    known: entry.known.filter((phone) => typeof phone === "string"),
    savedAt: typeof entry.savedAt === "number" ? entry.savedAt : 0,
  };
}

export function tickedFromMemory(store: SmsMemoryStore, jobId: string, phones: string[]): string[] {
  const entry = entryOf(store.read(), jobId);
  if (!entry) return [...phones];
  const known = new Set(entry.known);
  const ticked = new Set(entry.ticked);
  return phones.filter((phone) => !known.has(phone) || ticked.has(phone));
}

export function rememberSelection(store: SmsMemoryStore, jobId: string, phones: string[], ticked: string[]): void {
  if (!jobId) return;
  const memory = store.read();
  memory[jobId] = {
    ticked: ticked.filter((phone) => phones.includes(phone)),
    known: [...phones],
    savedAt: Date.now(),
  };
  const newest = Object.entries(memory)
    .filter((item): item is [string, SmsMemoryEntry] => Boolean(entryOf({ [item[0]]: item[1] }, item[0])))
    .sort((a, b) => (b[1].savedAt ?? 0) - (a[1].savedAt ?? 0))
    .slice(0, MAX_JOBS);
  const next: SmsMemory = {};
  for (const [id, entry] of newest) next[id] = entry;
  store.write(next);
}

export function browserSmsMemory(): SmsMemoryStore | null {
  if (typeof window === "undefined") return null;
  return {
    read() {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        return parsed as SmsMemory;
      } catch {
        return {};
      }
    },
    write(value) {
      window.localStorage.setItem(KEY, JSON.stringify(value));
    },
  };
}
