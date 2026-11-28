"use client";

import { useEffect, useState } from "react";
import { JobsClientError, postJobs } from "@/components/jobs/api";
import { contactSaved, type JobRecord } from "@/lib/jobs-app/job-record";
import { firstName, primaryContacts, roleLabel, type ContactRole } from "@/lib/jobs-app/contact-groups";
import { fieldsFor, jobSmsBodyLimit, neighbourBooked, neighbourDateChange, neighbourDone, neighbourFollowUp, neighbourImpactLines, neighbourIntro, ownerFollowUp, ownerIntro } from "@/lib/jobs-app/group-messages";
import { fillSmsTemplate, smsTemplateById } from "@/lib/sms-templates";
import { smsMessageBody } from "@/lib/sms-link";
import { smsHref } from "@/lib/jobs-app/sms";
import { businessLabel, type Business } from "@/lib/jobs-app/types";
import { ErrorBanner } from "@/components/jobs/field-error";
import { BackLink, JobsButton, Screen, Spinner, fieldClass } from "@/components/jobs/ui";

const sections: { role: ContactRole; title: string }[] = [
  { role: "tenant", title: "Tenants" },
  { role: "owner", title: "Owner" },
  { role: "neighbour", title: "Neighbours" },
  { role: "other", title: "Other" },
];

export function GroupSmsScreen({ id, business }: { id: string; business: Business }) {
  const [job, setJob] = useState<JobRecord | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [impact, setImpact] = useState<string>(neighbourImpactLines[0]);
  const [customImpact, setCustomImpact] = useState("");
  const [summary, setSummary] = useState("");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [otherText, setOtherText] = useState("");
  const [override, setOverride] = useState(false);

  useEffect(() => {
    postJobs<{ job: JobRecord }>("/jobs/api/job", { action: "load", business, jobId: id })
      .then((data) => {
        setJob(data.job);
        setSummary(data.job.description);
        setDate(data.job.scheduled.slice(0, 10));
      })
      .catch((reason: unknown) => setError(reason instanceof JobsClientError ? reason.message : "That job could not be read."));
  }, [business, id]);

  if (!job && !error) return <Screen title="Texts"><Spinner label="Opening" /></Screen>;
  if (!job) return <Screen title="Texts" back={<BackLink href="/jobs" />}><ErrorBanner message={error || "That job could not be read."} /></Screen>;

  const brand = businessLabel(business);
  const impactLine = impact === "custom" ? customImpact : impact;
  const shared = { brand, agency: job.customer, summary, address: job.address, duration, date, time, impact: impactLine };
  const present = sections.filter((section) => job.contacts.some((contact) => contact.role === section.role));
  const hidden = new Set<ContactRole>(job.vacant ? ["tenant", "owner"] : job.contacts.some((contact) => contact.role === "tenant") ? ["owner"] : []);

  function open(role: ContactRole, template: string) {
    const people = job!.contacts.filter((contact) => contact.role === role && (override || contactSaved(contact.googleStatus)) && contact.phone);
    if (people.length === 0) {
      setError("No saved contact in this group yet. Tick the override only for a TEST number.");
      return;
    }
    const body = smsMessageBody(template, jobSmsBodyLimit);
    if (!body) {
      setError("That text is too long.");
      return;
    }
    const link = smsHref(people.map((person) => person.phone), body);
    if (!link) return;
    setError("");
    window.location.href = link.href;
  }

  return (
    <Screen title="Texts" back={<BackLink href={`/jobs/job/${id}?business=${business}`} />}>
      <p className="text-lg font-semibold">{job.address || job.title}</p>
      {job.vacant ? <p className="text-base">Vacant. Tenant and owner texts stay hidden.</p> : null}
      <label className="flex min-h-14 items-center gap-3 text-base">
        <input type="checkbox" className="h-6 w-6 accent-black" checked={override} onChange={(event) => setOverride(event.target.checked)} />
        Text anyway before Google has saved the contact
      </label>
      <label className="flex flex-col gap-2 text-base">Summary<input value={summary} onChange={(event) => setSummary(event.target.value)} className={fieldClass} /></label>
      <label className="flex flex-col gap-2 text-base">Duration<input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="half a day" className={fieldClass} /></label>
      <label className="flex flex-col gap-2 text-base">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} /></label>
      <label className="flex flex-col gap-2 text-base">Time<input value={time} onChange={(event) => setTime(event.target.value)} placeholder="9am" className={fieldClass} /></label>
      <label className="flex flex-col gap-2 text-base">
        Impact line
        <select value={impact} onChange={(event) => setImpact(event.target.value)} className={fieldClass}>
          {neighbourImpactLines.map((line) => <option key={line} value={line}>{line}</option>)}
          <option value="custom">Custom</option>
        </select>
      </label>
      {impact === "custom" ? <input value={customImpact} onChange={(event) => setCustomImpact(event.target.value)} placeholder="Custom impact line" className={fieldClass} /> : null}
      {present.filter((section) => !hidden.has(section.role)).map((section) => {
        const people = job.contacts.filter((contact) => contact.role === section.role);
        const sample = fieldsFor(people[0]?.name ?? "", shared);
        const choices = templatesFor(section.role, sample, otherText);
        return (
          <section key={section.role} className="flex flex-col gap-2 rounded-2xl border border-black p-3">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {people.map((person) => <p key={person.pageId} className="text-sm">{person.name || roleLabel(section.role)} · {person.phone || "no mobile"} · {contactSaved(person.googleStatus) ? "saved" : "saving contact"}</p>)}
            {section.role === "other" ? <textarea value={otherText} onChange={(event) => setOtherText(event.target.value)} rows={3} className={`${fieldClass} py-3`} /> : null}
            {choices.map((choice) => (
              <JobsButton key={choice.id} type="button" variant="outline" onClick={() => open(section.role, choice.body)}>
                {choice.label}
              </JobsButton>
            ))}
            <JobsButton type="button" onClick={() => open(section.role, choices[0]?.body ?? "")}>
              Text all in {section.title}
            </JobsButton>
            {section.role === "neighbour" ? (
              <JobsButton
                type="button"
                variant="outline"
                onClick={() => {
                  void postJobs("/jobs/api/job", {
                    action: "groupEmail",
                    business,
                    jobId: id,
                    template: "n1",
                    impactLine,
                    address: job.address,
                    brand,
                    summary,
                    date,
                    contacts: people.filter((person) => person.email).map((person) => ({ name: person.name, email: person.email, first: firstName(person.name) })),
                  }).then(() => setNote("Neighbour email requested. If Make is off, nothing was sent.")).catch((reason: unknown) => setError(reason instanceof JobsClientError ? reason.message : "The email was not sent."));
                }}
              >
                Email neighbours now
              </JobsButton>
            ) : null}
          </section>
        );
      })}
      {primaryContacts(job.contacts).length === 0 && !job.vacant ? <p className="text-base">No tenant or owner on this job.</p> : null}
      {note ? <p className="text-base">{note}</p> : null}
      <ErrorBanner message={error} />
    </Screen>
  );
}

function tenantText(id: string, sample: ReturnType<typeof fieldsFor>): string {
  const template = smsTemplateById(id);
  return fillSmsTemplate(template?.english ?? "", {
    name: sample.first,
    pmName: "",
    brand: sample.brand,
    agency: sample.agency,
    address: sample.address,
    day: sample.date,
    time: sample.time,
    mins: "",
    reason: "",
    issue: "",
  });
}

function templatesFor(role: ContactRole, sample: ReturnType<typeof fieldsFor>, other: string): { id: string; label: string; body: string }[] {
  if (role === "tenant") return [
    { id: "t1", label: "T1", body: tenantText("first-visit", sample) },
    { id: "t2", label: "T2", body: tenantText("follow-up", sample) },
  ];
  if (role === "owner") return [
    { id: "o1", label: "O1 access", body: ownerIntro(sample) },
    { id: "o2", label: "O2 follow up", body: ownerFollowUp(sample) },
  ];
  if (role === "neighbour") return [
    { id: "n1", label: "N1", body: neighbourIntro(sample) },
    { id: "follow", label: "Follow up", body: neighbourFollowUp(sample) },
    { id: "n2", label: "N2 booked", body: neighbourBooked(sample) },
    { id: "date", label: "Date change", body: neighbourDateChange(sample) },
    { id: "n3", label: "N3 done", body: neighbourDone(sample) },
  ];
  return [{ id: "g1", label: "G1", body: other.trim() }];
}
