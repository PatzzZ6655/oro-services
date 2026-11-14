"use client";

import { useActionState, useState } from "react";
import { createJobAction } from "@/app/internal/job-actions";
import { CompanyChoice } from "@/components/internal/form-controls";
import type { CompanyId } from "@/lib/reports/catalog";

export function JobCreate() {
  const [state, action, pending] = useActionState(createJobAction, { error: "" });
  const [company, setCompany] = useState<CompanyId | "">("");
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-brand-navy">New job</h2>
      <CompanyChoice company={company} onChange={setCompany} error={state.error === "Choose the company." ? state.error : undefined} />
      <label className="block text-sm font-medium text-slate-800">
        Client
        <input name="clientName" className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3" />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Phone (optional)
        <input name="phone" className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3" />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Email (optional)
        <input name="email" type="email" className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3" />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Site address, including suburb
        <input name="address" className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3" />
      </label>
      {state.error && state.error !== "Choose the company." ? <p className="text-sm text-red-800">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-navy text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Saving" : "Create job"}
      </button>
    </form>
  );
}
