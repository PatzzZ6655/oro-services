"use client";

import { startTransition, useActionState, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { sendEnquiry } from "@/app/contact/actions";
import { AppointmentFields } from "@/components/appointment-fields";
import { SuburbField } from "@/components/suburb-field";
import { validateAppointments, type AppointmentFieldErrors } from "@/lib/appointments";
import {
  brandLabel,
  corporateEmail,
  getBrand,
  inboxFor,
  isEnquiryBrand,
  photoAccept,
  photoMaxBytes,
  type EnquiryBrand,
} from "@/lib/content";

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

function readFormText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function initialBrand(value: string | null): EnquiryBrand | "" {
  return value && isEnquiryBrand(value) ? value : "";
}

function initialService(brand: EnquiryBrand | "", value: string | null): string {
  if (!brand || brand === "general") return "unsure";
  const match = getBrand(brand)?.services.some((service) => service.slug === value);
  return match ? value ?? "unsure" : "unsure";
}

export function EnquiryForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(sendEnquiry, { status: "idle" });
  const [brand, setBrand] = useState<EnquiryBrand | "">(() => initialBrand(params.get("brand")));
  const [service, setService] = useState(() => initialService(brand, params.get("service")));
  const [photoMessage, setPhotoMessage] = useState<string | undefined>();
  const [appointmentErrors, setAppointmentErrors] = useState<AppointmentFieldErrors>({});

  const inbox = brand ? inboxFor(brand) : undefined;
  const services = brand && brand !== "general" ? getBrand(brand)?.services ?? [] : [];
  const errors = {
    ...(state.status === "invalid" ? state.errors : {}),
    ...appointmentErrors,
  };

  function onBrandChange(next: string) {
    const parsed = isEnquiryBrand(next) ? next : "";
    setBrand(parsed);
    setService((current) => {
      if (!parsed || parsed === "general") return "unsure";
      const stillValid = getBrand(parsed)?.services.some((item) => item.slug === current);
      return stillValid ? current : "unsure";
    });
  }

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (brand === "emporo") {
          const arrival = validateAppointments(
            [1, 2, 3].map((number) => ({
              date: readFormText(data, `option${number}Date`),
              windowId: readFormText(data, `option${number}Window`),
            })),
          );
          if (!arrival.ok) {
            setAppointmentErrors(arrival.errors);
            return;
          }
        }
        setAppointmentErrors({});
        startTransition(() => {
          action(data);
        });
      }}
    >
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Leave this blank
          <input name="oro_fax" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Status stateInbox={state.status === "sent" ? state.inbox : undefined} status={state.status} message={"message" in state ? state.message : undefined} mailto={"mailto" in state ? state.mailto : undefined} />

      <Field label="Your name" name="name" error={errors.name}>
        <input id="name" name="name" type="text" autoComplete="name" required maxLength={80} aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? "name-error" : undefined} className={fieldClass} />
      </Field>

      <Field label="Email" name="email" error={errors.email}>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? "email-error" : undefined} className={fieldClass} />
      </Field>

      <Field label="Phone (optional)" name="phone" error={errors.phone}>
        <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={20} aria-invalid={errors.phone ? true : undefined} aria-describedby={errors.phone ? "phone-error" : undefined} className={fieldClass} />
      </Field>

      <Field label="Suburb or area" name="suburb" error={errors.suburb}>
        <SuburbField invalid={Boolean(errors.suburb)} describedBy={errors.suburb ? "suburb-error" : undefined} />
      </Field>

      <Field label="Which brand?" name="brand" error={errors.brand}>
        <select
          id="brand"
          name="brand"
          required
          value={brand}
          onChange={(event) => onBrandChange(event.target.value)}
          aria-invalid={errors.brand ? true : undefined}
          aria-describedby={errors.brand ? "brand-error" : undefined}
          className={fieldClass}
        >
          <option value="">Choose a brand</option>
          <option value="emoro">Emoro Building</option>
          <option value="emporo">Emporo Plumbing</option>
          <option value="general">ORO Services (general)</option>
        </select>
      </Field>

      <Field label="Which service?" name="service" error={errors.service}>
        <select
          id="service"
          name="service"
          value={brand ? service : "unsure"}
          disabled={!brand}
          onChange={(event) => setService(event.target.value)}
          aria-invalid={errors.service ? true : undefined}
          aria-describedby={errors.service ? "service-error" : undefined}
          className={fieldClass}
        >
          <option value="unsure">Not sure</option>
          {services.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>

      {brand === "emporo" ? (
        <AppointmentFields errors={appointmentErrors} onEdit={() => setAppointmentErrors({})} />
      ) : null}

      <Field label="What do you need done?" name="description" error={errors.description}>
        <textarea id="description" name="description" required rows={5} maxLength={2000} aria-invalid={errors.description ? true : undefined} aria-describedby={errors.description ? "description-error" : undefined} className={fieldClass} />
      </Field>

      <Field label="Photo (optional)" name="photo" error={photoMessage ?? errors.photo}>
        <input
          id="photo"
          name="photo"
          type="file"
          accept={photoAccept}
          className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold file:text-slate-800"
          aria-invalid={photoMessage || errors.photo ? true : undefined}
          aria-describedby={photoMessage || errors.photo ? "photo-error" : undefined}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              setPhotoMessage(undefined);
              return;
            }
            if (file.size > photoMaxBytes) {
              setPhotoMessage("Photo must be 2 MB or smaller.");
              event.target.value = "";
              return;
            }
            setPhotoMessage(undefined);
          }}
        />
        <p className="text-sm text-slate-600">JPEG, PNG, or WebP, up to 2 MB.</p>
      </Field>

      {inbox ? (
        <p className="text-sm text-slate-700">
          This goes to{" "}
          <a className="font-semibold text-brand-navy underline" href={`mailto:${inbox}`}>
            {inbox}
          </a>
          {brand ? ` (${brandLabel(brand)})` : ""}.
        </p>
      ) : (
        <p className="text-sm text-slate-700">
          General enquiries go to{" "}
          <a className="font-semibold text-brand-navy underline" href={`mailto:${corporateEmail}`}>
            {corporateEmail}
          </a>
          .
        </p>
      )}

      <p className="text-sm text-slate-700">
        We use these details to handle your enquiry. Read the{" "}
        <Link href="/privacy" className="font-semibold text-brand-navy underline">
          Privacy Policy
        </Link>
        .
      </p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-brand-navy px-6 py-4 font-semibold text-white transition-colors hover:bg-brand-blue disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:w-auto"
      >
        {pending ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: ReactNode;
}) {
  const errorId = `${name}-error`;
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Status({
  status,
  message,
  mailto,
  stateInbox,
}: {
  status: string;
  message?: string;
  mailto?: string;
  stateInbox?: string;
}) {
  if (status === "idle" || status === "invalid") return null;

  if (status === "sent") {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
        {stateInbox ? `Sent to ${stateInbox}.` : "Sent."}
      </p>
    );
  }

  return (
    <div role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p>{message}</p>
      {mailto ? (
        <a href={mailto} className="mt-2 inline-block font-semibold underline">
          Email {stateInboxFromMailto(mailto)}
        </a>
      ) : null}
    </div>
  );
}

function stateInboxFromMailto(mailto: string): string {
  const address = mailto.slice("mailto:".length).split("?")[0];
  return address || "the team";
}
