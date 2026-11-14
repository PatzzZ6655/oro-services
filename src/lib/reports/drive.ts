import { allowedEmails } from "@/lib/auth/session";
import { reportCard, type ReportKind } from "@/lib/reports/catalog";
import { driveAppProperty, driveFolderQuery, submissionFolderName } from "@/lib/reports/paths";
import { isSafetyKind, latestLicences, safetyCard, type LicenceRecord } from "@/lib/reports/safety";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export type StoredReport = {
  id: string;
  title: string;
  date: string;
  address: string;
  url: string;
};

export function driveConfigured(): boolean {
  const client = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const refresh = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim() ?? "";
  return client.length > 0 && secret.length > 0 && refresh.length > 20;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim() ?? "",
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    console.error("drive token refresh failed", response.status);
    throw new Error("Google Drive isn't connected.");
  }
  const json = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof json.access_token !== "string") throw new Error("Google Drive isn't connected.");
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3000;
  cachedToken = { token: json.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return json.access_token;
}

async function driveFetch(token: string, url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
}

async function findFolder(token: string, name: string, parentId?: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: driveFolderQuery(name, parentId),
    pageSize: "1",
    fields: "files(id)",
    spaces: "drive",
  });
  const response = await driveFetch(token, `${FILES_URL}?${params}`);
  if (!response.ok) {
    console.error("drive folder lookup failed", response.status);
    throw new Error("The report could not be saved to Google Drive.");
  }
  const json = (await response.json()) as { files?: { id?: string }[] };
  return json.files?.[0]?.id ?? null;
}

async function createFolder(token: string, name: string, parentId?: string): Promise<string> {
  const response = await driveFetch(token, `${FILES_URL}?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId ?? "root"],
      appProperties: { oroApp: driveAppProperty, oroFolder: "1" },
    }),
  });
  if (!response.ok) {
    console.error("drive folder create failed", response.status);
    throw new Error("The report could not be saved to Google Drive.");
  }
  const json = (await response.json()) as { id?: string };
  if (!json.id) throw new Error("The report could not be saved to Google Drive.");
  return json.id;
}

async function ensureFolder(token: string, name: string, parentId?: string): Promise<string> {
  return (await findFolder(token, name, parentId)) ?? (await createFolder(token, name, parentId));
}

function multipart(metadata: unknown, media: Uint8Array, mime: string): { body: Uint8Array; contentType: string } {
  const boundary = "oro_report_boundary";
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const encoder = new TextEncoder();
  const headBytes = encoder.encode(head);
  const tailBytes = encoder.encode(tail);
  const body = new Uint8Array(headBytes.length + media.length + tailBytes.length);
  body.set(headBytes, 0);
  body.set(media, headBytes.length);
  body.set(tailBytes, headBytes.length + media.length);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

async function uploadFile(
  token: string,
  parentId: string,
  name: string,
  mime: string,
  bytes: Uint8Array,
  appProperties?: Record<string, string>,
): Promise<{ id: string; url: string }> {
  const payload = multipart(
    {
      name,
      mimeType: mime,
      parents: [parentId],
      appProperties,
    },
    bytes,
    mime,
  );
  const response = await driveFetch(token, `${UPLOAD_URL}?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: { "Content-Type": payload.contentType },
    body: Buffer.from(payload.body),
  });
  if (!response.ok) {
    console.error("drive upload failed", response.status);
    throw new Error("The report could not be saved to Google Drive.");
  }
  const json = (await response.json()) as { id?: string; webViewLink?: string };
  if (!json.id) throw new Error("The report could not be saved to Google Drive.");
  return { id: json.id, url: json.webViewLink || `https://drive.google.com/file/d/${json.id}/view` };
}

async function shareReader(token: string, fileId: string, email: string): Promise<void> {
  const response = await driveFetch(token, `${FILES_URL}/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "user", emailAddress: email }),
  });
  if (!response.ok) console.error("drive share failed", response.status);
}

function shortProperty(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function filingCard(kind: string): { title: string; folder: string } {
  if (isSafetyKind(kind)) return safetyCard(kind);
  return reportCard(kind as ReportKind);
}

export async function saveReportPackage(options: {
  kind: string;
  date: string;
  address: string;
  pdf: Uint8Array;
  photos: { name: string; bytes: Uint8Array; mime: string }[];
}): Promise<{ url: string; folderId: string }> {
  const token = await accessToken();
  const rootId = await ensureFolder(token, "ORO Reports");
  const typeId = await ensureFolder(token, filingCard(options.kind).folder, rootId);
  const yearId = await ensureFolder(token, options.date.slice(0, 4), typeId);
  const folderId = await ensureFolder(token, submissionFolderName(options.date, options.address), yearId);
  const card = filingCard(options.kind);
  const uploaded = await uploadFile(token, folderId, `${card.title}.pdf`, "application/pdf", options.pdf, {
    oroApp: driveAppProperty,
    oroKind: "report-pdf",
    oroType: options.kind,
    oroDate: options.date,
    oroAddress: shortProperty(options.address),
  });
  for (const [index, photo] of options.photos.entries()) {
    await uploadFile(token, folderId, photo.name || `photo-${index + 1}.jpg`, photo.mime, photo.bytes, {
      oroApp: driveAppProperty,
      oroKind: "report-photo",
      oroType: options.kind,
    });
  }
  const readers = [...(allowedEmails() ?? [])];
  await Promise.all(readers.map((email) => shareReader(token, folderId, email)));
  return { url: uploaded.url, folderId };
}

export async function listRecentReports(): Promise<StoredReport[]> {
  const token = await accessToken();
  const params = new URLSearchParams({
    q: "appProperties has { key='oroKind' and value='report-pdf' } and trashed = false",
    pageSize: "20",
    fields: "files(id,name,webViewLink,createdTime,appProperties)",
    orderBy: "createdTime desc",
    spaces: "drive",
  });
  let response = await driveFetch(token, `${FILES_URL}?${params}`);
  if (response.status === 400) {
    params.delete("orderBy");
    response = await driveFetch(token, `${FILES_URL}?${params}`);
  }
  if (!response.ok) {
    console.error("drive list failed", response.status);
    throw new Error("The report list couldn't be loaded.");
  }
  const json = (await response.json()) as {
    files?: {
      id?: string;
      name?: string;
      webViewLink?: string;
      createdTime?: string;
      appProperties?: Record<string, string>;
    }[];
  };
  const rows = (json.files ?? [])
    .filter((file): file is { id: string; name?: string; webViewLink?: string; createdTime?: string; appProperties?: Record<string, string> } => Boolean(file.id))
    .map((file) => {
      const kind = file.appProperties?.oroType;
      const title = kind && (isSafetyKind(kind) || kind === "site-job-sheet" || kind === "job-sign-off" || kind === "gas-safety" || kind === "electrical-safety")
        ? filingCard(kind).title
        : file.name || "Report";
      return {
        id: file.id,
        title,
        date: file.appProperties?.oroDate || file.createdTime?.slice(0, 10) || "",
        address: file.appProperties?.oroAddress || "",
        url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        created: file.createdTime || "",
      };
    });
  rows.sort((a, b) => b.created.localeCompare(a.created));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    address: row.address,
    url: row.url,
  }));
}

export async function saveLicenceRecord(record: Omit<LicenceRecord, "id" | "created">): Promise<void> {
  const token = await accessToken();
  const rootId = await ensureFolder(token, "ORO Reports");
  const folderId = await ensureFolder(token, "Training Register", rootId);
  const body = new TextEncoder().encode(JSON.stringify(record));
  await uploadFile(token, folderId, `${shortProperty(record.name) || "worker"}.json`, "application/json", body, {
    oroApp: driveAppProperty,
    oroKind: "licence-record",
    oroName: shortProperty(record.name),
    oroCompany: record.company,
    oroWhiteCard: shortProperty(record.whiteCard),
    oroLicence: shortProperty(record.licence),
    oroExpiry: record.expiry,
  });
}

export async function listLicenceRecords(): Promise<LicenceRecord[]> {
  const token = await accessToken();
  const params = new URLSearchParams({
    q: "appProperties has { key='oroKind' and value='licence-record' } and trashed = false",
    pageSize: "100",
    fields: "files(id,createdTime,appProperties)",
    orderBy: "createdTime desc",
    spaces: "drive",
  });
  let response = await driveFetch(token, `${FILES_URL}?${params}`);
  if (response.status === 400) {
    params.delete("orderBy");
    response = await driveFetch(token, `${FILES_URL}?${params}`);
  }
  if (!response.ok) throw new Error("The training register could not be loaded.");
  const json = (await response.json()) as { files?: { id?: string; createdTime?: string; appProperties?: Record<string, string> }[] };
  const records: LicenceRecord[] = (json.files ?? [])
    .filter((file): file is { id: string; createdTime?: string; appProperties?: Record<string, string> } => Boolean(file.id))
    .map((file): LicenceRecord => ({
      id: file.id,
      name: file.appProperties?.oroName || "",
      company: file.appProperties?.oroCompany === "emporo" ? "emporo" : "emoro",
      whiteCard: file.appProperties?.oroWhiteCard || "",
      licence: file.appProperties?.oroLicence || "",
      expiry: file.appProperties?.oroExpiry || "",
      created: file.createdTime || "",
    }))
    .filter((record) => record.name.length > 0);
  return latestLicences(records);
}
