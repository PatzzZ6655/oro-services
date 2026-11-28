"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JobsClientError, postJobs } from "@/components/jobs/api";
import { contactDisplay, contactSaved, type JobContact, type JobRecord } from "@/lib/jobs-app/job-record";
import { guidedNext, nextNeighbourProgress, roleLabel, contactRoles, type ContactRole } from "@/lib/jobs-app/contact-groups";
import { mapsHref } from "@/lib/jobs-app/address";
import { businessLabel, type Business } from "@/lib/jobs-app/types";
import { BackLink, JobsButton, Screen, Spinner, fieldClass } from "@/components/jobs/ui";

const groups: { role: ContactRole; title: string }[] = [
  { role: "tenant", title: "Tenants" },
  { role: "owner", title: "Owner" },
  { role: "neighbour", title: "Neighbours" },
  { role: "other", title: "Other" },
];

export function JobRecordScreen({ id, business }: { id: string; business: Business }) {
  const [job, setJob] = useState<JobRecord | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState<ContactRole>("tenant");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pickup, setPickup] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const data = await postJobs<{ job: JobRecord }>("/jobs/api/job", { action: "load", business, jobId: id });
    setJob(data.job);
    setPickup(data.job.keyPickupDate.slice(0, 10));
  }

  useEffect(() => {
    load().catch((reason: unknown) => setError(reason instanceof JobsClientError ? reason.message : "That job could not be read."));
  }, [business, id]);

  async function run(action: string, extra: Record<string, unknown>, label: string) {
    setBusy(label);
    setError("");
    setNote("");
    try {
      const result = await postJobs<{ skipped?: boolean; sync?: string }>("/jobs/api/job", { action, business, jobId: id, ...extra });
      if (result.skipped || result.sync === "skipped") setNote("Saved here. The Make connection is not switched on yet.");
      await load();
    } catch (reason) {
      setError(reason instanceof JobsClientError ? reason.message : "The server did not reply. Try again.");
    } finally {
      setBusy("");
    }
  }

  if (!job && !error) return <Screen title="Job"><Spinner label="Opening" /></Screen>;
  if (!job) return <Screen title="Job" back={<BackLink href="/jobs" />}><p role="alert">{error}</p></Screen>;

  const guide = guidedNext(job.status, job.vacant);
  const nextNeighbour = nextNeighbourProgress(job.neighbour);

  return (
    <Screen title="Job" back={<BackLink href="/jobs" />}>
      <header className="flex flex-col gap-1">
        <p className="text-sm">{businessLabel(business)}</p>
        <a href={mapsHref(job.address)} className="text-2xl font-semibold underline">{job.address || job.title}</a>
        <p className="text-base">{job.status}{job.scheduled ? ` · ${job.scheduled.slice(0, 10)}` : ""}</p>
        {job.vacant ? <p className="text-sm font-semibold">Vacant</p> : null}
      </header>
      {guide ? (
        <section className="rounded-2xl border border-black p-4">
          <p className="text-base">{guide.text}</p>
          {guide.nextStatus ? (
            <JobsButton type="button" className="mt-3" disabled={Boolean(busy)} onClick={() => void run("status", { status: guide.nextStatus }, "Saving")}>
              Confirm {guide.nextStatus}
            </JobsButton>
          ) : null}
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Neighbour contacted: {job.neighbour}</p>
        {nextNeighbour ? (
          <JobsButton type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void run("neighbour", { current: job.neighbour }, "Saving")}>
            Confirm {nextNeighbour}
          </JobsButton>
        ) : null}
      </section>
      {groups.map((group) => {
        const people = job.contacts.filter((contact) => contact.role === group.role);
        if (job.vacant && (group.role === "tenant" || group.role === "owner")) return null;
        return (
          <section key={group.role} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{group.title}</h2>
            {people.length === 0 ? <p className="text-base">None yet.</p> : null}
            {people.map((contact) => (
              <ContactRow key={contact.pageId} contact={contact} address={job.address} busy={busy} onRemove={() => void run("remove", { pageId: contact.pageId }, "Removing")} />
            ))}
          </section>
        );
      })}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run("add", { role, name, phone, email, address: job.address }, "Saving").then(() => {
            setName("");
            setPhone("");
            setEmail("");
          });
        }}
      >
        <h2 className="text-lg font-semibold">Add contact</h2>
        <select value={role} onChange={(event) => setRole(contactRoleValue(event.target.value))} className={fieldClass}>
          {contactRoles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
        </select>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className={fieldClass} />
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile" inputMode="tel" className={fieldClass} />
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email (optional)" inputMode="email" className={fieldClass} />
        <JobsButton type="submit" disabled={Boolean(busy)}>Add</JobsButton>
      </form>
      <section className="flex flex-col gap-3 rounded-2xl border border-black p-4">
        <label className="flex min-h-14 items-center gap-3 text-base">
          <input type="checkbox" className="h-6 w-6 accent-black" checked={job.vacant} onChange={(event) => void run("vacant", { vacant: event.target.checked, date: pickup }, "Saving")} />
          Vacant, collect keys
        </label>
        {job.vacant ? (
          <>
            <input type="date" value={pickup} onChange={(event) => setPickup(event.target.value)} className={fieldClass} />
            <JobsButton type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void run("keyEmail", { address: job.address, brand: businessLabel(business), pmFirstName: job.customer.split(" ")[0] ?? "", pickupDate: pickup }, "Sending")}>
              Send key pickup email
            </JobsButton>
            <p className="text-sm">Key email: {job.keyEmailStatus || "none"}</p>
            <label className="flex min-h-14 items-center gap-3 text-base">
              <input type="checkbox" className="h-6 w-6 accent-black" checked={job.keysReturned} onChange={(event) => void run("keys", { returned: event.target.checked }, "Saving")} />
              Keys returned{job.keysReturnedAt ? ` · ${job.keysReturnedAt.slice(0, 16).replace("T", " ")}` : ""}
            </label>
          </>
        ) : null}
      </section>
      <Link href={`/jobs/job/${id}/sms?business=${business}`} className="flex min-h-14 items-center justify-center rounded-2xl bg-black text-lg font-semibold text-white">
        Text this job
      </Link>
      {note ? <p className="text-base">{note}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {busy ? <p className="text-base">{busy}</p> : null}
    </Screen>
  );
}

function contactRoleValue(value: string): ContactRole {
  return contactRoles.includes(value as ContactRole) ? (value as ContactRole) : "tenant";
}

function ContactRow({ contact, address, busy, onRemove }: { contact: JobContact; address: string; busy: string; onRemove: () => void }) {
  const saved = contactSaved(contact.googleStatus);
  return (
    <div className="rounded-2xl border border-black p-3">
      <p className="text-base font-semibold">{contact.name || roleLabel(contact.role)}</p>
      <p className="text-sm">{contact.phone}{contact.email ? ` · ${contact.email}` : ""}</p>
      <p className="text-sm">{saved ? "Saved in Google" : contact.googleStatus === "pending" || !contact.googleStatus ? "saving contact" : contact.googleStatus}</p>
      <p className="text-sm text-neutral-600">{contactDisplay(contact, address)}</p>
      <button type="button" className="mt-2 min-h-11 text-base underline" disabled={Boolean(busy)} onClick={onRemove}>Remove</button>
    </div>
  );
}
