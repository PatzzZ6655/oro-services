"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { itemPhotoField, itemPhotoMax, type FieldErrors, type NamedItem } from "@/lib/reports/catalog";
import { addYears, formatAuDate } from "@/lib/reports/dates";

export const fieldClass =
  "mt-1 w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

const choiceClass =
  "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-2 text-center text-sm font-semibold text-slate-700 has-[:checked]:border-brand-navy has-[:checked]:bg-slate-50 has-[:checked]:text-brand-navy has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-navy";

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
  value,
  onValue,
}: {
  label: string;
  name: string;
  error?: string;
  type?: string;
  optional?: boolean;
  maxLength?: number;
  autoComplete?: string;
  defaultValue?: string;
  value?: string;
  onValue?: (value: string) => void;
}) {
  return (
    <Field label={optional ? `${label} (optional)` : label} name={name} error={error}>
      <input
        id={name}
        name={name}
        type={type}
        maxLength={maxLength}
        autoComplete={autoComplete}
        {...(value === undefined ? { defaultValue } : { value, onChange: (event: ChangeEvent<HTMLInputElement>) => onValue?.(event.target.value) })}
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
  onValue,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  error?: string;
  onValue?: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">{legend}</legend>
      <div className={`mt-2 grid gap-2 ${options.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((option) => (
          <label key={option.value} className={choiceClass}>
            <input className="sr-only" type="radio" name={name} value={option.value} onChange={() => onValue?.(option.value)} />
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

export function AddMore({ label = "Add more", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="min-h-12 text-sm font-semibold text-brand-navy" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide extra" : label}
      </button>
      {open ? <div className="mt-3 space-y-4">{children}</div> : null}
    </div>
  );
}

export function OptionalPhoto({ name, error, open = false }: { name: string; error?: string; open?: boolean }) {
  const [opened, setOpened] = useState(false);
  const shown = open || opened;
  if (!shown) {
    return (
      <button type="button" className="min-h-10 text-sm font-semibold text-slate-600" onClick={() => setOpened(true)}>
        Add photo
      </button>
    );
  }
  return <ItemPhotoField name={name} error={error} required={open} />;
}

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
  const [results, setResults] = useState<Record<string, string>>({});
  const [readings, setReadings] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-4">
      <button
        type="button"
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
        onClick={() => setResults(Object.fromEntries(items.map((item) => [item.id, "pass"])))}
      >
        All pass
      </button>
      {items.map((item) => {
        const name = `${group}.${item.id}`;
        const failed = results[item.id] === "fail" || Boolean(errors[`${name}.comment`]) || Boolean(errors[`${name}.photos`]);
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
                    checked={results[item.id] === option.value}
                    onChange={() => setResults((current) => ({ ...current, [item.id]: option.value }))}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {errors[name] ? <p className="mt-1 text-sm text-red-800">{errors[name]}</p> : null}
            {withReading && (readings[item.id] || errors[`${name}.reading`]) ? (
              <label className="mt-2 block text-xs text-slate-600">
                Reading
                <input name={`${name}.reading`} maxLength={24} aria-label={`${item.label} reading`} className={fieldClass} />
              </label>
            ) : null}
            {withReading && !readings[item.id] && !errors[`${name}.reading`] ? (
              <button type="button" className="mt-2 min-h-10 text-sm font-semibold text-slate-600" onClick={() => setReadings((current) => ({ ...current, [item.id]: true }))}>
                Add reading
              </button>
            ) : null}
            {errors[`${name}.reading`] ? <p className="mt-1 text-sm text-red-800">{errors[`${name}.reading`]}</p> : null}
            {failed ? (
              <label className="mt-2 block text-sm font-medium text-slate-800">
                Comment
                <textarea name={`${name}.comment`} rows={2} maxLength={500} className={fieldClass} />
              </label>
            ) : null}
            {errors[`${name}.comment`] ? <p className="mt-1 text-sm text-red-800">{errors[`${name}.comment`]}</p> : null}
            <OptionalPhoto name={itemPhotoField(name)} error={errors[`${name}.photos`]} open={failed} />
          </fieldset>
        );
      })}
    </div>
  );
}

export function ItemPhotoField({ name, error, required = false }: { name: string; error?: string; required?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; file: File }[]>([]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const restore = () => {
      const files = Array.from(input.files ?? []);
      setPhotos(files.map((file) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(file), file })));
    };
    input.addEventListener("oro-files", restore);
    return () => input.removeEventListener("oro-files", restore);
  }, []);

  function writeFiles(next: { id: string; url: string; file: File }[]) {
    const transfer = new DataTransfer();
    for (const photo of next) transfer.items.add(photo.file);
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  async function addPhotos(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next = [...photos];
    for (const file of Array.from(list)) {
      if (next.length >= itemPhotoMax) break;
      try {
        const compressed = await compressItemPhoto(file);
        next.push({ id: crypto.randomUUID(), url: URL.createObjectURL(compressed), file: compressed });
      } catch {
        // Skip a file the browser cannot decode. The field error covers a failed item.
      }
    }
    setPhotos(next);
    writeFiles(next);
  }

  function removePhoto(id: string) {
    const next = photos.filter((photo) => photo.id !== id);
    const removed = photos.find((photo) => photo.id === id);
    if (removed) URL.revokeObjectURL(removed.url);
    setPhotos(next);
    writeFiles(next);
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        name={name}
        accept="image/*"
        multiple
        onChange={(event) => {
          void addPhotos(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
        onClick={() => inputRef.current?.click()}
      >
        Add photo
      </button>
      {required ? <p className="mt-1 text-xs text-slate-500">Add a photo for this fail.</p> : null}
      {photos.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              {/* Blob previews are created in the browser, so next/image cannot optimise them. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <button
                type="button"
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm text-slate-700 shadow"
                aria-label="Remove photo"
                onClick={() => removePhoto(photo.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-1 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}

async function compressItemPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1024;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("photo");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.62));
  if (!blob) throw new Error("photo");
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40) || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

export function YesNoGroup({ legend, name, error }: { legend: string; name: string; error?: string }) {
  return <ChoiceGroup legend={legend} name={name} options={yesNo} error={error} />;
}

export function CheckDate({ smoke = false, defaultDate = "" }: { smoke?: boolean; defaultDate?: string }) {
  const [date, setDate] = useState(defaultDate);
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

type MoreShot = { id: string; url: string; file: File; caption: string };

export function MorePhotos({ error }: { error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<MoreShot[]>([]);

  function writeFiles(next: MoreShot[]) {
    const transfer = new DataTransfer();
    for (const shot of next) transfer.items.add(shot.file);
    if (inputRef.current) inputRef.current.files = transfer.files;
    setShots(next);
  }

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const restore = (event: Event) => {
      const files = Array.from(input.files ?? []);
      const captions = (event as CustomEvent<{ captions?: string[] }>).detail?.captions ?? [];
      setShots(
        files.map((file, index) => ({
          id: crypto.randomUUID(),
          url: URL.createObjectURL(file),
          file,
          caption: captions[index] ?? "",
        })),
      );
    };
    input.addEventListener("oro-files", restore);
    return () => input.removeEventListener("oro-files", restore);
  }, []);

  async function addPhotos(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next = [...shots];
    for (const file of Array.from(list)) {
      if (next.length >= 8) break;
      try {
        const compressed = await compressItemPhoto(file);
        next.push({ id: crypto.randomUUID(), url: URL.createObjectURL(compressed), file: compressed, caption: "" });
      } catch {
        // A file the browser cannot read is skipped.
      }
    }
    writeFiles(next);
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-800">More photos (optional)</p>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        name="morePhotos"
        accept="image/*"
        multiple
        onChange={(event) => {
          void addPhotos(event.target.files);
          event.target.value = "";
        }}
      />
      <button type="button" className="mt-2 min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700" onClick={() => inputRef.current?.click()}>
        Add photo
      </button>
      {shots.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {shots.map((shot, index) => (
            <li key={shot.id} className="flex items-center gap-3">
              {/* Blob previews are created in the browser, so next/image cannot optimise them. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              <input
                name={`moreCaption.${index}`}
                value={shot.caption}
                maxLength={80}
                placeholder="Caption (optional)"
                aria-label={`Caption for photo ${index + 1}`}
                className={fieldClass}
                onChange={(event) => setShots((current) => current.map((item) => (item.id === shot.id ? { ...item, caption: event.target.value } : item)))}
              />
              <button
                type="button"
                className="min-h-11 shrink-0 text-sm font-semibold text-slate-600"
                onClick={() => writeFiles(shots.filter((item) => item.id !== shot.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-1 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}

export function SignaturePad({ error, name = "signature" }: { error?: string; name?: string }) {
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
      <input ref={inputRef} type="hidden" name={name} />
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
          <label
            key={value}
            className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border bg-white px-2 text-center text-sm font-semibold text-slate-700 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
              value === "emoro"
                ? "border-slate-300 has-[:checked]:border-brand-orange has-[:checked]:text-brand-orange has-[:focus-visible]:outline-brand-orange"
                : "border-slate-300 has-[:checked]:border-brand-blue has-[:checked]:text-brand-blue has-[:focus-visible]:outline-brand-blue"
            }`}
          >
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
