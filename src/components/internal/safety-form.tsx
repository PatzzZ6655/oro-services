"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { LogoImage } from "@/components/logo-image";
import { submitSafety } from "@/app/internal/safety-actions";
import { companies, reportPhotoMax, reportPhotoTotalBytes, type CompanyId, type FieldErrors } from "@/lib/reports/catalog";
import { heightChecks, hrcwItems, plantChecks, safetyCard, swmsPresets, take5Checks, type SafetyKind } from "@/lib/reports/safety";
import { initialSubmitState } from "@/lib/reports/state";
import { validateSafety } from "@/lib/reports/safety";
import { validatePhotoBudget } from "@/lib/reports/validate";
import { AddMore, AreaInput, CompanyChoice, MorePhotos, ResultList, SignaturePad, TextInput, YesNoGroup } from "@/components/internal/form-controls";
import { useStored, type FormDefaults, type JobPrefill } from "@/components/internal/prefill";
import { copyLastAnswers } from "@/app/internal/job-actions";
import { applyAnswers } from "@/components/internal/draft-store";
import { useFormDraft } from "@/components/internal/use-draft";

function BrandHeading({ company, title }: { company: CompanyId | ""; title: string }) {
  const profile = company ? companies[company] : null;
  const rule = profile?.accent === "orange" ? "bg-brand-orange" : profile ? "bg-brand-blue" : "bg-slate-200";
  return (
    <header>
      {profile ? (
        <div className="px-4 pt-4">
          <LogoImage src={profile.logo} alt={profile.name} width={profile.logoWidth} height={profile.logoHeight} sizes="160px" className="h-8 w-auto" />
          <p className="mt-2 text-sm text-slate-600">{profile.legalName}</p>
        </div>
      ) : null}
      <div className={`mx-4 mt-3 h-0.5 ${rule}`} />
      <h1 className="px-4 pt-4 text-xl font-semibold text-brand-navy">{title}</h1>
    </header>
  );
}

function SignOns({
  prefix,
  errors,
  label,
  defaults,
  remember = false,
  multiple = false,
  named = true,
}: {
  prefix: string;
  errors: FieldErrors;
  label: string;
  defaults: FormDefaults;
  remember?: boolean;
  multiple?: boolean;
  named?: boolean;
}) {
  const [count, setCount] = useState(1);
  const [worker, setWorker] = useStored("oro-worker", defaults.name);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-800">{label}</p>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-slate-200 p-3">
          {named && index === 0 && remember ? (
            <TextInput label="Name" name={`${prefix}.0.name`} error={errors[`${prefix}.0.name`]} autoComplete="name" value={worker} onValue={setWorker} />
          ) : null}
          {named && !(index === 0 && remember) ? (
            <TextInput label="Name" name={`${prefix}.${index}.name`} error={errors[`${prefix}.${index}.name`]} autoComplete="name" />
          ) : null}
          <TextInput label="Date" name={`${prefix}.${index}.date`} type="date" error={errors[`${prefix}.${index}.date`]} defaultValue={index === 0 ? defaults.date : undefined} />
          <SignaturePad name={`${prefix}.${index}.signature`} error={errors[`${prefix}.${index}.signature`]} />
        </div>
      ))}
      {errors[prefix] ? <p className="text-sm text-red-800">{errors[prefix]}</p> : null}
      {multiple && count < 12 ? (
        <button type="button" className="min-h-12 text-sm font-semibold text-brand-navy" onClick={() => setCount((value) => value + 1)}>
          Add another person
        </button>
      ) : null}
    </div>
  );
}

function Rows({
  name,
  errors,
  columns,
}: {
  name: string;
  errors: FieldErrors;
  columns: { key: string; label: string }[];
}) {
  const [count, setCount] = useState(1);
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-3">
          {columns.map((column) => (
            <TextInput key={column.key} label={column.label} name={`${name}.${index}.${column.key}`} error={errors[`${name}.${index}`]} />
          ))}
        </div>
      ))}
      {errors[name] ? <p className="text-sm text-red-800">{errors[name]}</p> : null}
      {count < 8 ? (
        <button type="button" className="min-h-12 text-sm font-semibold text-brand-navy" onClick={() => setCount((value) => value + 1)}>
          Add a row
        </button>
      ) : null}
    </div>
  );
}

const commonRisk = new Set(["fall", "confined", "trench", "asbestos", "demolition", "electrical", "gas", "atmosphere", "plant", "water"]);

function useCompany(initial?: CompanyId): [CompanyId | "", (value: CompanyId) => void] {
  const [company, setCompany] = useStored("oro-company", initial ?? "", Boolean(initial));
  const chosen = company === "emoro" || company === "emporo" ? company : "";
  return [chosen, (value) => setCompany(value)];
}

export function SafetyForm({ kind, defaults, job = null }: { kind: SafetyKind; defaults: FormDefaults; job?: JobPrefill | null }) {
  const card = safetyCard(kind);
  const [state, action, pending] = useActionState(submitSafety, initialSubmitState);
  const [offline, setOffline] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [company, setCompany] = useCompany(job?.company);
  const [address, setAddress] = useStored("oro-address", job?.address ?? "", Boolean(job?.address));
  useFormDraft(`${kind}:${job?.id || "loose"}`, formRef, state.status === "sent");
  useEffect(() => {
    const retry = () => {
      if (!offline || !formRef.current) return;
      setOffline(false);
      const data = new FormData(formRef.current);
      startTransition(() => {
        void Promise.resolve(action(data)).catch(() => setOffline(true));
      });
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [action, offline]);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [steps, setSteps] = useState([{ step: "", hazard: "", control: "" }]);
  const errors = { ...(state.status === "invalid" ? state.errors : {}), ...clientErrors };

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const more = data.getAll("morePhotos").filter((item): item is File => item instanceof File && item.size > 0);
    const everyFile = [...data.values()].filter((item): item is File => item instanceof File && item.size > 0);
    const photoError = more.length > reportPhotoMax ? "Add up to 8 photos." : validatePhotoBudget(everyFile.map((file) => ({ size: file.size, type: file.type })));
    if (photoError || everyFile.reduce((total, file) => total + file.size, 0) > reportPhotoTotalBytes) {
      setClientErrors({ photos: photoError ?? "Photos are too large together. Use fewer photos." });
      return;
    }
    const parsed = validateSafety(kind, data);
    if (!parsed.ok) {
      setClientErrors(parsed.errors);
      return;
    }
    setClientErrors({});
    if (!navigator.onLine) {
      setOffline(true);
      return;
    }
    startTransition(() => {
      void Promise.resolve(action(data)).catch(() => setOffline(true));
    });
  }

  async function copyLast() {
    if (!job || !formRef.current) return;
    const answers = await copyLastAnswers(job.id, kind, address);
    if (answers) applyAnswers(formRef.current, answers);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6 pb-10" noValidate>
      <input type="hidden" name="kind" value={kind} />
      {job ? <input type="hidden" name="jobId" value={job.id} /> : null}
      {job && kind !== "swms" ? <input type="hidden" name="jobNumber" value={job.jobNumber} /> : null}
      <BrandHeading company={company} title={card.title} />
      <div className="space-y-4 px-4">
        <CompanyChoice company={company} onChange={setCompany} error={errors.company} />
        <TextInput label="Date" name="date" type="date" error={errors.date} defaultValue={defaults.date} />
        <TextInput label="Site address" name="address" error={errors.address} autoComplete="street-address" value={address} onValue={setAddress} />
        {kind === "swms" ? (
          <>
            <TextInput label="Job / invoice" name="jobNumber" error={errors.jobNumber} defaultValue={job?.jobNumber} />
            <AreaInput label="Work" name="work" error={errors.work} />
            <fieldset>
              <legend className="text-sm font-medium text-slate-800">High risk construction work</legend>
              <div className="mt-2 space-y-2">
                {hrcwItems.filter((item) => commonRisk.has(item.id)).map((item) => (
                  <label key={item.id} className="flex items-start gap-3 text-sm text-slate-800">
                    <input type="checkbox" name={`hrcw.${item.id}`} value="yes" className="mt-1 size-5" />
                    {item.label}
                  </label>
                ))}
              </div>
              <AddMore label="Other high risk work">
                {hrcwItems.filter((item) => !commonRisk.has(item.id)).map((item) => (
                  <label key={item.id} className="flex items-start gap-3 text-sm text-slate-800">
                    <input type="checkbox" name={`hrcw.${item.id}`} value="yes" className="mt-1 size-5" />
                    {item.label}
                  </label>
                ))}
              </AddMore>
              {errors.hrcw ? <p className="mt-1 text-sm text-red-800">{errors.hrcw}</p> : null}
            </fieldset>
            <div className="flex flex-wrap gap-2">
              {Object.entries({ roof: "Roof work", confined: "Confined space", trench: "Trenching", electrical: "Live electrical" }).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700"
                  onClick={() => setSteps(swmsPresets[id])}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {steps.map((row, index) => (
                <div key={`${index}-${row.step}`} className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <TextInput label="Step" name={`step.${index}.step`} defaultValue={row.step} error={errors[`step.${index}`]} />
                  <TextInput label="Hazard" name={`step.${index}.hazard`} defaultValue={row.hazard} />
                  <TextInput label="Control" name={`step.${index}.control`} defaultValue={row.control} />
                </div>
              ))}
              {errors.steps ? <p className="text-sm text-red-800">{errors.steps}</p> : null}
              {steps.length < 12 ? (
                <button type="button" className="min-h-12 text-sm font-semibold text-brand-navy" onClick={() => setSteps((rows) => [...rows, { step: "", hazard: "", control: "" }])}>
                  Add a step
                </button>
              ) : null}
            </div>
            <AreaInput label="PPE and emergency plan" name="emergency" error={errors.emergency} />
            <TextInput label="Person responsible for monitoring and review" name="reviewer" error={errors.reviewer} />
            <label className="flex items-start gap-3 text-sm text-slate-800">
              <input type="checkbox" name="consulted" value="yes" className="mt-1 size-5" />
              Prepared in consultation with the workers or HSR
            </label>
            {errors.consulted ? <p className="text-sm text-red-800">{errors.consulted}</p> : null}
            <label className="flex items-start gap-3 text-sm text-slate-800">
              <input type="checkbox" name="reviewedToday" value="yes" className="mt-1 size-5" />
              Reviewed for this site today
            </label>
            {errors.reviewedToday ? <p className="text-sm text-red-800">{errors.reviewedToday}</p> : null}
            <MorePhotos error={errors.photos} />
            <SignOns prefix="worker" errors={errors} label="Workers signed on" defaults={defaults} remember multiple />
          </>
        ) : null}
        {kind === "take-5" ? (
          <>
            <TextInput label="Task" name="task" error={errors.task} />
            {take5Checks.map((item) => (
              <YesNoGroup key={item.id} legend={item.label} name={`take.${item.id}`} error={errors[`take.${item.id}`]} />
            ))}
            <AddMore label="Notes">
              <AreaInput label="Notes" name="notes" optional />
            </AddMore>
            <MorePhotos error={errors.photos} />
            <SignOns prefix="worker" errors={errors} label="Signed" defaults={defaults} remember />
          </>
        ) : null}
        {kind === "confined-space" ? (
          <>
            <TextInput label="Space" name="location" error={errors.location} />
            <TextInput label="Standby person" name="standby" error={errors.standby} />
            <YesNoGroup legend="Isolated" name="isolation" error={errors.isolation} />
            <AreaInput label="Rescue plan" name="rescue" error={errors.rescue} />
            <Rows name="air" errors={errors} columns={[{ key: "time", label: "Time" }, { key: "oxygen", label: "Oxygen %" }, { key: "lel", label: "LEL %" }, { key: "co", label: "CO" }, { key: "result", label: "Result" }]} />
            <Rows name="log" errors={errors} columns={[{ key: "name", label: "Name" }, { key: "in", label: "Time in" }, { key: "out", label: "Time out" }]} />
            <YesNoGroup legend="Permit closed" name="closed" error={errors.closed} />
            <MorePhotos error={errors.photos} />
            <SignOns prefix="worker" errors={errors} label="Permit signed" defaults={defaults} remember />
          </>
        ) : null}
        {kind === "hot-work" ? (
          <>
            <AreaInput label="Work" name="work" error={errors.work} />
            <TextInput label="Fire watch" name="watch" error={errors.watch} />
            <TextInput label="Duration" name="duration" error={errors.duration} />
            <label className="flex items-start gap-3 text-sm text-slate-800">
              <input type="checkbox" name="extinguisher" value="yes" className="mt-1 size-5" />
              Extinguisher is at the work
            </label>
            {errors.extinguisher ? <p className="text-sm text-red-800">{errors.extinguisher}</p> : null}
            <MorePhotos error={errors.photos} />
            <SignOns prefix="worker" errors={errors} label="Permit signed" defaults={defaults} remember />
          </>
        ) : null}
        {kind === "heights" ? (
          <>
            <ResultList group="height" items={heightChecks} errors={errors} />
            <MorePhotos error={errors.photos} />
            <SignOns prefix="worker" errors={errors} label="Checked by" defaults={defaults} remember />
          </>
        ) : null}
        {kind === "induction" ? (
          <>
            <TextInput label="Worker" name="worker" error={errors.worker} autoComplete="name" />
            <TextInput label="Construction induction card" name="whiteCard" error={errors.whiteCard} />
            <AddMore label="Licence">
              <TextInput label="Licence" name="licence" optional />
            </AddMore>
            <TextInput label="Emergency contact" name="emergency" error={errors.emergency} />
            <label className="flex items-start gap-3 text-sm text-slate-800">
              <input type="checkbox" name="rules" value="yes" className="mt-1 size-5" />
              Site rules acknowledged
            </label>
            {errors.rules ? <p className="text-sm text-red-800">{errors.rules}</p> : null}
            <MorePhotos error={errors.photos} />
            <SignOns prefix="workerSign" errors={errors} label="Signature" defaults={defaults} named={false} />
          </>
        ) : null}
        {kind === "toolbox" ? (
          <>
            <TextInput label="Topic" name="topic" error={errors.topic} />
            <AreaInput label="Notes" name="notes" error={errors.notes} />
            <MorePhotos error={errors.photos} />
            <SignOns prefix="worker" errors={errors} label="Attendees" defaults={defaults} multiple />
          </>
        ) : null}
        {kind === "incident" ? (
          <>
            <p className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">
              A notifiable incident under the OHS Act 2004, section 38, must be reported to WorkSafe Victoria by the employer. Leave the site as it is until an inspector arrives, unless someone needs help or the site has to be made safe. This form does not send that notice. Keep this record for 5 years.
            </p>
            <TextInput label="Time" name="time" type="time" error={errors.time} defaultValue={defaults.time} />
            <fieldset>
              <legend className="text-sm font-medium text-slate-800">Type</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[["incident", "Incident"], ["near-miss", "Near miss"]].map(([value, label]) => (
                  <label key={value} className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 text-sm has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50">
                    <input className="sr-only" type="radio" name="kindOf" value={value} />
                    {label}
                  </label>
                ))}
              </div>
              {errors.kindOf ? <p className="mt-1 text-sm text-red-800">{errors.kindOf}</p> : null}
            </fieldset>
            <AreaInput label="What happened" name="what" error={errors.what} />
            <YesNoGroup legend="Site left as it was" name="preserved" error={errors.preserved} />
            <AddMore label="People or actions">
              <TextInput label="People involved" name="people" optional />
              <AreaInput label="Actions taken" name="actions" optional />
            </AddMore>
            <MorePhotos error={errors.photos} />
            <SignOns prefix="worker" errors={errors} label="Reported by" defaults={defaults} remember />
          </>
        ) : null}
        {kind === "hazard" ? (
          <>
            <AreaInput label="Hazard" name="hazard" error={errors.hazard} />
            <fieldset>
              <legend className="text-sm font-medium text-slate-800">Risk</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {["low", "medium", "high"].map((value) => (
                  <label key={value} className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 text-sm capitalize has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50">
                    <input className="sr-only" type="radio" name="risk" value={value} />
                    {value}
                  </label>
                ))}
              </div>
              {errors.risk ? <p className="mt-1 text-sm text-red-800">{errors.risk}</p> : null}
            </fieldset>
            <AreaInput label="Action" name="action" error={errors.action} />
            <AddMore label="Close-out">
              <TextInput label="Close-out date" name="close" type="date" optional error={errors.close} />
            </AddMore>
            <MorePhotos error={errors.photos} />
            <SignOns prefix="worker" errors={errors} label="Reported by" defaults={defaults} remember />
          </>
        ) : null}
        {kind === "plant-prestart" ? (
          <>
            <TextInput label="Equipment" name="equipment" error={errors.equipment} />
            <AddMore label="ID or serial">
              <TextInput label="ID / serial" name="asset" optional />
            </AddMore>
            <ResultList group="plant" items={plantChecks} errors={errors} />
            <MorePhotos error={errors.photos} />
            <SignOns prefix="worker" errors={errors} label="Checked by" defaults={defaults} remember />
          </>
        ) : null}
        {offline ? <p className="text-sm text-slate-700">Saved on this phone. It will file when the connection is back.</p> : null}
        {job ? (
          <button type="button" className="min-h-11 text-sm font-semibold text-brand-navy" onClick={() => void copyLast()}>
            Copy last
          </button>
        ) : null}
        {state.status === "error" ? <p className="text-sm text-red-800">{state.message}</p> : null}
        {state.status === "sent" ? (
          <p className="text-sm text-slate-700">
            Filed.
            {state.driveUrl ? (
              <>
                {" "}
                <a className="font-semibold text-brand-navy underline" href={state.driveUrl}>
                  Open the PDF
                </a>
              </>
            ) : null}
          </p>
        ) : (
          <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-navy text-sm font-semibold text-white disabled:opacity-60">
            {pending ? "Saving" : "Save"}
          </button>
        )}
      </div>
    </form>
  );
}
