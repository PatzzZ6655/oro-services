import { matchAgencyClients, type AgencyClient } from "@/lib/jobs-app/client-match";
import { isBusiness, type Business } from "@/lib/jobs-app/types";

const notionVersion = "2025-09-03";

const clientSources: Record<Business, string> = {
  emoro: "897728e3-ee66-4be3-89ae-740d896d6b77",
  emporo: "64c91037-f9ca-8297-a3a2-87bc134c5bda",
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function plainText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const row = value as { title?: { plain_text?: string }[]; rich_text?: { plain_text?: string }[] };
  const parts = row.title ?? row.rich_text ?? [];
  return parts
    .map((part) => (typeof part.plain_text === "string" ? part.plain_text : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function clientsFromNotion(payload: unknown): AgencyClient[] {
  const results = payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown }).results)
    ? (payload as { results: unknown[] }).results
    : [];
  const clients: AgencyClient[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const page = item as { id?: unknown; properties?: Record<string, unknown> };
    const id = typeof page.id === "string" ? page.id.replace(/-/g, "") : "";
    const properties = page.properties ?? {};
    const name = plainText(properties.Customer);
    if (!id || !name) continue;
    clients.push({
      id,
      name,
      company: plainText(properties.Company),
      address: plainText(properties.Address),
    });
  }
  return clients;
}

export async function findAgencyClients(
  business: string,
  agency: string,
  hint: string,
  fetchImpl?: FetchLike,
): Promise<{ pick: AgencyClient | null; suggestions: AgencyClient[] }> {
  const empty = { pick: null, suggestions: [] };
  if (!isBusiness(business) || !agency.trim()) return empty;
  const token = process.env.NOTION_TOKEN?.trim() ?? "";
  if (!token) return empty;
  const call = fetchImpl ?? globalThis.fetch;
  const needle = agency.trim().slice(0, 40);
  try {
    const response = await call(`https://api.notion.com/v1/data_sources/${clientSources[business]}/query`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "notion-version": notionVersion,
      },
      body: JSON.stringify({
        page_size: 100,
        filter: { property: "Customer", title: { contains: needle } },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return empty;
    const payload = (await response.json().catch(() => null)) as unknown;
    return matchAgencyClients(agency, hint, clientsFromNotion(payload));
  } catch {
    return empty;
  }
}
