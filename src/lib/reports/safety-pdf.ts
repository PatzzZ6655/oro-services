import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { companies, type CompanyId } from "@/lib/reports/catalog";
import { formatAuDate } from "@/lib/reports/dates";
import type { ReportPhoto } from "@/lib/reports/pdf";
import type { SafetyDocument } from "@/lib/reports/safety";

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 40;
const navy = rgb(15 / 255, 23 / 255, 42 / 255);
const orange = rgb(234 / 255, 88 / 255, 12 / 255);
const blue = rgb(30 / 255, 64 / 255, 175 / 255);
const slate = rgb(71 / 255, 85 / 255, 105 / 255);

function asset(file: "regular" | "semibold" | CompanyId): Uint8Array {
  if (file === "regular") return new Uint8Array(readFileSync(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")));
  if (file === "semibold") return new Uint8Array(readFileSync(join(process.cwd(), "assets/fonts/Inter-SemiBold.ttf")));
  if (file === "emoro") return new Uint8Array(readFileSync(join(process.cwd(), "public/logos/emoro-building.png")));
  return new Uint8Array(readFileSync(join(process.cwd(), "public/logos/emporo-plumbing.png")));
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) current = next;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

export async function buildSafetyPdf(document: SafetyDocument, photos: ReportPhoto[] = []): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const company = companies[document.company];
  const regular = await doc.embedFont(asset("regular"), { subset: true });
  const semibold = await doc.embedFont(asset("semibold"), { subset: true });
  const logo = await doc.embedPng(asset(document.company));
  const accent = company.accent === "orange" ? orange : blue;
  doc.setTitle(`${document.title} · ${company.name}`);
  doc.setAuthor(company.name);
  doc.setCreator(company.legalName);

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 36;
  const pages: PDFPage[] = [page];

  const paint = (target: PDFPage, compact: boolean) => {
    if (compact) {
      target.drawText(company.name, { x: margin, y: pageHeight - 28, size: 9, font: semibold, color: navy });
      target.drawLine({ start: { x: margin, y: pageHeight - 36 }, end: { x: pageWidth - margin, y: pageHeight - 36 }, thickness: 1.25, color: accent });
      return pageHeight - 52;
    }
    const width = company.id === "emoro" ? 148 : 160;
    const height = (logo.height / logo.width) * width;
    target.drawImage(logo, { x: margin, y: pageHeight - 28 - height, width, height });
    const rule = pageHeight - 40 - height;
    target.drawLine({ start: { x: margin, y: rule }, end: { x: pageWidth - margin, y: rule }, thickness: 1.25, color: accent });
    return rule - 22;
  };

  y = paint(page, false);
  const ensure = (need: number) => {
    if (y - need > 48) return;
    page = doc.addPage([pageWidth, pageHeight]);
    pages.push(page);
    y = paint(page, true);
  };
  const text = (value: string, size: number, font: PDFFont, color = navy, gap = 4) => {
    for (const row of wrap(value, font, size, pageWidth - margin * 2)) {
      ensure(size + gap);
      page.drawText(row, { x: margin, y, size, font, color });
      y -= size + gap;
    }
  };

  text(document.title, 16, semibold, navy, 6);
  text(`${formatAuDate(document.date)} · ${document.address}`, 10, regular, slate, 10);
  if (document.note) {
    text(document.note, 9, regular, navy, 8);
  }
  for (const field of document.fields) {
    if (!field.value || field.value === "Not recorded" || field.value === "None" || field.value === "Open") continue;
    text(field.label, 11, semibold, accent, 3);
    text(field.value, 10, regular, navy, 8);
  }
  if (document.ticks) {
    text("High risk construction work", 11, semibold, accent, 4);
    for (const tick of document.ticks.filter((item) => item.on)) text(`Applies: ${tick.label}`, 10, regular, navy, 2);
    y -= 6;
  }
  if (document.steps) {
    text("Job steps", 11, semibold, accent, 4);
    document.steps.forEach((step, index) => {
      text(`${index + 1}. ${step.step}`, 10, semibold, navy, 2);
      text(`Hazard: ${step.hazard}`, 10, regular, slate, 2);
      text(`Control: ${step.control}`, 10, regular, navy, 6);
    });
  }
  for (const group of document.checks ?? []) {
    text(group.title, 11, semibold, accent, 4);
    const quiet = group.rows.every((row) => (row.result === "pass" || row.result === "yes") && !row.comment);
    if (quiet) {
      text(group.rows.some((row) => row.result === "yes") ? "All yes." : "All pass.", 10, regular, navy, 4);
      continue;
    }
    const rest = group.rows.filter((row) => (row.result === "pass" || row.result === "yes") && !row.comment);
    for (const [index, row] of group.rows.entries()) {
      if ((row.result === "pass" || row.result === "yes") && !row.comment) continue;
      const mark = row.result === "pass" ? "Pass" : row.result === "fail" ? "Fail" : row.result === "yes" ? "Yes" : row.result === "no" ? "No" : "N/A";
      text(`${row.label}: ${mark}${row.comment ? ` — ${row.comment}` : ""}`, 10, regular, navy, 2);
      const shots = photos.filter((photo) => photo.itemKey === `${group.photoGroup}.${row.id}`);
      if (shots.length > 0) {
        text(`Item ${index + 1}: ${row.label}`, 8, regular, slate, 2);
        let x = margin;
        let tallest = 0;
        for (const shot of shots) {
          const image = shot.mime === "image/png" ? await doc.embedPng(shot.bytes) : await doc.embedJpg(shot.bytes);
          const thumbW = 92;
          const thumbH = Math.min(68, (image.height / image.width) * thumbW);
          if (x + thumbW > pageWidth - margin) {
            y -= tallest + 8;
            x = margin;
            tallest = 0;
          }
          ensure(thumbH + 8);
          page.drawImage(image, { x, y: y - thumbH, width: thumbW, height: thumbH });
          x += thumbW + 8;
          tallest = Math.max(tallest, thumbH);
        }
        y -= tallest + 8;
      }
    }
    if (rest.length > 0) text("Other items: pass.", 10, regular, navy, 2);
    y -= 4;
  }
  if (document.air) {
    text("Atmospheric tests", 11, semibold, accent, 4);
    for (const row of document.air) text(`${row.time} · O2 ${row.oxygen} · LEL ${row.lel} · CO ${row.co} · ${row.result}`, 10, regular, navy, 2);
    y -= 6;
  }
  if (document.log) {
    text("Entry log", 11, semibold, accent, 4);
    for (const row of document.log) text(`${row.name} · in ${row.timeIn} · out ${row.timeOut}`, 10, regular, navy, 2);
    y -= 6;
  }
  text(document.signLabel, 11, semibold, accent, 4);
  for (const sign of document.signs) {
    text(`${sign.name} · ${formatAuDate(sign.date)}`, 10, regular, navy, 2);
    const image = await doc.embedPng(sign.signature);
    const width = 120;
    const height = Math.min(48, (image.height / image.width) * width);
    ensure(height + 8);
    page.drawImage(image, { x: margin, y: y - height, width, height });
    y -= height + 10;
  }
  pages.forEach((target, index) => {
    target.drawText(company.name, { x: margin, y: 28, size: 8, font: regular, color: slate });
    target.drawText(document.footer, { x: margin, y: 16, size: 7, font: regular, color: slate });
    target.drawText(String(index + 1), { x: pageWidth - margin - 10, y: 22, size: 8, font: regular, color: slate });
  });
  return doc.save();
}
