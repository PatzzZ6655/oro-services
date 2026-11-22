"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobs } from "@/components/jobs/api";
import { Alert, JobsButton, JobsLink, Screen, Spinner, fieldClass } from "@/components/jobs/ui";
import {
  amountLayoutLabel,
  amountLayouts,
  invoiceDictationHint,
  invoiceDraftKey,
  invoiceNumberToShow,
  invoiceTypeLabel,
  invoiceTypes,
  isAmountLayout,
  isNotesMode,
  isQaChoice,
  type AmountLayout,
  type InvoiceTask,
  type InvoiceType,
  type NotesMode,
  type QaChoice,
} from "@/lib/jobs-app/invoice";
import type { Business } from "@/lib/jobs-app/types";

type Step = "type" | "context" | "dictate" | "edit" | "ready";

type ContextBody = {
  ok: true;
  suggestedNumber: string;
  numberNote: string;
  customer: { name: string };
  property: { name: string };
  existingInvoice: { number: string; status: string; url: string };
  reuseExistingPage: boolean;
};

type DraftBody = {
  ok: true;
  draft: {
    primaryObjective: string;
    tasks: InvoiceTask[];
    recommendation: string;
    notesText: string;
    suggestedClauses: string[];
    qaBox: QaChoice | "";
    amountLayoutSuggestion: AmountLayout | "";
    scopeArea: string;
    depositObjective: string;
    conditions: string[];
    missing: string[];
    questions: string[];
  };
};

type CreatedBody = {
  ok: true;
  status: "created" | "exists" | "pending";
  invoicePageId: string;
  notionUrl: string;
  invoiceNumber: string;
  docUrl: string;
  templateCheck: string;
  isTest: boolean;
  message: string;
};

type Saved = {
  jobId: string;
  step: Step;
  invoiceType: InvoiceType;
  invoiceNumber: string;
  clientName: string;
  address: string;
  numberNote: string;
  existingWarning: string;
  dictation: string;
  primaryObjective: string;
  tasks: InvoiceTask[];
  recommendationOn: boolean;
  recommendation: string;
  notesMode: NotesMode;
  notesText: string;
  clauses: string[];
  qaBox: QaChoice;
  missing: string[];
  questions: string[];
  amountLayout: AmountLayout;
  labourLabel: string;
  keepCallout: boolean;
  variationDesc: string;
  scopeArea: string;
  depositObjective: string;
  conditions: { text: string; on: boolean }[];
  docUrl: string;
  notionUrl: string;
  createdMessage: string;
  templateCheck: string;
  isTest: boolean;
};

function blank(jobId: string, clientName: string, address: string): Saved {
  return {
    jobId,
    step: "type",
    invoiceType: "general",
    invoiceNumber: "",
    clientName,
    address,
    numberNote: "",
    existingWarning: "",
    dictation: "",
    primaryObjective: "",
    tasks: [{ label: "", text: "" }],
    recommendationOn: false,
    recommendation: "",
    notesMode: "remove",
    notesText: "",
    clauses: [],
    qaBox: "keep",
    missing: [],
    questions: [],
    amountLayout: "combined",
    labourLabel: "",
    keepCallout: true,
    variationDesc: "",
    scopeArea: "",
    depositObjective: "",
    conditions: [],
    docUrl: "",
    notionUrl: "",
    createdMessage: "",
    templateCheck: "",
    isTest: false,
  };
}

function readSaved(jobId: string, clientName: string, address: string): Saved {
  const fresh = blank(jobId, clientName, address);
  try {
    const raw = sessionStorage.getItem(invoiceDraftKey);
    if (!raw) return fresh;
    const value = JSON.parse(raw) as Partial<Saved>;
    if (!value || value.jobId !== jobId) return fresh;
    return {
      ...fresh,
      ...value,
      jobId,
      invoiceType: invoiceTypes.includes(value.invoiceType as InvoiceType) ? (value.invoiceType as InvoiceType) : "general",
      tasks: Array.isArray(value.tasks) && value.tasks.length > 0 ? value.tasks.slice(0, 12) : fresh.tasks,
      notesMode: isNotesMode(value.notesMode) ? value.notesMode : "remove",
      qaBox: isQaChoice(value.qaBox) ? value.qaBox : "keep",
      amountLayout: isAmountLayout(value.amountLayout) ? value.amountLayout : "combined",
      conditions: Array.isArray(value.conditions) ? value.conditions.slice(0, 12) : [],
      clauses: Array.isArray(value.clauses) ? value.clauses.slice(0, 12) : [],
      missing: Array.isArray(value.missing) ? value.missing.slice(0, 12) : [],
      questions: Array.isArray(value.questions) ? value.questions.slice(0, 12) : [],
    };
  } catch {
    return fresh;
  }
}

export function InvoiceWizard({
  business,
  jobId,
  clientName,
  address,
  onBack,
  onDone,
}: {
  business: Business;
  jobId: string;
  clientName: string;
  address: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Saved>(() => readSaved(jobId, clientName, address));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  const patch = (next: Partial<Saved>) => setForm((current) => ({ ...current, ...next }));

  useEffect(() => {
    try {
      sessionStorage.setItem(invoiceDraftKey, JSON.stringify(form));
    } catch {
      // A blocked store must not stop the invoice.
    }
  }, [form]);

  useEffect(() => {
    if (!form.dictation && !form.primaryObjective && form.step === "type") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [form.dictation, form.primaryObjective, form.step]);

  function fail(reason: unknown) {
    if (reason instanceof JobsClientError && reason.status === 401) {
      router.push("/jobs/login");
      return;
    }
    setError(reason instanceof JobsClientError ? reason.message : "The server did not reply. Try again.");
  }

  async function loadContext() {
    if (pending.current) return;
    pending.current = true;
    setBusy("Opening the job");
    setError("");
    try {
      const context = await postJobs<ContextBody>("/jobs/api/invoice", { mode: "invoiceContext", business, type: form.invoiceType, jobId });
      const existing = context.existingInvoice?.number
        ? `An invoice is already on this job: ${context.existingInvoice.number}${context.existingInvoice.status ? ` (${context.existingInvoice.status})` : ""}.${context.reuseExistingPage ? " Generating again reuses that page." : ""}`
        : "";
      patch({
        step: "context",
        invoiceNumber: invoiceNumberToShow(context.existingInvoice?.number ?? "", form.invoiceNumber, context.suggestedNumber),
        clientName: context.customer?.name || form.clientName,
        address: context.property?.name || form.address,
        numberNote: context.numberNote,
        existingWarning: existing,
      });
    } catch (reason) {
      fail(reason);
    } finally {
      pending.current = false;
      setBusy("");
    }
  }

  async function draft() {
    if (pending.current) return;
    if (!form.dictation.trim()) {
      setError("Say what the invoice should cover.");
      return;
    }
    pending.current = true;
    setBusy("Drafting the invoice");
    setError("");
    try {
      const result = await postJobs<DraftBody>("/jobs/api/invoice", {
        mode: "invoiceDraft",
        business,
        type: form.invoiceType,
        jobId,
        dictation: form.dictation,
      });
      const draftBody = result.draft;
      patch({
        step: "edit",
        primaryObjective: draftBody.primaryObjective,
        tasks: draftBody.tasks.length > 0 ? draftBody.tasks : [{ label: "", text: "" }],
        recommendation: draftBody.recommendation,
        recommendationOn: false,
        notesMode: "remove",
        notesText: draftBody.notesText,
        clauses: draftBody.suggestedClauses,
        qaBox: draftBody.qaBox || "keep",
        missing: draftBody.missing,
        questions: draftBody.questions,
        amountLayout: draftBody.amountLayoutSuggestion || "combined",
        scopeArea: draftBody.scopeArea,
        depositObjective: draftBody.depositObjective,
        conditions: draftBody.conditions.map((text) => ({ text, on: true })),
      });
    } catch (reason) {
      fail(reason);
    } finally {
      pending.current = false;
      setBusy("");
    }
  }

  function createPayload() {
    return {
      mode: "invoiceCreate" as const,
      business,
      type: form.invoiceType,
      jobId,
      invoiceNumber: form.invoiceNumber,
      primaryObjective: form.primaryObjective,
      tasks: form.tasks,
      recommendation: form.recommendationOn ? form.recommendation : "",
      notesMode: form.notesMode,
      notesText: form.notesText,
      qaBox: form.qaBox,
      amountLayout: form.amountLayout,
      labourLabel: form.amountLayout === "separate" ? form.labourLabel : "",
      ...(form.amountLayout === "callout" ? { keepCallout: form.keepCallout } : {}),
      variationDesc: form.variationDesc,
      scopeArea: form.invoiceType === "deposit" ? form.scopeArea : "",
      depositObjective: form.invoiceType === "deposit" ? form.depositObjective : "",
      conditions: form.invoiceType === "deposit" ? form.conditions.filter((item) => item.on).map((item) => item.text) : [],
    };
  }

  async function generate() {
    if (pending.current) return;
    if (!form.invoiceNumber.trim()) {
      setError("Enter the invoice number.");
      return;
    }
    pending.current = true;
    setBusy("Generating the Word document");
    setError("");
    const payload = createPayload();
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const created = await postJobs<CreatedBody>("/jobs/api/invoice", payload);
        if (created.status === "pending") {
          setBusy("Still generating the document");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        patch({
          step: "ready",
          docUrl: created.docUrl,
          notionUrl: created.notionUrl,
          createdMessage: created.message,
          templateCheck: created.templateCheck,
          isTest: created.isTest,
        });
        return;
      }
      setError("The document is still generating. Tap Generate Word (Draft) again.");
    } catch (reason) {
      fail(reason);
    } finally {
      pending.current = false;
      setBusy("");
    }
  }

  function addClause(clause: string) {
    const notes = form.notesText.includes(clause) ? form.notesText : `${form.notesText}${form.notesText ? "\n" : ""}${clause}`;
    patch({ notesText: notes, notesMode: form.notesMode === "remove" ? "custom" : form.notesMode });
  }

  const hint = invoiceDictationHint(form.invoiceType);
  const back = (
    <button
      type="button"
      className="min-h-11 text-base font-semibold underline"
      onClick={() => {
        setError("");
        if (form.step === "type") onBack();
        else if (form.step === "context" || form.step === "dictate") patch({ step: form.step === "dictate" ? "context" : "type" });
        else if (form.step === "edit") patch({ step: "dictate" });
        else patch({ step: "edit" });
      }}
    >
      Back
    </button>
  );

  return (
    <Screen title="Tax invoice" back={back}>
      {busy ? <Spinner label={busy} /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {form.step === "type" && !busy ? (
        <div className="flex flex-col gap-3">
          <p className="text-base">What kind of invoice is this?</p>
          {invoiceTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => patch({ invoiceType: type })}
              className={`min-h-14 rounded-2xl border border-black text-lg font-semibold ${form.invoiceType === type ? "bg-black text-white" : "bg-white text-black"}`}
            >
              {invoiceTypeLabel(type)}
            </button>
          ))}
          <JobsButton type="button" onClick={loadContext}>
            Continue
          </JobsButton>
        </div>
      ) : null}
      {form.step === "context" && !busy ? (
        <div className="flex flex-col gap-4">
          {form.existingWarning ? <Alert>{form.existingWarning}</Alert> : null}
          <label className="flex flex-col gap-2 text-base">
            Invoice number
            <input value={form.invoiceNumber} onChange={(event) => patch({ invoiceNumber: event.target.value })} className={fieldClass} />
          </label>
          {form.numberNote ? <p className="text-base">{form.numberNote}</p> : null}
          <p>
            <span className="text-sm text-neutral-600">Client</span>
            <span className="mt-1 block text-lg">{form.clientName}</span>
          </p>
          <p>
            <span className="text-sm text-neutral-600">Address</span>
            <span className="mt-1 block text-lg">{form.address}</span>
          </p>
          <JobsButton type="button" onClick={() => patch({ step: "dictate" })}>
            Continue
          </JobsButton>
        </div>
      ) : null}
      {form.step === "dictate" && !busy ? (
        <div className="flex flex-col gap-4">
          <p className="text-base">{hint.english}</p>
          <p className="text-base">{hint.chinese}</p>
          <label className="flex flex-col gap-2 text-base">
            Dictate the invoice
            <textarea value={form.dictation} onChange={(event) => patch({ dictation: event.target.value })} rows={8} className={`${fieldClass} min-h-48 py-3`} />
          </label>
          <JobsButton type="button" onClick={draft}>
            Draft with AI
          </JobsButton>
        </div>
      ) : null}
      {form.step === "edit" && !busy ? (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-base">
            Primary objective
            <textarea value={form.primaryObjective} onChange={(event) => patch({ primaryObjective: event.target.value })} rows={3} className={`${fieldClass} py-3`} />
          </label>
          <div className="flex flex-col gap-3">
            <p className="text-lg font-semibold">Tasks</p>
            {form.tasks.map((task, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-2xl border border-black p-3">
                <input value={task.label} onChange={(event) => patch({ tasks: form.tasks.map((row, item) => (item === index ? { ...row, label: event.target.value } : row)) })} placeholder="Label" className={fieldClass} />
                <textarea value={task.text} onChange={(event) => patch({ tasks: form.tasks.map((row, item) => (item === index ? { ...row, text: event.target.value } : row)) })} rows={3} className={`${fieldClass} py-3`} />
                <button type="button" className="min-h-11 self-start text-base font-semibold underline" onClick={() => patch({ tasks: form.tasks.length === 1 ? [{ label: "", text: "" }] : form.tasks.filter((_, item) => item !== index) })}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="min-h-14 rounded-2xl border border-black text-lg font-semibold" onClick={() => patch({ tasks: [...form.tasks, { label: "", text: "" }] })}>
              Add task
            </button>
          </div>
          <label className="flex min-h-14 items-center gap-3 text-base">
            <input type="checkbox" className="h-6 w-6 accent-black" checked={form.recommendationOn} onChange={(event) => patch({ recommendationOn: event.target.checked })} />
            Include recommendation
          </label>
          {form.recommendationOn ? (
            <textarea value={form.recommendation} onChange={(event) => patch({ recommendation: event.target.value })} rows={3} className={`${fieldClass} py-3`} />
          ) : null}
          <label className="flex flex-col gap-2 text-base">
            Notes
            <select value={form.notesMode} onChange={(event) => patch({ notesMode: event.target.value as NotesMode })} className={fieldClass}>
              <option value="remove">Remove</option>
              <option value="custom">Custom</option>
              <option value="append">Append</option>
              <option value="keep">Keep</option>
            </select>
          </label>
          {form.clauses.length > 0 ? (
            <div className="flex flex-col gap-2">
              {form.clauses.map((clause) => (
                <button key={clause} type="button" className="min-h-11 rounded-2xl border border-black px-3 text-left text-base" onClick={() => addClause(clause)}>
                  {clause}
                </button>
              ))}
            </div>
          ) : null}
          <textarea value={form.notesText} onChange={(event) => patch({ notesText: event.target.value })} rows={3} className={`${fieldClass} py-3`} />
          <label className="flex flex-col gap-2 text-base">
            QA box
            <select value={form.qaBox} onChange={(event) => patch({ qaBox: event.target.value as QaChoice })} className={fieldClass}>
              <option value="keep">Keep</option>
              <option value="remove">Remove</option>
            </select>
          </label>
          {form.missing.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold">Might be missing</p>
              {form.missing.map((item) => (
                <button key={item} type="button" className="min-h-11 rounded-2xl border border-black px-3 text-left text-base" onClick={() => addClause(item)}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          {form.questions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold">Questions</p>
              {form.questions.map((item) => (
                <button key={item} type="button" className="min-h-11 rounded-2xl border border-black px-3 text-left text-base" onClick={() => addClause(item)}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <p className="text-base">Amount layout. Amounts are filled in the document, not here.</p>
            {amountLayouts.map((layout) => (
              <button key={layout} type="button" onClick={() => patch({ amountLayout: layout })} className={`min-h-14 rounded-2xl border border-black text-lg font-semibold ${form.amountLayout === layout ? "bg-black text-white" : "bg-white"}`}>
                {amountLayoutLabel(layout)}
              </button>
            ))}
          </div>
          {form.amountLayout === "separate" ? (
            <label className="flex flex-col gap-2 text-base">
              Labour label
              <input value={form.labourLabel} onChange={(event) => patch({ labourLabel: event.target.value })} className={fieldClass} />
            </label>
          ) : null}
          {form.amountLayout === "callout" ? (
            <label className="flex min-h-14 items-center gap-3 text-base">
              <input type="checkbox" className="h-6 w-6 accent-black" checked={form.keepCallout} onChange={(event) => patch({ keepCallout: event.target.checked })} />
              Keep the callout
            </label>
          ) : null}
          <label className="flex flex-col gap-2 text-base">
            Variation reason (optional)
            <textarea value={form.variationDesc} onChange={(event) => patch({ variationDesc: event.target.value })} rows={2} className={`${fieldClass} py-3`} />
          </label>
          {form.invoiceType === "deposit" ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-2 text-base">
                Scope area
                <input value={form.scopeArea} onChange={(event) => patch({ scopeArea: event.target.value })} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-2 text-base">
                Deposit objective
                <textarea value={form.depositObjective} onChange={(event) => patch({ depositObjective: event.target.value })} rows={2} className={`${fieldClass} py-3`} />
              </label>
              {form.conditions.map((item, index) => (
                <label key={`${item.text}-${index}`} className="flex min-h-14 items-center gap-3 text-base">
                  <input
                    type="checkbox"
                    className="h-6 w-6 accent-black"
                    checked={item.on}
                    onChange={(event) => patch({ conditions: form.conditions.map((row, itemIndex) => (itemIndex === index ? { ...row, on: event.target.checked } : row)) })}
                  />
                  {item.text}
                </label>
              ))}
            </div>
          ) : null}
          <JobsButton type="button" onClick={generate} disabled={busy !== ""}>
            Generate Word (Draft)
          </JobsButton>
        </div>
      ) : null}
      {form.step === "ready" && !busy ? (
        <div className="flex flex-col gap-4">
          <p className="text-lg font-semibold">{form.createdMessage || "Word draft is ready."}</p>
          {form.isTest ? <p className="text-base">Test document.</p> : null}
          {form.templateCheck ? <p className="text-base">{form.templateCheck}</p> : null}
          {form.docUrl ? (
            <JobsLink href={form.docUrl} variant="outline">
              Open doc
            </JobsLink>
          ) : null}
          {form.notionUrl ? (
            <JobsLink href={form.notionUrl} variant="outline">
              Open in Notion
            </JobsLink>
          ) : null}
          <JobsButton type="button" variant="text" onClick={onDone}>
            Done
          </JobsButton>
        </div>
      ) : null}
    </Screen>
  );
}
