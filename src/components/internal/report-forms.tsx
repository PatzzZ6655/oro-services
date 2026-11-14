"use client";

import { useState } from "react";
import { LogoImage } from "@/components/logo-image";
import {
  companies,
  electricalEarth,
  electricalExtent,
  electricalPolarity,
  electricalVisual,
  gasChecks,
  itemPhotoField,
  jobSafety,
  signOffConfirmations,
  type CompanyId,
  type FieldErrors,
  type NamedItem,
} from "@/lib/reports/catalog";
import {
  AddMore,
  AreaInput,
  CheckDate,
  ChoiceGroup,
  CompanyChoice,
  OptionalPhoto,
  MorePhotos,
  ResultList,
  SignaturePad,
  TextInput,
  YesNoGroup,
} from "@/components/internal/form-controls";
import { useStored, type FormDefaults, type JobPrefill } from "@/components/internal/prefill";
import { ReportForm } from "@/components/internal/report-form";

function useCompany(initial?: CompanyId): [CompanyId | "", (value: CompanyId) => void] {
  const [company, setCompany] = useStored("oro-company", initial ?? "", Boolean(initial));
  const chosen = company === "emoro" || company === "emporo" ? company : "";
  return [chosen, (value) => setCompany(value)];
}

function BrandHeading({ company, title, detail }: { company: CompanyId | ""; title: string; detail: string }) {
  const profile = company ? companies[company] : null;
  const rule = profile?.accent === "orange" ? "bg-brand-orange" : profile ? "bg-brand-blue" : "bg-slate-200";
  return (
    <header className="rounded-2xl border border-slate-200 bg-white">
      <div className="px-4 pt-4">
        {profile ? (
          <LogoImage src={profile.logo} alt={profile.name} width={profile.logoWidth} height={profile.logoHeight} sizes="180px" className="h-9 w-auto" />
        ) : (
          <p className="text-sm font-semibold text-slate-700">Choose the company</p>
        )}
        {profile ? <p className="mt-2 text-sm font-semibold text-brand-navy">{profile.legalName}</p> : null}
      </div>
      <div className={`mx-4 mt-3 h-0.5 ${rule}`} />
      <div className="px-4 pb-4 pt-3">
        <h1 className="text-2xl font-semibold text-brand-navy">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{detail}</p>
      </div>
    </header>
  );
}

function splitItems(items: readonly NamedItem[], core: readonly string[]) {
  const keep = new Set(core);
  return {
    main: items.filter((item) => keep.has(item.id)),
    extra: items.filter((item) => !keep.has(item.id)),
  };
}

function ExtraResults({
  group,
  items,
  errors,
  withReading = false,
  label,
}: {
  group: string;
  items: readonly NamedItem[];
  errors: FieldErrors;
  withReading?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div>
      <button type="button" className="min-h-12 text-sm font-semibold text-brand-navy" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide extra" : label}
      </button>
      {open ? (
        <div className="mt-3">
          <ResultList group={group} items={items} errors={errors} withReading={withReading} />
        </div>
      ) : (
        items.map((item) => <input key={item.id} type="hidden" name={`${group}.${item.id}`} value="na" />)
      )}
    </div>
  );
}

export function SiteJobSheetForm({ defaults, job = null }: { defaults: FormDefaults; job?: JobPrefill | null }) {
  const [company, setCompany] = useCompany(job?.company);
  const [worker, setWorker] = useStored("oro-worker", defaults.name);
  const [address, setAddress] = useStored("oro-address", job?.address ?? "", Boolean(job?.address));
  return (
    <div className="space-y-5">
      <ReportForm kind="site-job-sheet" jobId={job?.id ?? ""} jobNumber={job?.jobNumber ?? ""} hasJobField>
        {(errors) => (
          <>
            <CompanyChoice company={company} onChange={setCompany} error={errors.company} />
            <BrandHeading company={company} title="Site job sheet" detail="Hours, work, and the site checks." />
            <TextInput label="Worker name" name="workerName" error={errors.workerName} autoComplete="name" maxLength={80} value={worker} onValue={setWorker} />
            <TextInput label="Date" name="date" type="date" error={errors.date} defaultValue={defaults.date} />
            <TextInput label="Job / invoice no." name="jobNumber" error={errors.jobNumber} maxLength={40} defaultValue={job?.jobNumber} />
            <TextInput label="Site address" name="address" error={errors.address} maxLength={200} value={address} onValue={setAddress} />
            <TextInput label="Start time" name="startTime" type="time" error={errors.startTime} defaultValue={defaults.time} />
            <TextInput label="Finish time" name="finishTime" type="time" error={errors.finishTime} />
            <AreaInput label="Work performed" name="work" error={errors.work} maxLength={2000} />
            {company ? (
              <div className="space-y-4">
                {jobSafety[company].map((item) => (
                  <div key={item.id} className="space-y-2">
                    <YesNoGroup legend={item.label} name={`safety.${company}.${item.id}`} error={errors[`safety.${company}.${item.id}`]} />
                    <OptionalPhoto name={itemPhotoField(`safety.${company}.${item.id}`)} />
                  </div>
                ))}
              </div>
            ) : null}
            <AddMore label="Materials or issues">
              <AreaInput label="Materials used" name="materials" error={errors.materials} optional maxLength={1000} />
              <AreaInput label="Issues" name="issues" error={errors.issues} optional maxLength={1000} />
            </AddMore>
            <MorePhotos error={errors.photos} />
            <SignaturePad error={errors.signature} />
          </>
        )}
      </ReportForm>
    </div>
  );
}

function VbaFields({ errors }: { errors: FieldErrors }) {
  const [answer, setAnswer] = useState("");
  return (
    <div className="space-y-3">
      <ChoiceGroup
        legend="VBA compliance certificate required?"
        name="vba"
        error={errors.vba}
        onValue={setAnswer}
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
      />
      <p className="text-sm text-slate-600">Due within 5 days of completion. It applies to work of $750 or more, or to gas appliance or gas piping work.</p>
      {answer === "yes" || errors.vbaNumber || errors.vbaLodged ? (
        <>
          <TextInput label="Certificate number" name="vbaNumber" error={errors.vbaNumber} maxLength={40} />
          <TextInput label="Date lodged in VBA360" name="vbaLodged" type="date" error={errors.vbaLodged} />
        </>
      ) : null}
    </div>
  );
}

export function JobSignOffForm({ defaults, job = null }: { defaults: FormDefaults; job?: JobPrefill | null }) {
  const [company, setCompany] = useCompany(job?.company);
  const [address, setAddress] = useStored("oro-address", job?.address ?? "", Boolean(job?.address));
  return (
    <div className="space-y-5">
      <ReportForm kind="job-sign-off" jobId={job?.id ?? ""} jobNumber={job?.jobNumber ?? ""} hasJobField>
        {(errors) => (
          <>
            <CompanyChoice company={company} onChange={setCompany} error={errors.company} />
            <BrandHeading company={company} title="Job completion sign-off" detail="The client confirms the finished work." />
            <TextInput label="Job / invoice no." name="jobNumber" error={errors.jobNumber} maxLength={40} defaultValue={job?.jobNumber} />
            <TextInput label="Client name" name="clientName" error={errors.clientName} autoComplete="name" maxLength={80} defaultValue={job?.clientName} />
            <TextInput label="Site address" name="address" error={errors.address} maxLength={200} value={address} onValue={setAddress} />
            <TextInput label="Completion date" name="date" type="date" error={errors.date} defaultValue={defaults.date} />
            <AreaInput label="Work completed" name="work" error={errors.work} maxLength={2000} />
            {signOffConfirmations.map((item) => (
              <YesNoGroup key={item.id} legend={item.label} name={`confirm.${item.id}`} error={errors[`confirm.${item.id}`]} />
            ))}
            {company === "emporo" ? <VbaFields errors={errors} /> : null}
            <AddMore label="Comments or client email">
              <AreaInput label="Comments" name="comments" error={errors.comments} optional maxLength={1000} />
              <TextInput label="Client email for a copy" name="clientEmail" type="email" error={errors.clientEmail} optional autoComplete="email" maxLength={254} />
            </AddMore>
            <MorePhotos error={errors.photos} />
            <SignaturePad error={errors.signature} />
          </>
        )}
      </ReportForm>
    </div>
  );
}

export function GasSafetyForm({ defaults, job = null }: { defaults: FormDefaults; job?: JobPrefill | null }) {
  const [worker, setWorker] = useStored("oro-worker", defaults.name);
  const [licence, setLicence] = useStored("oro-licence", "");
  const [address, setAddress] = useStored("oro-address", job?.address ?? "", Boolean(job?.address));
  return (
    <div className="space-y-5">
      <ReportForm kind="gas-safety" jobId={job?.id ?? ""} jobNumber={job?.jobNumber ?? ""}>
        {(errors) => (
          <>
            <BrandHeading company="emporo" title="Gas safety check" detail="Victorian rental check. Next due is two years from the check date." />
            <TextInput label="Property address" name="address" error={errors.address} maxLength={200} value={address} onValue={setAddress} />
            <TextInput label="Rental provider / agent" name="providerName" error={errors.providerName} maxLength={80} />
            <CheckDate defaultDate={defaults.date} />
            {errors.date ? <p className="text-sm text-red-800">{errors.date}</p> : null}
            <TextInput label="Gasfitter full name" name="gasfitterName" error={errors.gasfitterName} autoComplete="name" maxLength={80} value={worker} onValue={setWorker} />
            <TextInput label="Licence / registration no." name="licence" error={errors.licence} maxLength={40} value={licence} onValue={setLicence} />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Installation checks</h2>
              <ResultList group="check" items={gasChecks} errors={errors} />
            </section>
            <AddMore label="Servicing record, appliances, or faults">
              <label className="flex min-h-12 items-start gap-3 text-sm text-slate-800">
                <input name="servicingRecord" type="checkbox" value="yes" className="mt-1 size-5" />
                Gas Servicing Record completed
              </label>
              <TextInput label="Provider / agent email" name="providerEmail" type="email" error={errors.providerEmail} optional autoComplete="email" maxLength={254} />
              <ApplianceRows errors={errors} />
              <AreaInput label="Faults and recommendations" name="faults" error={errors.faults} optional maxLength={2000} />
              <UrgentBlock legend="Urgent or disconnected appliance" error={errors.urgent} detailsError={errors.urgentDetails} />
            </AddMore>
            <MorePhotos error={errors.photos} />
            <SignaturePad error={errors.signature} />
          </>
        )}
      </ReportForm>
    </div>
  );
}

const extentCore = ["main-switchboard", "main-earthing", "kitchen", "bathroom-main", "living", "laundry"];
const visualCore = ["consumers-mains", "switchboards", "earth-electrode", "water-bond", "rcds", "circuit-protection", "socket-outlets", "light-fittings", "wiring"];
const polarityCore = ["consumers-mains", "circuit-protection", "rcds", "socket-outlets", "light-fittings"];
const earthCore = ["mains-earth", "switchboard", "water-bond", "socket-outlets", "light-fittings"];

export function ElectricalSafetyForm({ defaults, job = null }: { defaults: FormDefaults; job?: JobPrefill | null }) {
  const [worker, setWorker] = useStored("oro-worker", defaults.name);
  const [licence, setLicence] = useStored("oro-licence", "");
  const [address, setAddress] = useStored("oro-address", job?.address ?? "", Boolean(job?.address));
  const extent = splitItems(electricalExtent, extentCore);
  const visual = splitItems(electricalVisual, visualCore);
  const polarity = splitItems(electricalPolarity, polarityCore);
  const earth = splitItems(electricalEarth, earthCore);
  return (
    <div className="space-y-5">
      <ReportForm kind="electrical-safety" jobId={job?.id ?? ""} jobNumber={job?.jobNumber ?? ""}>
        {(errors) => (
          <>
            <BrandHeading company="emoro" title="Electrical safety check" detail="AS/NZS 3019:2022 section 4. Next check in two years. Smoke alarms in 12 months." />
            <TextInput label="Property address" name="address" error={errors.address} maxLength={200} value={address} onValue={setAddress} />
            <TextInput label="Rental provider / agent" name="providerName" error={errors.providerName} maxLength={80} />
            <CheckDate smoke defaultDate={defaults.date} />
            {errors.date ? <p className="text-sm text-red-800">{errors.date}</p> : null}
            <TextInput label="Electrician full name" name="electricianName" error={errors.electricianName} autoComplete="name" maxLength={80} value={worker} onValue={setWorker} />
            <TextInput label="Licence no." name="licence" error={errors.licence} maxLength={40} value={licence} onValue={setLicence} />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Extent of the check</h2>
              {extent.main.map((item) => (
                <ChoiceGroup
                  key={item.id}
                  legend={item.label}
                  name={`extent.${item.id}`}
                  error={errors[`extent.${item.id}`]}
                  options={[
                    { value: "included", label: "Included" },
                    { value: "excluded", label: "NI" },
                    { value: "na", label: "N/A" },
                  ]}
                />
              ))}
              <ExtraExtent items={extent.extra} errors={errors} />
              {errors.extent ? <p className="text-sm text-red-800">{errors.extent}</p> : null}
            </section>
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Visual inspection</h2>
              <ResultList group="visual" items={visual.main} errors={errors} />
              <ExtraResults group="visual" items={visual.extra} errors={errors} label="Other visual items" />
            </section>
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Polarity and correct connections</h2>
              <ResultList group="polarity" items={polarity.main} errors={errors} />
              <ExtraResults group="polarity" items={polarity.extra} errors={errors} label="Other polarity items" />
            </section>
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Earth continuity</h2>
              <ResultList group="earth" items={earth.main} errors={errors} withReading />
              <ExtraResults group="earth" items={earth.extra} errors={errors} withReading label="Other earth items" />
            </section>
            <RcdRows errors={errors} />
            <SmokeBlock errors={errors} />
            <AddMore label="Agent email, earlier check, or faults">
              <TextInput label="Provider / agent email" name="providerEmail" type="email" error={errors.providerEmail} optional autoComplete="email" maxLength={254} />
              <TextInput label="Previous check date" name="previousDate" type="date" error={errors.previousDate} optional />
              <TextInput label="REC no." name="rec" error={errors.rec} optional maxLength={40} />
              <AreaInput label="Limitations" name="limitations" error={errors.limitations} optional maxLength={500} />
              <AreaInput label="Faults and recommendations" name="faults" error={errors.faults} optional maxLength={2000} />
              <UrgentBlock legend="Urgent hazard" error={errors.urgent} detailsError={errors.urgentDetails} />
            </AddMore>
            <MorePhotos error={errors.photos} />
            <SignaturePad error={errors.signature} />
          </>
        )}
      </ReportForm>
    </div>
  );
}

function ExtraExtent({ items, errors }: { items: readonly NamedItem[]; errors: FieldErrors }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="min-h-12 text-sm font-semibold text-brand-navy" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide extra" : "Other areas"}
      </button>
      {open
        ? items.map((item) => (
            <ChoiceGroup
              key={item.id}
              legend={item.label}
              name={`extent.${item.id}`}
              error={errors[`extent.${item.id}`]}
              options={[
                { value: "included", label: "Included" },
                { value: "excluded", label: "NI" },
                { value: "na", label: "N/A" },
              ]}
            />
          ))
        : items.map((item) => <input key={item.id} type="hidden" name={`extent.${item.id}`} value="na" />)}
    </div>
  );
}

function SmokeBlock({ errors }: { errors: FieldErrors }) {
  const [answer, setAnswer] = useState("");
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-brand-navy">Smoke alarms</h2>
      <ChoiceGroup
        legend="Installed, working, and tested"
        name="smoke"
        error={errors.smoke}
        onValue={setAnswer}
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
      />
      {answer === "no" || errors.smokeComment ? <AreaInput label="What is wrong" name="smokeComment" error={errors.smokeComment} maxLength={500} /> : null}
    </section>
  );
}

function UrgentBlock({ legend, error, detailsError }: { legend: string; error?: string; detailsError?: string }) {
  const [answer, setAnswer] = useState("");
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">{legend}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["yes", "Yes"],
              ["no", "No"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700 has-[:checked]:border-brand-navy has-[:checked]:bg-slate-50 has-[:checked]:text-brand-navy">
              <input className="sr-only" type="radio" name="urgent" value={value} onChange={() => setAnswer(value)} />
              {label}
            </label>
          ))}
        </div>
        {error ? <p className="mt-1 text-sm text-red-800">{error}</p> : null}
      </fieldset>
      {answer === "yes" || detailsError ? <AreaInput label="Details" name="urgentDetails" error={detailsError} maxLength={1000} /> : null}
    </div>
  );
}

function ApplianceRows({ errors }: { errors: FieldErrors }) {
  const [count, setCount] = useState(0);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-brand-navy">Type A appliances</h2>
        <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold" onClick={() => setCount((value) => Math.min(12, value + 1))}>
          Add
        </button>
      </div>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-slate-200 p-3">
          <TextInput label="Type" name={`appliance.${index}.type`} error={errors[`appliance.${index}.type`]} maxLength={60} />
          <TextInput label="Location" name={`appliance.${index}.location`} error={errors[`appliance.${index}.location`]} maxLength={60} />
          <TextInput label="Make / model" name={`appliance.${index}.makeModel`} error={errors[`appliance.${index}.makeModel`]} maxLength={80} />
          <YesNoGroup legend="Serviced to AS 4575" name={`appliance.${index}.serviced`} error={errors[`appliance.${index}.serviced`]} />
          <TextInput label="CO / spillage result" name={`appliance.${index}.co`} error={errors[`appliance.${index}.co`]} maxLength={80} />
          <TextInput label="Compliance record no." name={`appliance.${index}.record`} error={errors[`appliance.${index}.record`]} optional maxLength={40} />
        </div>
      ))}
    </section>
  );
}

function RcdRows({ errors }: { errors: FieldErrors }) {
  const [count, setCount] = useState(1);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-brand-navy">RCD tests</h2>
        <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold" onClick={() => setCount((value) => Math.min(12, value + 1))}>
          Add
        </button>
      </div>
      {errors.rcd ? <p className="text-sm text-red-800">{errors.rcd}</p> : null}
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-slate-200 p-3">
          <TextInput label="Circuit protected" name={`rcd.${index}.circuit`} error={errors[`rcd.${index}.circuit`]} maxLength={60} />
          <ChoiceGroup
            legend="Push-button test"
            name={`rcd.${index}.push`}
            error={errors[`rcd.${index}.push`]}
            options={[
              { value: "pass", label: "Pass" },
              { value: "fail", label: "Fail" },
            ]}
          />
          <AddMore label="Time test">
            <ChoiceGroup
              legend="Time test"
              name={`rcd.${index}.time`}
              error={errors[`rcd.${index}.time`]}
              options={[
                { value: "pass", label: "Pass" },
                { value: "fail", label: "Fail" },
                { value: "skip", label: "Skip" },
              ]}
            />
            <TextInput label="Trip time ms" name={`rcd.${index}.ms`} error={errors[`rcd.${index}.ms`]} optional maxLength={4} />
          </AddMore>
        </div>
      ))}
    </section>
  );
}
