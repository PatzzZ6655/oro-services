export const LEAVE_MAX_EDGE = 1280;
export const LEAVE_QUALITIES = [0.55, 0.4] as const;
export const NEW_JOB_MAX_EDGE = 1600;
export const NEW_JOB_QUALITIES = [0.6, 0.45] as const;
export const UPLOAD_BUDGET_BYTES = 4 * 1024 * 1024;
export const NEW_JOB_MAX_IMAGES = 4;
export const LEAVE_MAX_PHOTOS = 12;

/** Add new image files without dropping the ones already chosen. */
export function addPhotos(current: File[], incoming: Iterable<File>, max?: number): File[] {
  const next = [...current];
  for (const file of incoming) {
    if (!file.type.startsWith("image/")) continue;
    if (max !== undefined && next.length >= max) break;
    next.push(file);
  }
  return next;
}

export function keptCount(sizes: number[], budget = UPLOAD_BUDGET_BYTES): number {
  let total = 0;
  let count = 0;
  for (const size of sizes) {
    if (size > budget) return count;
    if (total + size > budget) break;
    total += size;
    count += 1;
  }
  return count;
}
