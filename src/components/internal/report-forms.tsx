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
  jobSafety,
  signOffConfirmations,
  type CompanyId,
  type FieldErrors,
} from "@/lib/reports/catalog";
import {
  AreaInput,
  CheckDate,
  ChoiceGroup,
  CompanyChoice,
  ResultList,
  SignaturePad,
  TextInput,
  YesNoGroup,
} from "@/components/internal/form-controls";
import { ReportForm } from "@/components/internal/report-form";

function BrandHeading({
  company,
  title,
  detail,
}: {
  company: CompanyId | "";
  title: string;
  detail: string;
}) {
  const profile = company ? companies[company] : null;
  const bar = profile?.accent === "orange" ? "bg-brand-orange" : profile ? "bg-brand-blue" : "bg-slate-300";
  return (
    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className={`h-2 ${bar}`} />
      <div className="px-4 pt-3">
        {profile ? (
          <LogoImage
            src={profile.logo}
            alt={profile.name}
            width={profile.logoWidth}
            height={profile.logoHeight}
            sizes="180px"
            className="h-9 w-auto"
          />
        ) : (
          <p className="text-sm font-semibold text-slate-700">Choose the company</p>
        )}
        {profile ? (
          <p className="mt-2 text-sm font-semibold text-brand-navy">{profile.legalName}</p>
        ) : null}
      </div>
      <div className="px-4 pb-4">
        <h1 className="text-2xl font-semibold text-brand-navy">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{detail}</p>
      </div>
    </header>
  );
}

export function SiteJobSheetForm() {
  const [company, setCompany] = useState<"" | CompanyId>("");
  return (
    <div className="space-y-5">
      <ReportForm kind="site-job-sheet">
        {(errors) => (
          <>
            <CompanyChoice company={company} onChange={setCompany} error={errors.company} />
            <BrandHeading company={company} title="Site job sheet" detail="Hours, work, and the site checks." />
            <TextInput label="Worker name" name="workerName" error={errors.workerName} autoComplete="name" maxLength={80} />
            <TextInput label="Date" name="date" type="date" error={errors.date} />
            <TextInput label="Job / invoice no." name="jobNumber" error={errors.jobNumber} maxLength={40} />
            <TextInput label="Site address" name="address" error={errors.address} maxLength={200} />
            <TextInput label="Start time" name="startTime" type="time" error={errors.startTime} />
            <TextInput label="Finish time" name="finishTime" type="time" error={errors.finishTime} />
            <AreaInput label="Work performed" name="work" error={errors.work} maxLength={2000} />
            <AreaInput label="Materials used" name="materials" error={errors.materials} optional maxLength={1000} />
            {company ? (
              <div className="space-y-4">
                {(Object.keys(jobSafety) as ("emoro" | "emporo")[]).map((id) => (
                  <fieldset key={id} hidden={company !== id} disabled={company !== id} className="space-y-4">
                    {jobSafety[id].map((item) => (
                      <YesNoGroup key={item.id} legend={item.label} name={`safety.${id}.${item.id}`} error={errors[`safety.${id}.${item.id}`]} />
                    ))}
                  </fieldset>
                ))}
              </div>
            ) : null}
            <AreaInput label="Issues" name="issues" error={errors.issues} optional maxLength={1000} />
            <SignaturePad error={errors.signature} />
          </>
        )}
      </ReportForm>
    </div>
  );
}

export function JobSignOffForm() {
  const [company, setCompany] = useState<"" | CompanyId>("");
  return (
    <div className="space-y-5">
      <ReportForm kind="job-sign-off">
        {(errors) => (
          <>
            <CompanyChoice company={company} onChange={setCompany} error={errors.company} />
            <BrandHeading company={company} title="Job completion sign-off" detail="The client confirms the finished work." />
            <TextInput label="Job / invoice no." name="jobNumber" error={errors.jobNumber} maxLength={40} />
            <TextInput label="Client name" name="clientName" error={errors.clientName} autoComplete="name" maxLength={80} />
            <TextInput label="Site address" name="address" error={errors.address} maxLength={200} />
            <TextInput label="Completion date" name="date" type="date" error={errors.date} />
            <AreaInput label="Work completed" name="work" error={errors.work} maxLength={2000} />
            {signOffConfirmations.map((item) => (
              <YesNoGroup key={item.id} legend={item.label} name={`confirm.${item.id}`} error={errors[`confirm.${item.id}`]} />
            ))}
            <AreaInput label="Comments" name="comments" error={errors.comments} optional maxLength={1000} />
            <TextInput label="Client email for a copy" name="clientEmail" type="email" error={errors.clientEmail} optional autoComplete="email" maxLength={254} />
            <SignaturePad error={errors.signature} />
          </>
        )}
      </ReportForm>
    </div>
  );
}

export function GasSafetyForm() {
  return (
    <div className="space-y-5">
      <ReportForm kind="gas-safety">
        {(errors) => (
          <>
            <BrandHeading
              company="emporo"
              title="Gas safety check"
              detail="Victorian rental check. AS/NZS 5601.1. AS 4575. Next due is two years from the check date."
            />
            <TextInput label="Property address" name="address" error={errors.address} maxLength={200} />
            <TextInput label="Rental provider / agent" name="providerName" error={errors.providerName} maxLength={80} />
            <TextInput label="Provider / agent email" name="providerEmail" type="email" error={errors.providerEmail} autoComplete="email" maxLength={254} />
            <CheckDate />
            {errors.date ? <p className="text-sm text-red-800">{errors.date}</p> : null}
            <TextInput label="Gasfitter full name" name="gasfitterName" error={errors.gasfitterName} autoComplete="name" maxLength={80} />
            <TextInput label="Licence / registration no." name="licence" error={errors.licence} maxLength={40} />
            <label className="flex min-h-12 items-start gap-3 text-sm text-slate-800">
              <input name="endorsement" type="checkbox" value="yes" className="mt-1 size-5" />
              I hold a Type A appliance servicing endorsement.
            </label>
            {errors.endorsement ? <p className="text-sm text-red-800">{errors.endorsement}</p> : null}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Installation checks</h2>
              <ResultList group="check" items={gasChecks} errors={errors} />
            </section>
            <ApplianceRows errors={errors} />
            <AreaInput label="Faults and recommendations" name="faults" error={errors.faults} optional maxLength={2000} />
            <UrgentBlock legend="Urgent or disconnected appliance" error={errors.urgent} detailsError={errors.urgentDetails} />
            <ChoiceGroup
              legend="Overall result"
              name="overall"
              error={errors.overall}
              options={[
                { value: "compliant", label: "Compliant" },
                { value: "non-compliant", label: "Non-compliant" },
              ]}
            />
            <SignaturePad error={errors.signature} />
          </>
        )}
      </ReportForm>
    </div>
  );
}

export function ElectricalSafetyForm() {
  return (
    <div className="space-y-5">
      <ReportForm kind="electrical-safety">
        {(errors) => (
          <>
            <BrandHeading
              company="emoro"
              title="Electrical safety check"
              detail="AS/NZS 3019:2022 section 4. Next due is two years from the check date. Smoke alarms are due again in 12 months."
            />
            <TextInput label="Property address" name="address" error={errors.address} maxLength={200} />
            <TextInput label="Rental provider / agent" name="providerName" error={errors.providerName} maxLength={80} />
            <TextInput label="Provider / agent email" name="providerEmail" type="email" error={errors.providerEmail} autoComplete="email" maxLength={254} />
            <CheckDate smoke />
            {errors.date ? <p className="text-sm text-red-800">{errors.date}</p> : null}
            <TextInput label="Previous check date" name="previousDate" type="date" error={errors.previousDate} optional />
            <TextInput label="Electrician full name" name="electricianName" error={errors.electricianName} autoComplete="name" maxLength={80} />
            <TextInput label="Licence no." name="licence" error={errors.licence} maxLength={40} />
            <TextInput label="REC no." name="rec" error={errors.rec} optional maxLength={40} />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Extent of the check</h2>
              <p className="text-sm text-slate-600">NI means that part was not included.</p>
              {electricalExtent.map((item) => (
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
              {errors.extent ? <p className="text-sm text-red-800">{errors.extent}</p> : null}
              <AreaInput label="Limitations" name="limitations" error={errors.limitations} optional maxLength={500} />
            </section>
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Visual inspection</h2>
              <ResultList group="visual" items={electricalVisual} errors={errors} />
            </section>
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Polarity and correct connections</h2>
              <ResultList group="polarity" items={electricalPolarity} errors={errors} />
            </section>
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Earth continuity</h2>
              <ResultList group="earth" items={electricalEarth} errors={errors} withReading />
            </section>
            <RcdRows errors={errors} />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-brand-navy">Smoke alarms</h2>
              <YesNoGroup
                legend="Installed, working, and tested to the manufacturer instructions"
                name="smoke"
                error={errors.smoke}
              />
              <AreaInput label="Smoke alarm comment" name="smokeComment" error={errors.smokeComment} optional maxLength={500} />
            </section>
            <AreaInput label="Faults and recommendations" name="faults" error={errors.faults} optional maxLength={2000} />
            <UrgentBlock legend="Urgent hazard" error={errors.urgent} detailsError={errors.urgentDetails} />
            <ChoiceGroup
              legend="Overall result"
              name="overall"
              error={errors.overall}
              options={[
                { value: "compliant", label: "Compliant" },
                { value: "non-compliant", label: "Non-compliant" },
              ]}
            />
            <SignaturePad error={errors.signature} />
          </>
        )}
      </ReportForm>
    </div>
  );
}

function UrgentBlock({
  legend,
  error,
  detailsError,
}: {
  legend: string;
  error?: string;
  detailsError?: string;
}) {
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
            <label
              key={value}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800 has-[:checked]:border-brand-navy has-[:checked]:bg-brand-navy has-[:checked]:text-white"
            >
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
      {count > 0 ? (
        <button type="button" className="min-h-11 text-sm font-semibold text-slate-700 underline" onClick={() => setCount((value) => Math.max(0, value - 1))}>
          Remove last
        </button>
      ) : null}
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
          <ChoiceGroup
            legend="Time test (optional)"
            name={`rcd.${index}.time`}
            error={errors[`rcd.${index}.time`]}
            options={[
              { value: "pass", label: "Pass" },
              { value: "fail", label: "Fail" },
              { value: "skip", label: "Skip" },
            ]}
          />
          <TextInput label="Trip time ms" name={`rcd.${index}.ms`} error={errors[`rcd.${index}.ms`]} optional maxLength={4} />
        </div>
      ))}
      {count > 1 ? (
        <button type="button" className="min-h-11 text-sm font-semibold text-slate-700 underline" onClick={() => setCount((value) => Math.max(1, value - 1))}>
          Remove last
        </button>
      ) : null}
    </section>
  );
}

