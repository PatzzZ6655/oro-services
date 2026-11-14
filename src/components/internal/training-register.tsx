"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { submitLicence } from "@/app/internal/safety-actions";
import { companies, type CompanyId } from "@/lib/reports/catalog";
import { licenceStatus, type LicenceRecord } from "@/lib/reports/safety";
import { initialSubmitState } from "@/lib/reports/state";
import { formatAuDate } from "@/lib/reports/dates";
import { CompanyChoice, TextInput } from "@/components/internal/form-controls";

export function TrainingRegister({ records, today }: { records: LicenceRecord[] | null; today: string }) {
  const [state, action, pending] = useActionState(submitLicence, initialSubmitState);
  const [company, setCompany] = useState<CompanyId | "">("");
  const errors = state.status === "invalid" ? state.errors : {};

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }

  return (
    <div className="space-y-6 px-4 pb-10">
      <header>
        <h1 className="text-xl font-semibold text-brand-navy">Training and licences</h1>
        <p className="mt-1 text-sm text-slate-600">The newest record for each worker is kept. A date within 30 days is marked due soon.</p>
      </header>
      {records === null ? <p className="text-sm text-slate-600">The register appears here once Google Drive is connected.</p> : null}
      {records && records.length === 0 ? <p className="text-sm text-slate-600">No licences filed yet.</p> : null}
      {records && records.length > 0 ? (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {records.map((record) => {
            const status = licenceStatus(record.expiry, today);
            const note = status === "expired" ? "Expired" : status === "soon" ? "Due soon" : "";
            return (
              <li key={record.id} className="px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{record.name}</p>
                <p className="text-sm text-slate-600">
                  {companies[record.company].name} · {record.licence}
                  {record.whiteCard ? ` · Card ${record.whiteCard}` : ""}
                </p>
                <p className={`text-sm ${note ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                  {formatAuDate(record.expiry)}
                  {note ? ` · ${note}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <h2 className="text-base font-semibold text-brand-navy">Add a record</h2>
        <CompanyChoice company={company} onChange={setCompany} error={errors.company} />
        <TextInput label="Worker" name="name" error={errors.name} autoComplete="name" />
        <TextInput label="White card" name="whiteCard" optional />
        <TextInput label="Licence" name="licence" error={errors.licence} />
        <TextInput label="Expiry" name="expiry" type="date" error={errors.expiry} />
        {state.status === "error" ? <p className="text-sm text-red-800">{state.message}</p> : null}
        {state.status === "sent" ? <p className="text-sm text-slate-700">Saved. Refresh to see it in the list.</p> : null}
        <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-navy text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Saving" : "Save"}
        </button>
      </form>
    </div>
  );
}
