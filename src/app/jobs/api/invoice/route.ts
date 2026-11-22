import { isAmountLayout, isInvoiceType, isNotesMode, isQaChoice, type InvoiceTask } from "@/lib/jobs-app/invoice";
import { jobsJson, requireJobsUser } from "@/lib/jobs-app/guard";
import { invoiceContext, invoiceCreate, invoiceDraft, invoiceFinish } from "@/lib/jobs-app/webhooks";
import { isBusiness } from "@/lib/jobs-app/types";

export const maxDuration = 60;

function tasks(value: unknown): InvoiceTask[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        label: typeof row.label === "string" ? row.label : "",
        text: typeof row.text === "string" ? row.text : "",
      };
    })
    .filter((row): row is InvoiceTask => row !== null);
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function POST(request: Request) {
  const denied = await requireJobsUser(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jobsJson({ ok: false, error: "bad_request", message: "That request was not valid." }, 400);
  }
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const mode = input.mode;
  const business = input.business;
  const type = input.type;
  const jobId = typeof input.jobId === "string" ? input.jobId : "";
  if (!isBusiness(business) || !isInvoiceType(type)) {
    return jobsJson({ ok: false, error: "bad_request", message: "Choose the company and the invoice type." }, 400);
  }
  if (mode === "invoiceContext") {
    const result = await invoiceContext({ business, type, jobId });
    return jobsJson(result.body, result.status);
  }
  if (mode === "invoiceDraft") {
    const result = await invoiceDraft({ business, type, jobId, dictation: typeof input.dictation === "string" ? input.dictation : "" });
    return jobsJson(result.body, result.status);
  }
  if (mode === "invoiceCreate") {
    const result = await invoiceCreate({
      business,
      type,
      jobId,
      invoiceNumber: typeof input.invoiceNumber === "string" ? input.invoiceNumber : "",
      primaryObjective: typeof input.primaryObjective === "string" ? input.primaryObjective : "",
      tasks: tasks(input.tasks),
      recommendation: typeof input.recommendation === "string" ? input.recommendation : "",
      notesMode: isNotesMode(input.notesMode) ? input.notesMode : "remove",
      notesText: typeof input.notesText === "string" ? input.notesText : "",
      qaBox: isQaChoice(input.qaBox) ? input.qaBox : "keep",
      amountLayout: isAmountLayout(input.amountLayout) ? input.amountLayout : "combined",
      labourLabel: typeof input.labourLabel === "string" ? input.labourLabel : "",
      keepCallout: typeof input.keepCallout === "boolean" ? input.keepCallout : undefined,
      variationDesc: typeof input.variationDesc === "string" ? input.variationDesc : "",
      scopeArea: typeof input.scopeArea === "string" ? input.scopeArea : "",
      depositObjective: typeof input.depositObjective === "string" ? input.depositObjective : "",
      conditions: strings(input.conditions),
    });
    return jobsJson(result.body, result.status);
  }
  if (mode === "invoiceFinish") {
    const result = await invoiceFinish({
      business,
      type,
      jobId,
      invoicePageId: typeof input.invoicePageId === "string" ? input.invoicePageId : "",
      confirm: input.confirm === "yes" ? "yes" : "",
    });
    return jobsJson(result.body, result.status);
  }
  return jobsJson({ ok: false, error: "bad_request", message: "That request was not valid." }, 400);
}
