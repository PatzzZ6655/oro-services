"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FieldErrors, NamedItem } from "@/lib/reports/catalog";
import { addYears, formatAuDate } from "@/lib/reports/dates";

export const fieldClass =
  "mt-1 w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

const choiceClass =
  "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-2 text-center text-sm font-semibold text-slate-800 has-[:checked]:border-brand-navy has-[:checked]:bg-brand-navy has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-navy";

export function Field({
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
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  label,
  name,
  error,
  type = "text",
  optional = false,
  maxLength,
  autoComplete,
  defaultValue,
}: {
  label: string;
  name: string;
  error?: string;
  type?: string;
  optional?: boolean;
  maxLength?: number;
  autoComplete?: string;
  defaultValue?: string;
}) {
  return (
    <Field label={optional ? `${label} (optional)` : label} name={name} error={error}>
      <input
        id={name}
        name={name}
        type={type}
        maxLength={maxLength}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={fieldClass}
      />
    </Field>
  );
}

export function AreaInput({
  label,
  name,
  error,
  optional = false,
  maxLength,
}: {
  label: string;
  name: string;
  error?: string;
  optional?: boolean;
  maxLength?: number;
}) {
  return (
    <Field label={optional ? `${label} (optional)` : label} name={name} error={error}>
      <textarea
        id={name}
        name={name}
        rows={4}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={fieldClass}
      />
    </Field>
  );
}

export function ChoiceGroup({
  legend,
  name,
  options,
  error,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">{legend}</legend>
      <div className={`mt-2 grid gap-2 ${options.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((option) => (
          <label key={option.value} className={choiceClass}>
            <input className="sr-only" type="radio" name={name} value={option.value} />
            {option.label}
          </label>
        ))}
      </div>
      {error ? <p className="mt-1 text-sm text-red-800">{error}</p> : null}
    </fieldset>
  );
}

const passFail = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "na", label: "N/A" },
];

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export function ResultList({
  group,
  items,
  errors,
  withReading = false,
}: {
  group: string;
  items: readonly NamedItem[];
  errors: FieldErrors;
  withReading?: boolean;
}) {
  const [fails, setFails] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const name = `${group}.${item.id}`;
        const showComment = fails[item.id] || Boolean(errors[`${name}.comment`]);
        return (
          <fieldset key={item.id} className="border-b border-slate-200 pb-4">
            <legend className="text-sm font-medium text-slate-800">{item.label}</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {passFail.map((option) => (
                <label key={option.value} className={choiceClass}>
                  <input
                    className="sr-only"
                    type="radio"
                    name={name}
                    value={option.value}
                    onChange={() => setFails((current) => ({ ...current, [item.id]: option.value === "fail" }))}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {errors[name] ? <p className="mt-1 text-sm text-red-800">{errors[name]}</p> : null}
            {withReading ? (
              <label className="mt-2 block text-xs text-slate-600">
                Reading (optional)
                <input name={`${name}.reading`} maxLength={24} aria-label={`${item.label} reading`} className={fieldClass} />
              </label>
            ) : null}
            {errors[`${name}.reading`] ? <p className="mt-1 text-sm text-red-800">{errors[`${name}.reading`]}</p> : null}
            {showComment ? (
              <label className="mt-2 block text-sm font-medium text-slate-800">
                Comment
                <textarea name={`${name}.comment`} rows={2} maxLength={500} className={fieldClass} />
              </label>
            ) : null}
            {errors[`${name}.comment`] ? <p className="mt-1 text-sm text-red-800">{errors[`${name}.comment`]}</p> : null}
          </fieldset>
        );
      })}
    </div>
  );
}

export function YesNoGroup({ legend, name, error }: { legend: string; name: string; error?: string }) {
  return <ChoiceGroup legend={legend} name={name} options={yesNo} error={error} />;
}

export function CheckDate({ smoke = false }: { smoke?: boolean }) {
  const [date, setDate] = useState("");
  const next = date ? addYears(date, 2) : null;
  const smokeDue = date ? addYears(date, 1) : null;
  return (
    <Field label="Check date" name="date">
      <input
        id="date"
        name="date"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        className={fieldClass}
      />
      {next ? <p className="mt-1 text-sm text-slate-600">Next check due {formatAuDate(next)}.</p> : null}
      {smoke && smokeDue ? <p className="text-sm text-slate-600">Next smoke alarm check due {formatAuDate(smokeDue)}.</p> : null}
    </Field>
  );
}

export function SignaturePad({ error }: { error?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const ink = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(scale, scale);
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.strokeStyle = "#0F172A";
  }, []);

  function context() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function finish() {
    drawing.current = false;
    const canvas = canvasRef.current;
    const input = inputRef.current;
    if (!canvas || !input) return;
    input.value = ink.current ? canvas.toDataURL("image/png") : "";
  }

  function clear() {
    const canvas = canvasRef.current;
    const draw = context();
    if (!canvas || !draw) return;
    ink.current = false;
    draw.clearRect(0, 0, canvas.width, canvas.height);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-800">Signature</p>
      <canvas
        ref={canvasRef}
        aria-label="Signature"
        className="mt-1 h-36 w-full touch-none rounded-xl border border-slate-300 bg-white"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const draw = context();
          if (!draw) return;
          drawing.current = true;
          ink.current = true;
          const next = point(event);
          draw.beginPath();
          draw.moveTo(next.x, next.y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const draw = context();
          if (!draw) return;
          const next = point(event);
          draw.lineTo(next.x, next.y);
          draw.stroke();
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      <button type="button" onClick={clear} className="mt-2 min-h-11 text-sm font-semibold text-slate-700 underline">
        Clear signature
      </button>
      <input ref={inputRef} type="hidden" name="signature" />
      {error ? <p className="mt-1 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}

export function CompanyChoice({
  company,
  onChange,
  error,
}: {
  company: "" | "emoro" | "emporo";
  onChange: (value: "emoro" | "emporo") => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">Company</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(
          [
            ["emoro", "Emoro Building"],
            ["emporo", "Emporo Plumbing"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className={choiceClass}>
            <input
              className="sr-only"
              type="radio"
              name="company"
              value={value}
              checked={company === value}
              onChange={() => onChange(value)}
            />
            {label}
          </label>
        ))}
      </div>
      {error ? <p className="mt-1 text-sm text-red-800">{error}</p> : null}
    </fieldset>
  );
}
