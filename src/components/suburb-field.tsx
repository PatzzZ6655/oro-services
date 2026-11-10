"use client";

import { useEffect, useId, useRef, useState } from "react";
import { loadPlacesLibrary, type PlacePrediction } from "@/lib/google-maps-loader";
import {
  mapsBrowserKey,
  melbourneOrigin,
  placesAutocompleteEnabled,
  suburbFieldMaxLength,
  victoriaBias,
} from "@/lib/places";

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

type Suggestion = {
  label: string;
  prediction: PlacePrediction;
};

export function SuburbField({ invalid, describedBy }: { invalid?: boolean; describedBy?: string }) {
  if (!placesAutocompleteEnabled) {
    return (
      <input
        id="suburb"
        name="suburb"
        type="text"
        autoComplete="address-level2"
        required
        maxLength={suburbFieldMaxLength}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={fieldClass}
      />
    );
  }

  return <SuburbAutocomplete invalid={invalid} describedBy={describedBy} />;
}

function SuburbAutocomplete({ invalid, describedBy }: { invalid?: boolean; describedBy?: string }) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionToken = useRef<object | null>(null);
  const requestId = useRef(0);
  const suppressQuery = useRef(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  async function fetchSuggestions(input: string, current: number) {
    try {
      const places = await loadPlacesLibrary(mapsBrowserKey);
      sessionToken.current ??= new places.AutocompleteSessionToken();
      const { suggestions: next } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionToken.current,
        includedRegionCodes: ["au"],
        region: "au",
        language: "en-AU",
        locationBias: victoriaBias,
        origin: melbourneOrigin,
      });
      if (current !== requestId.current) return;
      const items = next.flatMap((item) => {
        const prediction = item.placePrediction;
        if (!prediction) return [];
        const label = prediction.text.toString().trim();
        return label ? [{ label, prediction }] : [];
      });
      setSuggestions(items);
      setOpen(items.length > 0);
      setActiveIndex(items.length > 0 ? 0 : -1);
    } catch {
      if (current !== requestId.current) return;
      setSuggestions([]);
      setOpen(false);
    }
  }

  useEffect(() => {
    if (suppressQuery.current) {
      suppressQuery.current = false;
      return;
    }

    const input = query.trim();
    if (input.length < 2) return;

    const current = ++requestId.current;
    const timer = window.setTimeout(() => {
      void fetchSuggestions(input, current);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function applyAddress(address: string) {
    const field = inputRef.current;
    if (field) field.value = address;
    suppressQuery.current = true;
    setQuery(address);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  async function choose(suggestion: Suggestion) {
    setOpen(false);
    try {
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress"] });
      applyAddress(place.formattedAddress?.trim() || suggestion.label);
    } catch {
      applyAddress(suggestion.label);
    }
    try {
      const places = await loadPlacesLibrary(mapsBrowserKey);
      sessionToken.current = new places.AutocompleteSessionToken();
    } catch {
      sessionToken.current = null;
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void choose(suggestions[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const expanded = open && suggestions.length > 0;
  const activeId = activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id="suburb"
        name="suburb"
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        required
        maxLength={suburbFieldMaxLength}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? activeId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={fieldClass}
        onFocus={() => {
          void loadPlacesLibrary(mapsBrowserKey).catch(() => {
            // The field stays a normal text input if Maps cannot load.
          });
        }}
        onInput={(event) => {
          const next = event.currentTarget.value;
          setQuery(next);
          if (next.trim().length < 2) {
            requestId.current += 1;
            setSuggestions([]);
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
        onKeyDown={onKeyDown}
      />
      <p className="sr-only" aria-live="polite">
        {expanded ? `${suggestions.length} address suggestions` : ""}
      </p>
      {expanded ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {suggestions.map((suggestion, index) => {
            const selected = index === activeIndex;
            return (
              <li key={`${suggestion.label}-${index}`} role="presentation">
                <button
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`block min-h-11 w-full px-4 py-3 text-left text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-navy ${
                    selected ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void choose(suggestion)}
                >
                  {suggestion.label}
                </button>
              </li>
            );
          })}
          <li className="border-t border-slate-100 px-4 py-2 text-right text-xs text-slate-500" aria-hidden="true">
            Powered by Google
          </li>
        </ul>
      ) : null}
    </div>
  );
}
