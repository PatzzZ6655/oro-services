import { UPLOAD_BUDGET_BYTES } from "@/lib/jobs-app/photos";

export async function resizeToJpeg(file: File, maxEdge: number, quality: number, index: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("encode");
    return new File([blob], `photo-${index + 1}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export async function compressFiles(files: File[], maxEdge: number, qualities: readonly number[]): Promise<File[]> {
  const quality = qualities[0] ?? 0.55;
  let current = await Promise.all(files.map((file, index) => resizeToJpeg(file, maxEdge, quality, index)));
  for (let step = 1; step < qualities.length && totalSize(current) > UPLOAD_BUDGET_BYTES; step += 1) {
    const nextQuality = qualities[step] ?? quality;
    current = await Promise.all(files.map((file, index) => resizeToJpeg(file, maxEdge, nextQuality, index)));
  }
  return current;
}

function totalSize(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}
