import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  companies,
  companyFor,
  reportCard,
  type CheckAnswer,
  type CompanyId,
  type ElectricalReport,
  type GasReport,
  type ReportValue,
} from "@/lib/reports/catalog";
import { formatAuDate } from "@/lib/reports/dates";

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 40;
const contentWidth = pageWidth - margin * 2;

const navy = rgb(15 / 255, 23 / 255, 42 / 255);
const orange = rgb(234 / 255, 88 / 255, 12 / 255);
const blue = rgb(30 / 255, 64 / 255, 175 / 255);
const slate = rgb(71 / 255, 85 / 255, 105 / 255);
const ink = rgb(15 / 255, 23 / 255, 42 / 255);
const line = rgb(226 / 255, 232 / 255, 240 / 255);
const white = rgb(1, 1, 1);
const fail = rgb(153 / 255, 27 / 255, 27 / 255);

export type ReportPhoto = {
  name: string;
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png";
};

function readAsset(file: "regular" | "semibold" | CompanyId): Uint8Array {
  if (file === "regular") return new Uint8Array(readFileSync(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")));
  if (file === "semibold") return new Uint8Array(readFileSync(join(process.cwd(), "assets/fonts/Inter-SemiBold.ttf")));
  if (file === "emoro") return new Uint8Array(readFileSync(join(process.cwd(), "public/logos/emoro-building.png")));
  return new Uint8Array(readFileSync(join(process.cwd(), "public/logos/emporo-plumbing.png")));
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= width) {
        current = word;
        continue;
      }
      let chunk = "";
      for (const char of word) {
        const trial = chunk + char;
        if (font.widthOfTextAtSize(trial, size) > width && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = trial;
        }
      }
      current = chunk;
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

export async function buildReportPdf(options: {
  report: ReportValue;
  signature: Uint8Array;
  photos: ReportPhoto[];
  submittedBy: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const companyId = companyFor(options.report);
  const company = companies[companyId];
  const regular = await doc.embedFont(readAsset("regular"), { subset: true });
  const semibold = await doc.embedFont(readAsset("semibold"), { subset: true });
  const logo = await doc.embedPng(readAsset(companyId));
  const signature = await doc.embedPng(options.signature);
  const photos: PDFImage[] = [];
  for (const photo of options.photos) {
    photos.push(photo.mime === "image/png" ? await doc.embedPng(photo.bytes) : await doc.embedJpg(photo.bytes));
  }

  const accentColor = company.accent === "orange" ? orange : blue;
  const title = reportCard(options.report.kind).title;
  const meta = docMeta(options.report);

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 92;

  const paintHeader = (target: PDFPage, compact: boolean) => {
    const bar = compact ? 36 : 78;
    target.drawRectangle({ x: 0, y: pageHeight - bar, width: pageWidth, height: bar, color: accentColor });
    if (compact) {
      target.drawText(company.name, { x: margin, y: pageHeight - 24, size: 11, font: semibold, color: white });
      return;
    }
    drawLogo(target, logo, margin, pageHeight - 66, companyId === "emoro" ? 150 : 168);
  };

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    paintHeader(page, true);
    y = pageHeight - 56;
  };

  const ensure = (height: number) => {
    if (y - height < 52) newPage();
  };

  const text = (value: string, size: number, font: PDFFont, color: RGB, gap = 4) => {
    for (const row of wrap(value, font, size, contentWidth)) {
      ensure(size + 4);
      page.drawText(row || " ", { x: margin, y, size, font, color });
      y -= size + 3;
    }
    y -= gap;
  };

  const heading = (value: string) => {
    ensure(28);
    y -= 6;
    page.drawRectangle({ x: margin, y: y + 2, width: 28, height: 3, color: accentColor });
    y -= 16;
    page.drawText(value, { x: margin, y, size: 13, font: semibold, color: navy });
    y -= 16;
  };

  const pair = (label: string, value: string) => {
    ensure(30);
    page.drawText(label, { x: margin, y, size: 8, font: regular, color: slate });
    y -= 12;
    text(value || "—", 11, semibold, ink, 6);
  };

  const checks = (items: CheckAnswer[]) => {
    for (const item of items) {
      const detail = [item.reading, item.comment].filter(Boolean).join(" — ");
      const labelLines = wrap(item.label, regular, 10, contentWidth - 64);
      const detailLines = detail ? wrap(detail, regular, 9, contentWidth - 12) : [];
      ensure(labelLines.length * 13 + detailLines.length * 12 + 10);
      const result = item.result === "pass" ? "Pass" : item.result === "fail" ? "Fail" : "N/A";
      const resultWidth = semibold.widthOfTextAtSize(result, 10);
      labelLines.forEach((row, index) => {
        page.drawText(row, { x: margin, y, size: 10, font: regular, color: ink });
        if (index === 0) {
          page.drawText(result, {
            x: pageWidth - margin - resultWidth,
            y,
            size: 10,
            font: semibold,
            color: item.result === "fail" ? fail : navy,
          });
        }
        y -= 13;
      });
      for (const row of detailLines) {
        page.drawText(row, { x: margin + 8, y, size: 9, font: regular, color: slate });
        y -= 12;
      }
      page.drawLine({
        start: { x: margin, y: y + 4 },
        end: { x: pageWidth - margin, y: y + 4 },
        thickness: 0.4,
        color: line,
      });
      y -= 6;
    }
  };

  paintHeader(page, false);
  y = pageHeight - 108;
  page.drawText(title, { x: margin, y, size: 18, font: semibold, color: navy });
  y -= 16;
  text(`${company.legalName}  ·  ABN ${company.abn}`, 9, regular, slate, 2);
  if (meta.note) text(meta.note, 9, regular, slate, 8);

  for (const row of meta.rows) pair(row.label, row.value);
  for (const section of meta.sections) {
    heading(section.title);
    if (section.prose) text(section.prose, 10, regular, ink, 6);
    if (section.checks) checks(section.checks);
    if (section.lines) {
      for (const row of section.lines) text(row, 10, regular, ink, 2);
      y -= 4;
    }
  }

  heading("Signature");
  ensure(80);
  const sigWidth = 180;
  const sigHeight = Math.min(70, (signature.height / signature.width) * sigWidth);
  page.drawRectangle({ x: margin, y: y - sigHeight - 6, width: sigWidth + 12, height: sigHeight + 12, color: white, borderColor: line, borderWidth: 1 });
  page.drawImage(signature, { x: margin + 6, y: y - sigHeight, width: sigWidth, height: sigHeight });
  y -= sigHeight + 20;
  text(`Signed for ${company.name}. Filed by ${options.submittedBy}.`, 8, regular, slate, 4);

  if (photos.length > 0) {
    heading("Photos");
    photos.forEach((photo, index) => {
      const maxWidth = contentWidth;
      const maxHeight = 260;
      const scale = Math.min(maxWidth / photo.width, maxHeight / photo.height, 1);
      const width = photo.width * scale;
      const height = photo.height * scale;
      ensure(height + 16);
      page.drawImage(photo, { x: margin, y: y - height, width, height });
      y -= height + 14;
      text(options.photos[index]?.name || `Photo ${index + 1}`, 8, regular, slate, 4);
    });
  }

  const pages = doc.getPages();
  pages.forEach((target, index) => {
    target.drawText(`${company.name} · ABN ${company.abn}`, { x: margin, y: 28, size: 8, font: regular, color: slate });
    const pager = `Page ${index + 1} of ${pages.length}`;
    target.drawText(pager, {
      x: pageWidth - margin - regular.widthOfTextAtSize(pager, 8),
      y: 28,
      size: 8,
      font: regular,
      color: slate,
    });
  });

  doc.setTitle(`${title} · ${company.name}`);
  doc.setAuthor(company.name);
  doc.setCreator(company.legalName);
  doc.setSubject(options.report.address);
  return doc.save();
}

function drawLogo(page: PDFPage, image: PDFImage, x: number, y: number, width: number) {
  const height = (image.height / image.width) * width;
  page.drawRectangle({ x: x - 4, y: y - 4, width: width + 8, height: height + 8, color: white });
  page.drawImage(image, { x, y, width, height });
}

function resultLabel(items: CheckAnswer[]): string {
  const failed = items.filter((item) => item.result === "fail").length;
  if (failed > 0) return `${failed} fail`;
  return "No fails";
}

type Section = {
  title: string;
  prose?: string;
  checks?: CheckAnswer[];
  lines?: string[];
};

function docMeta(report: ReportValue): { note: string; rows: { label: string; value: string }[]; sections: Section[] } {
  if (report.kind === "site-job-sheet") {
    return {
      note: "",
      rows: [
        { label: "Worker", value: report.workerName },
        { label: "Date", value: formatAuDate(report.date) },
        { label: "Job / invoice", value: report.jobNumber },
        { label: "Site", value: report.address },
        { label: "Time", value: `${report.startTime} to ${report.finishTime}` },
      ],
      sections: [
        { title: "Work performed", prose: report.work },
        { title: "Materials", prose: report.materials || "None recorded." },
        {
          title: "Safety",
          lines: report.safety.map((item) => `${item.label}: ${item.answer === "yes" ? "Yes" : "No"}`),
        },
        { title: "Issues", prose: report.issues || "None recorded." },
      ],
    };
  }

  if (report.kind === "job-sign-off") {
    return {
      note: "",
      rows: [
        { label: "Client", value: report.clientName },
        { label: "Completion date", value: formatAuDate(report.date) },
        { label: "Job / invoice", value: report.jobNumber },
        { label: "Site", value: report.address },
        { label: "Copy sent to", value: report.clientEmail || "No client email" },
      ],
      sections: [
        { title: "Work completed", prose: report.work },
        {
          title: "Confirmations",
          lines: report.confirmations.map((item) => `${item.label}: Yes`),
        },
        { title: "Comments", prose: report.comments || "None recorded." },
      ],
    };
  }

  if (report.kind === "gas-safety") return gasMeta(report);
  return electricalMeta(report);
}

function gasMeta(report: GasReport): { note: string; rows: { label: string; value: string }[]; sections: Section[] } {
  return {
    note: "Victorian rental gas safety check. Residential Tenancies Regulations 2021. AS/NZS 5601.1. AS 4575.",
    rows: [
      { label: "Property", value: report.address },
      { label: "Rental provider / agent", value: `${report.providerName} · ${report.providerEmail}` },
      { label: "Check date", value: formatAuDate(report.date) },
      { label: "Next check due", value: formatAuDate(report.nextDue) },
      { label: "Gasfitter", value: report.gasfitterName },
      { label: "Licence / registration", value: report.licence },
      { label: "Type A servicing endorsement", value: "Confirmed" },
      { label: "Overall result", value: report.overall === "compliant" ? "Compliant" : "Non-compliant" },
    ],
    sections: [
      { title: `Installation checks · ${resultLabel(report.checks)}`, checks: report.checks },
      {
        title: "Type A appliances",
        lines:
          report.appliances.length > 0
            ? report.appliances.map(
                (item, index) =>
                  `${index + 1}. ${item.type}, ${item.location}. ${item.makeModel}. Serviced to AS 4575: ${item.serviced === "yes" ? "Yes" : "No"}. CO / spillage: ${item.coSpillage}.${item.recordNo ? ` Record ${item.recordNo}.` : ""}`,
              )
            : ["No Type A appliances recorded."],
      },
      { title: "Faults and recommendations", prose: report.faults || "None recorded." },
      {
        title: "Urgent or disconnected appliance",
        prose: report.urgent === "yes" ? `Yes. ${report.urgentDetails}` : "No.",
      },
    ],
  };
}

function electricalMeta(report: ElectricalReport): { note: string; rows: { label: string; value: string }[]; sections: Section[] } {
  const extent = report.extent
    .map((item) => `${item.label}: ${item.status === "included" ? "Included" : item.status === "excluded" ? "Not included" : "N/A"}`)
    .join("\n");
  return {
    note: "Electrical safety check for a Victorian rental. AS/NZS 3019:2022 section 4. Layout follows the Energy Safe Victoria report.",
    rows: [
      { label: "Property", value: report.address },
      { label: "Rental provider / agent", value: `${report.providerName} · ${report.providerEmail}` },
      { label: "Check date", value: formatAuDate(report.date) },
      { label: "Previous check", value: report.previousDate ? formatAuDate(report.previousDate) : "Not recorded" },
      { label: "Next check due", value: formatAuDate(report.nextDue) },
      { label: "Electrician", value: report.electricianName },
      { label: "Licence", value: report.licence },
      { label: "REC", value: report.rec || "Not recorded" },
      { label: "Overall result", value: report.overall === "compliant" ? "Compliant" : "Non-compliant" },
    ],
    sections: [
      { title: "Extent of the check", prose: report.limitations ? `${extent}\n\nLimitations: ${report.limitations}` : extent },
      { title: `Visual inspection · ${resultLabel(report.visual)}`, checks: report.visual },
      { title: `Polarity and correct connections · ${resultLabel(report.polarity)}`, checks: report.polarity },
      { title: `Earth continuity · ${resultLabel(report.earth)}`, checks: report.earth },
      {
        title: "RCD tests",
        lines: report.rcds.map((row) => {
          const time = row.timeTest ? `${row.timeTest === "pass" ? "Pass" : "Fail"}${row.timeMs ? ` ${row.timeMs} ms` : ""}` : "Not timed";
          return `${row.circuit}. Push-button ${row.pushButton === "pass" ? "Pass" : "Fail"}. Time test ${time}.`;
        }),
      },
      {
        title: "Smoke alarms",
        prose: `Correctly installed, working, and tested to the manufacturer's instructions: ${report.smokeAlarms === "yes" ? "Yes" : "No"}. Next smoke alarm check due ${formatAuDate(report.smokeNextDue)}.${report.smokeComment ? ` ${report.smokeComment}` : ""}`,
      },
      { title: "Faults and recommendations", prose: report.faults || "None recorded." },
      {
        title: "Urgent hazards",
        prose: report.urgent === "yes" ? `Yes. ${report.urgentDetails}` : "No.",
      },
    ],
  };
}
