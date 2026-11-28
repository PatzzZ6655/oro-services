"use client";

import { useEffect, useRef, useState } from "react";
import { JobsButton } from "@/components/jobs/ui";
import { addPhotos } from "@/lib/jobs-app/photos";

export function PhotoBurst({
  files,
  onChange,
  max,
  doneLabel,
  onDone,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  doneLabel?: string;
  onDone?: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const full = max !== undefined && files.length >= max;

  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    setUrls(next);
    return () => {
      for (const url of next) URL.revokeObjectURL(url);
    };
  }, [files]);

  function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    onChange(addPhotos(files, list, max));
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          add(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      {urls.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {urls.map((url, index) => (
            <li key={url} className="relative">
              {/* Blob previews are created in the browser, so next/image cannot optimise them. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => onChange(files.filter((_, item) => item !== index))}
                className="absolute right-1 top-1 min-h-11 rounded-lg bg-white px-2 text-sm font-semibold"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <JobsButton type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled || full}>
        {files.length > 0 ? "Take another" : "Take photo"}
      </JobsButton>
      {max !== undefined ? (
        <p className="text-base">{files.length > 0 ? `${files.length} selected, ${max} at most` : `Up to ${max} photos`}</p>
      ) : (
        <p className="text-base">{files.length > 0 ? `${files.length} selected` : "Photos are optional."}</p>
      )}
      {onDone && files.length > 0 ? (
        <JobsButton type="button" onClick={onDone} disabled={disabled || files.length === 0}>
          {doneLabel ?? "Done"}
        </JobsButton>
      ) : null}
    </div>
  );
}
