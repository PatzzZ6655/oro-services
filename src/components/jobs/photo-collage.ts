"use client";

import { collageLayout } from "@/lib/jobs-app/photo-book";

function drawCover(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  cell: { x: number; y: number; width: number; height: number },
) {
  const scale = Math.max(cell.width / image.width, cell.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.save();
  context.beginPath();
  context.rect(cell.x, cell.y, cell.width, cell.height);
  context.clip();
  context.drawImage(image, cell.x + (cell.width - width) / 2, cell.y + (cell.height - height) / 2, width, height);
  context.restore();
}

/** One JPEG per issue. Company logo and BEFORE | AFTER labels only. */
export async function renderCollage(rows: { before: Blob; after: Blob }[], logoUrl: string): Promise<Blob> {
  const layout = collageLayout(rows.length);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The collage could not be made.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, layout.width, layout.height);
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error("The company logo could not be loaded.");
  const logo = await createImageBitmap(await logoResponse.blob());
  const scale = Math.min(layout.logo.width / logo.width, layout.logo.height / logo.height);
  const logoWidth = logo.width * scale;
  const logoHeight = logo.height * scale;
  context.drawImage(
    logo,
    layout.logo.x + (layout.logo.width - logoWidth) / 2,
    layout.logo.y + (layout.logo.height - logoHeight) / 2,
    logoWidth,
    logoHeight,
  );
  logo.close();
  context.fillStyle = "#111111";
  context.font = "600 28px sans-serif";
  context.textAlign = "center";
  for (let index = 0; index < rows.length; index += 1) {
    const pair = rows[index];
    const beforeCell = layout.cells[index * 2];
    const afterCell = layout.cells[index * 2 + 1];
    if (!pair || !beforeCell || !afterCell) continue;
    context.fillText(beforeCell.label, beforeCell.x + beforeCell.width / 2, beforeCell.y - 12);
    context.fillText(afterCell.label, afterCell.x + afterCell.width / 2, afterCell.y - 12);
    const before = await createImageBitmap(pair.before);
    const after = await createImageBitmap(pair.after);
    drawCover(context, before, beforeCell);
    drawCover(context, after, afterCell);
    before.close();
    after.close();
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("The collage could not be made.");
  return blob;
}
