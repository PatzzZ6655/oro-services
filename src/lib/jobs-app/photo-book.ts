import { isBusiness, type Business } from "@/lib/jobs-app/types";

export const maxPhotoAngles = 4;

/** Room lists differ by company. Other is the catch-all. */
export const photoAreas: Record<Business, readonly string[]> = {
  emoro: ["Kitchen", "Bathroom", "Laundry", "Bedroom", "Living", "Exterior", "Roof", "Garden", "Other"],
  emporo: ["Kitchen", "Bathroom", "Laundry", "Toilet", "Hot water", "Drainage", "Exterior", "Garden", "Other"],
};

export type PhotoAngle = {
  id: string;
  beforeId: string;
  afterId: string;
};

export type PhotoIssue = {
  id: string;
  area: string;
  note: string;
  angles: PhotoAngle[];
  collageId: string;
};

export type PhotoBook = {
  version: 1;
  business: Business;
  jobId: string;
  title: string;
  issues: PhotoIssue[];
};

const idPattern = /^[A-Za-z0-9-]{8,80}$/;

export function photoFolderName(title: string): string {
  const cleaned = title
    .replace(/[\u0000-\u001f\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned || "Job";
}

export function rememberArea(recent: readonly string[], area: string): string[] {
  const next = [area, ...recent.filter((item) => item !== area)];
  return next.slice(0, 4);
}

export function orderedAreas(business: Business, recent: readonly string[]): string[] {
  const allowed = photoAreas[business];
  const first = recent.filter((area) => allowed.includes(area));
  return [...first, ...allowed.filter((area) => !first.includes(area))];
}

export function emptyPhotoBook(business: Business, jobId: string, title: string): PhotoBook {
  return { version: 1, business, jobId, title: title.trim().slice(0, 120), issues: [] };
}

function cleanId(value: unknown): string {
  return typeof value === "string" && idPattern.test(value) ? value : "";
}

function cleanFileId(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value) ? value : "";
}

export function parsePhotoBook(raw: unknown, expected: { business: Business; jobId: string }): PhotoBook | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { version?: unknown; business?: unknown; jobId?: unknown; title?: unknown; issues?: unknown };
  if (row.version !== 1 || !isBusiness(row.business) || row.business !== expected.business) return null;
  if (typeof row.jobId !== "string" || row.jobId.replace(/-/g, "") !== expected.jobId.replace(/-/g, "")) return null;
  const title = typeof row.title === "string" ? row.title.trim().slice(0, 120) : "";
  const issues: PhotoIssue[] = [];
  if (Array.isArray(row.issues)) {
    for (const item of row.issues) {
      if (!item || typeof item !== "object") continue;
      const issue = item as { id?: unknown; area?: unknown; note?: unknown; angles?: unknown; collageId?: unknown };
      const id = cleanId(issue.id);
      const area = typeof issue.area === "string" ? issue.area : "";
      if (!id || !photoAreas[expected.business].includes(area)) continue;
      const angles: PhotoAngle[] = [];
      if (Array.isArray(issue.angles)) {
        for (const angle of issue.angles) {
          if (!angle || typeof angle !== "object") continue;
          const parsed = angle as { id?: unknown; beforeId?: unknown; afterId?: unknown };
          const angleId = cleanId(parsed.id);
          if (!angleId) continue;
          angles.push({ id: angleId, beforeId: cleanFileId(parsed.beforeId), afterId: cleanFileId(parsed.afterId) });
          if (angles.length >= maxPhotoAngles) break;
        }
      }
      issues.push({
        id,
        area,
        note: typeof issue.note === "string" ? issue.note.replace(/\s+/g, " ").trim().slice(0, 140) : "",
        angles,
        collageId: cleanFileId(issue.collageId),
      });
    }
  }
  return { version: 1, business: expected.business, jobId: expected.jobId.replace(/-/g, ""), title, issues };
}

export function addPhotoIssue(book: PhotoBook, area: string, note: string, id: string): PhotoBook | { error: string } {
  if (!photoAreas[book.business].includes(area)) return { error: "Choose an area." };
  const cleaned = note.replace(/\s+/g, " ").trim().slice(0, 140);
  if (!cleaned) return { error: "Add a short note." };
  if (!idPattern.test(id)) return { error: "That issue could not be saved." };
  return { ...book, issues: [...book.issues, { id, area, note: cleaned, angles: [], collageId: "" }] };
}

export function attachPhotoFile(
  book: PhotoBook,
  input: { issueId: string; angleId: string; side: "before" | "after" | "collage"; fileId: string },
): PhotoBook | { error: string } {
  const fileId = cleanFileId(input.fileId);
  if (!fileId) return { error: "The photo could not be saved." };
  const issue = book.issues.find((item) => item.id === input.issueId);
  if (!issue) return { error: "That issue is not on this job." };
  if (input.side === "collage") {
    return { ...book, issues: book.issues.map((item) => (item.id === issue.id ? { ...item, collageId: fileId } : item)) };
  }
  if (!idPattern.test(input.angleId)) return { error: "The photo could not be saved." };
  const existing = issue.angles.find((angle) => angle.id === input.angleId);
  if (input.side === "before" && !existing && issue.angles.length >= maxPhotoAngles) return { error: "Four angles is the most for one issue." };
  if (input.side === "after" && !existing?.beforeId) return { error: "Take the before photo first." };
  return {
    ...book,
    issues: book.issues.map((item) => {
      if (item.id !== issue.id) return item;
      if (input.side === "before" && existing) {
        return { ...item, angles: item.angles.map((angle) => (angle.id === input.angleId ? { ...angle, beforeId: fileId } : angle)) };
      }
      if (input.side === "before") {
        return { ...item, angles: [...item.angles, { id: input.angleId, beforeId: fileId, afterId: "" }] };
      }
      return { ...item, angles: item.angles.map((angle) => (angle.id === input.angleId ? { ...angle, afterId: fileId } : angle)) };
    }),
  };
}

export function swapAfterPhotos(book: PhotoBook, issueId: string, leftId: string, rightId: string): PhotoBook | { error: string } {
  const issue = book.issues.find((item) => item.id === issueId);
  if (!issue) return { error: "That issue is not on this job." };
  const left = issue.angles.find((angle) => angle.id === leftId);
  const right = issue.angles.find((angle) => angle.id === rightId);
  if (!left || !right || left.id === right.id) return { error: "Choose two after photos." };
  return {
    ...book,
    issues: book.issues.map((item) => {
      if (item.id !== issueId) return item;
      return {
        ...item,
        angles: item.angles.map((angle) => {
          if (angle.id === leftId) return { ...angle, afterId: right.afterId };
          if (angle.id === rightId) return { ...angle, afterId: left.afterId };
          return angle;
        }),
      };
    }),
  };
}

export function unshotAngles(issue: PhotoIssue): PhotoAngle[] {
  return issue.angles.filter((angle) => angle.beforeId && !angle.afterId);
}

export function collageReady(issue: PhotoIssue): boolean {
  return issue.angles.length > 0 && issue.angles.every((angle) => angle.beforeId && angle.afterId);
}

export type CollageCell = { x: number; y: number; width: number; height: number; label: "BEFORE" | "AFTER" };

/** Side-by-side rows. Labels only. No address, date, or note. */
export function collageLayout(rowCount: number): { width: number; height: number; logo: { x: number; y: number; width: number; height: number }; cells: CollageCell[] } {
  const rows = Math.max(1, Math.min(maxPhotoAngles, rowCount));
  const width = 1080;
  const pad = 28;
  const logo = { x: (width - 280) / 2, y: pad, width: 280, height: 84 };
  const labelHeight = 40;
  const cellWidth = (width - pad * 3) / 2;
  const cellHeight = Math.round(cellWidth * 0.75);
  const cells: CollageCell[] = [];
  for (let row = 0; row < rows; row += 1) {
    const y = logo.y + logo.height + pad + row * (labelHeight + cellHeight + pad);
    cells.push(
      { x: pad, y: y + labelHeight, width: cellWidth, height: cellHeight, label: "BEFORE" },
      { x: pad * 2 + cellWidth, y: y + labelHeight, width: cellWidth, height: cellHeight, label: "AFTER" },
    );
  }
  const last = cells[cells.length - 1];
  return { width, height: (last?.y ?? 0) + (last?.height ?? 0) + pad, logo, cells };
}
