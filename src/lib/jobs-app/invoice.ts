export const invoiceDraftKey = "oro.jobs.invoice";

export const invoiceTypes = ["general", "final", "deposit", "stage1", "stage2"] as const;
export type InvoiceType = (typeof invoiceTypes)[number];

export const notesModes = ["remove", "custom", "append", "keep"] as const;
export type NotesMode = (typeof notesModes)[number];

export const qaChoices = ["remove", "keep"] as const;
export type QaChoice = (typeof qaChoices)[number];

export const amountLayouts = ["combined", "separate", "asQuoted", "callout", "keepAll"] as const;
export type AmountLayout = (typeof amountLayouts)[number];

export type InvoiceTask = { label: string; text: string };

export function isInvoiceType(value: unknown): value is InvoiceType {
  return invoiceTypes.includes(value as InvoiceType);
}

export function invoiceTypeLabel(type: InvoiceType): string {
  if (type === "stage1") return "Stage 1";
  if (type === "stage2") return "Stage 2";
  if (type === "final") return "Final";
  if (type === "deposit") return "Deposit";
  return "General";
}

export function invoiceDictationHint(type: InvoiceType): { english: string; chinese: string } {
  if (type === "deposit") {
    return {
      english: "The scope area and the conditions.",
      chinese: "范围，以及要写上的条件。",
    };
  }
  if (type === "stage1" || type === "stage2") {
    return {
      english: "The milestone this invoice covers.",
      chinese: "这一期做到哪一步。",
    };
  }
  return {
    english: "Where, what broke, the cause, the steps, the parts, the test result, how many visits, and anything to flag.",
    chinese: "地点、坏了什么、原因、步骤、配件、测试结果、来了几次、要特别说明的事。",
  };
}

export function isNotesMode(value: unknown): value is NotesMode {
  return notesModes.includes(value as NotesMode);
}

export function isQaChoice(value: unknown): value is QaChoice {
  return qaChoices.includes(value as QaChoice);
}

export function isAmountLayout(value: unknown): value is AmountLayout {
  return amountLayouts.includes(value as AmountLayout);
}

export function amountLayoutLabel(layout: AmountLayout): string {
  if (layout === "asQuoted") return "As quoted";
  if (layout === "keepAll") return "Keep all";
  if (layout === "separate") return "Separate";
  if (layout === "callout") return "Callout";
  return "Combined";
}
