import { escapeDriveQuery } from "@/lib/reports/paths";
import {
  attachPhotoFile,
  emptyPhotoBook,
  parsePhotoBook,
  photoFolderName,
  type PhotoBook,
} from "@/lib/jobs-app/photo-book";
import type { Business } from "@/lib/jobs-app/types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const photoApp = "oro-photos";
const rootName = "ORO Before-After";
const bookName = "before-after.json";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function photoDriveConfigured(): boolean {
  const client = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const refresh = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim() ?? "";
  return client.length > 0 && secret.length > 0 && refresh.length > 20;
}

function folderQuery(name: string, parentId: string): string {
  return [
    `name = '${escapeDriveQuery(name)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `appProperties has { key='oroApp' and value='${photoApp}' }`,
    `'${escapeDriveQuery(parentId)}' in parents`,
  ].join(" and ");
}

async function driveFetch(token: string, url: string, init: RequestInit | undefined, call: FetchLike): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  return call(url, { ...init, headers, cache: "no-store" });
}

async function accessToken(call: FetchLike): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim() ?? "",
    grant_type: "refresh_token",
  });
  const response = await call(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google Drive isn't connected.");
  const json = (await response.json()) as { access_token?: unknown };
  if (typeof json.access_token !== "string") throw new Error("Google Drive isn't connected.");
  return json.access_token;
}

async function findFolder(token: string, name: string, parentId: string, call: FetchLike): Promise<string | null> {
  const params = new URLSearchParams({
    q: folderQuery(name, parentId),
    pageSize: "1",
    fields: "files(id)",
    spaces: "drive",
  });
  const response = await driveFetch(token, `${FILES_URL}?${params}`, undefined, call);
  if (!response.ok) throw new Error("The photo folder could not be opened.");
  const json = (await response.json()) as { files?: { id?: string }[] };
  return json.files?.[0]?.id ?? null;
}

async function createFolder(token: string, name: string, parentId: string, extra: Record<string, string>, call: FetchLike): Promise<string> {
  const response = await driveFetch(token, `${FILES_URL}?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
      appProperties: { oroApp: photoApp, oroFolder: "1", ...extra },
    }),
  }, call);
  if (!response.ok) throw new Error("The photo folder could not be opened.");
  const json = (await response.json()) as { id?: string };
  if (!json.id) throw new Error("The photo folder could not be opened.");
  return json.id;
}

async function rootFolder(token: string, call: FetchLike): Promise<string> {
  const params = new URLSearchParams({
    q: `name = '${rootName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='oroApp' and value='${photoApp}' } and 'root' in parents`,
    pageSize: "1",
    fields: "files(id)",
    spaces: "drive",
  });
  const response = await driveFetch(token, `${FILES_URL}?${params}`, undefined, call);
  if (!response.ok) throw new Error("The photo folder could not be opened.");
  const json = (await response.json()) as { files?: { id?: string }[] };
  if (json.files?.[0]?.id) return json.files[0].id;
  return createFolder(token, rootName, "root", {}, call);
}

async function findJobFolder(token: string, jobId: string, call: FetchLike): Promise<string | null> {
  const params = new URLSearchParams({
    q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='oroApp' and value='${photoApp}' } and appProperties has { key='oroJobId' and value='${escapeDriveQuery(jobId)}' }`,
    pageSize: "1",
    fields: "files(id)",
    spaces: "drive",
  });
  const found = await driveFetch(token, `${FILES_URL}?${params}`, undefined, call);
  if (!found.ok) throw new Error("The photo folder could not be opened.");
  const json = (await found.json()) as { files?: { id?: string }[] };
  return json.files?.[0]?.id ?? null;
}

async function jobFolder(token: string, jobId: string, title: string, call: FetchLike): Promise<string> {
  const existingJob = await findJobFolder(token, jobId, call);
  if (existingJob) return existingJob;
  const rootId = await rootFolder(token, call);
  const base = photoFolderName(title);
  const taken = await findFolder(token, base, rootId, call);
  const name = taken ? photoFolderName(`${base} ${jobId.slice(0, 8)}`) : base;
  return createFolder(token, name, rootId, { oroJobId: jobId }, call);
}

function multipart(metadata: unknown, media: Uint8Array, mime: string): { body: Uint8Array; contentType: string } {
  const boundary = "oro_photo_boundary";
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

async function uploadBytes(
  token: string,
  parentId: string,
  name: string,
  mime: string,
  bytes: Uint8Array,
  call: FetchLike,
): Promise<string> {
  const payload = multipart({ name, mimeType: mime, parents: [parentId], appProperties: { oroApp: photoApp, oroKind: "before-after" } }, bytes, mime);
  const response = await driveFetch(token, `${UPLOAD_URL}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": payload.contentType },
    body: Buffer.from(payload.body),
  }, call);
  if (!response.ok) throw new Error("The photo could not be saved.");
  const json = (await response.json()) as { id?: string };
  if (!json.id) throw new Error("The photo could not be saved.");
  return json.id;
}

async function findBookFile(token: string, folderId: string, call: FetchLike): Promise<string | null> {
  const params = new URLSearchParams({
    q: `name = '${bookName}' and trashed = false and '${escapeDriveQuery(folderId)}' in parents`,
    pageSize: "1",
    fields: "files(id)",
    spaces: "drive",
  });
  const response = await driveFetch(token, `${FILES_URL}?${params}`, undefined, call);
  if (!response.ok) throw new Error("The photo list could not be opened.");
  const json = (await response.json()) as { files?: { id?: string }[] };
  return json.files?.[0]?.id ?? null;
}

async function writeBookFile(token: string, folderId: string, book: PhotoBook, call: FetchLike): Promise<void> {
  const bytes = new TextEncoder().encode(JSON.stringify(book));
  const existing = await findBookFile(token, folderId, call);
  if (!existing) {
    await uploadBytes(token, folderId, bookName, "application/json", bytes, call);
    return;
  }
  const response = await driveFetch(token, `${UPLOAD_URL}/${encodeURIComponent(existing)}?uploadType=media`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: Buffer.from(bytes),
  }, call);
  if (!response.ok) throw new Error("The photo list could not be saved.");
}

export async function loadPhotoBook(
  business: Business,
  jobId: string,
  title: string,
  fetchImpl?: FetchLike,
): Promise<PhotoBook> {
  if (!photoDriveConfigured()) throw new Error("Google Drive isn't connected.");
  const call = fetchImpl ?? globalThis.fetch;
  const token = await accessToken(call);
  const folderId = await findJobFolder(token, jobId, call);
  if (!folderId) return emptyPhotoBook(business, jobId, title);
  const fileId = await findBookFile(token, folderId, call);
  if (!fileId) return emptyPhotoBook(business, jobId, title);
  const response = await driveFetch(token, `${FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, undefined, call);
  if (!response.ok) throw new Error("The photo list could not be opened.");
  const parsed = parsePhotoBook(await response.json().catch(() => null), { business, jobId });
  return parsed ?? emptyPhotoBook(business, jobId, title);
}

export async function savePhotoBook(book: PhotoBook, fetchImpl?: FetchLike): Promise<void> {
  if (!photoDriveConfigured()) throw new Error("Google Drive isn't connected.");
  const call = fetchImpl ?? globalThis.fetch;
  const token = await accessToken(call);
  const folderId = await jobFolder(token, book.jobId, book.title, call);
  await writeBookFile(token, folderId, book, call);
}

export async function storePhotoBytes(
  book: PhotoBook,
  input: { issueId: string; angleId: string; side: "before" | "after" | "collage"; bytes: Uint8Array; name: string },
  fetchImpl?: FetchLike,
): Promise<PhotoBook> {
  if (!photoDriveConfigured()) throw new Error("Google Drive isn't connected.");
  const call = fetchImpl ?? globalThis.fetch;
  const token = await accessToken(call);
  const folderId = await jobFolder(token, book.jobId, book.title, call);
  const fileId = await uploadBytes(token, folderId, input.name, "image/jpeg", input.bytes, call);
  const next = attachPhotoFile(book, { ...input, fileId });
  if ("error" in next) throw new Error(next.error);
  await writeBookFile(token, folderId, next, call);
  return next;
}

export async function readPhotoFile(fileId: string, fetchImpl?: FetchLike): Promise<Uint8Array | null> {
  if (!photoDriveConfigured()) return null;
  const call = fetchImpl ?? globalThis.fetch;
  const token = await accessToken(call);
  const meta = await driveFetch(token, `${FILES_URL}/${encodeURIComponent(fileId)}?fields=appProperties,mimeType`, undefined, call);
  if (!meta.ok) return null;
  const json = (await meta.json()) as { appProperties?: { oroApp?: string }; mimeType?: string };
  if (json.appProperties?.oroApp !== photoApp || json.mimeType !== "image/jpeg") return null;
  const media = await driveFetch(token, `${FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, undefined, call);
  if (!media.ok) return null;
  return new Uint8Array(await media.arrayBuffer());
}
