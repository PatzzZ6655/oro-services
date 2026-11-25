"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobs } from "@/components/jobs/api";
import { JobsButton, Spinner, fieldClass } from "@/components/jobs/ui";
import type { ParsedNote } from "@/lib/jobs-app/job-notes";
import { noteGroupLabel, noteGroups, noteJobLabel, noteJobSections, type NoteGroup, type NoteJob } from "@/lib/jobs-app/note-groups";

const draftKey = "oro.jobs.note.draft";

type Listed = { ok: true; today: string; jobs: NoteJob[] };
type ParsedResponse = { ok: true; parsed: ParsedNote; suggestion: NoteJob | null };

function emptyParsed(): ParsedNote {
  return { materials: [], tools: [], notes: [], todos: [] };
}

type Heard = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

export function NoteScreen() {
  const router = useRouter();
  const box = useRef<HTMLTextAreaElement>(null);
  const heardRef = useRef<Heard | null>(null);
  const draftReady = useRef(false);
  const [jobs, setJobs] = useState<NoteJob[] | null>(null);
  const [today, setToday] = useState("");
  const [group, setGroup] = useState<NoteGroup>("progress");
  const [jobId, setJobId] = useState("");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<ParsedNote | null>(null);
  const [suggestion, setSuggestion] = useState<NoteJob | null>(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    box.current?.focus();
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      try {
        const draft = JSON.parse(raw) as { text?: string; group?: NoteGroup; jobId?: string };
        if (draft.text) setText(draft.text);
        if (draft.group && noteGroups.includes(draft.group)) setGroup(draft.group);
        if (draft.jobId) setJobId(draft.jobId);
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
    postJobs<Listed>("/jobs/api/notes/jobs", {})
      .then((data) => {
        setJobs(data.jobs);
        setToday(data.today);
      })
      .catch((reason: unknown) => {
        if (reason instanceof JobsClientError && reason.status === 401) {
          router.push("/jobs/login");
          return;
        }
        setError(reason instanceof JobsClientError ? reason.message : "The job list could not be loaded.");
        setJobs([]);
      });
  }, [router]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
    };
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    let startY = 0;
    const onStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
    };
    const onMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0;
      if (y <= startY + 8) return;
      let node = event.target instanceof Element ? event.target : null;
      while (node) {
        if (node instanceof HTMLElement && node.scrollTop > 0) return;
        node = node.parentElement;
      }
      if (event.cancelable) event.preventDefault();
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
    };
  }, []);

  useEffect(() => {
    if (!draftReady.current) {
      draftReady.current = true;
      return;
    }
    if (!text.trim()) {
      localStorage.removeItem(draftKey);
      return;
    }
    localStorage.setItem(draftKey, JSON.stringify({ text, group, jobId }));
  }, [text, group, jobId]);

  const sections = jobs ? noteJobSections(jobs, group, today) : [];
  const choices = sections.flatMap((section) => section.jobs);
  const chosen = choices.find((job) => job.jobId === jobId) ?? null;

  function dictate() {
    const speech = (window as unknown as { webkitSpeechRecognition?: new () => Heard }).webkitSpeechRecognition;
    if (!speech) {
      box.current?.focus();
      return;
    }
    const heard = new speech();
    heard.lang = "zh-CN";
    const prior = text.trim();
    let spoken = prior;
    heard.onresult = (event) => {
      const heardText = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!heardText) return;
      spoken = [prior, heardText].filter(Boolean).join(" ");
      setText(spoken);
    };
    heard.onend = () => {
      setListening(false);
      if (heardRef.current !== heard) return;
      if (spoken.trim()) void submit(spoken);
    };
    heardRef.current = heard;
    setListening(true);
    heard.start();
  }

  function reenter() {
    const heard = heardRef.current;
    heardRef.current = null;
    if (heard) {
      heard.onresult = null;
      heard.onend = null;
      try {
        heard.abort();
      } catch {
        // Recognition already finished.
      }
    }
    setListening(false);
    setText("");
    setParsed(null);
    setSuggestion(null);
    setError("");
    setSaved("");
    localStorage.removeItem(draftKey);
    box.current?.focus();
  }

  async function keep(next: ParsedNote, review: boolean, id: string) {
    setBusy("Saving");
    setError("");
    try {
      await postJobs("/jobs/api/notes", { text, jobId: id, parsed: next, needsReview: review, draft: false });
      setSaved("Saved.");
      setParsed(null);
      setText("");
      localStorage.removeItem(draftKey);
    } catch (reason) {
      setError(reason instanceof JobsClientError ? reason.message : "The note could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function submit(spokenRaw?: string) {
    const spoken = (spokenRaw ?? text).trim();
    if (!spoken || busy) return;
    setBusy("Reading");
    setError("");
    setSaved("");
    try {
      await postJobs("/jobs/api/notes", {
        text: spoken,
        jobId: group === "chore" ? "" : jobId,
        parsed: { notes: [spoken.slice(0, 200)] },
        draft: true,
        needsReview: false,
      }).catch(() => undefined);
      const result = await postJobs<ParsedResponse>("/jobs/api/notes/parse", {
        text: spoken,
        group,
        jobId: group === "chore" ? "" : jobId,
        jobs: jobs ?? [],
      });
      setParsed(result.parsed.materials.length + result.parsed.tools.length + result.parsed.notes.length + result.parsed.todos.length > 0 ? result.parsed : { ...emptyParsed(), notes: [spoken.slice(0, 200)] });
      setSuggestion(jobId || group === "chore" ? null : result.suggestion);
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      setParsed({ ...emptyParsed(), notes: [spoken.slice(0, 200)] });
    } finally {
      setBusy("");
    }
  }

  function leave() {
    setParsed(null);
    setSuggestion(null);
    setSaved("Kept as a draft.");
  }

  if (!jobs) return <Spinner label="Opening" />;

  return (
    <div data-note-scroll="page" className="fixed inset-0 overflow-y-auto overscroll-none bg-white text-black">
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="text-center text-xl font-semibold">随手记</h1>
      <div className="grid grid-cols-2 gap-2">
        {noteGroups.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setGroup(item);
              setJobId("");
            }}
            className={`min-h-12 rounded-2xl border border-black px-2 text-sm font-semibold ${group === item ? "bg-black text-white" : "bg-white"}`}
          >
            {noteGroupLabel(item)}
          </button>
        ))}
      </div>
      {group === "chore" ? (
        <p className="text-base">Not job-related.</p>
      ) : (
        <div data-note-jobs="list" className="h-[50vh] overflow-y-auto overscroll-y-contain rounded-2xl border border-black">
          {choices.length === 0 ? <p className="px-4 py-3 text-base">No jobs in this group.</p> : null}
          {sections.map((section) => (
            <div key={section.label || "jobs"}>
              {section.label ? <p className="sticky top-0 bg-white px-4 py-2 text-sm font-semibold">{section.label}</p> : null}
              {section.jobs.map((job) => {
                const selected = job.jobId === jobId;
                return (
                  <button
                    key={`${job.business}:${job.jobId}`}
                    type="button"
                    onClick={() => setJobId(job.jobId)}
                    className={`flex min-h-14 w-full items-center px-4 text-left text-base ${selected ? "bg-black text-white" : "bg-white"}`}
                  >
                    {noteJobLabel(job)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={box}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        placeholder="Dictate with the keyboard mic, or type."
        className={`${fieldClass} min-h-40 py-3`}
      />
      <div className="grid grid-cols-2 gap-2">
        <JobsButton type="button" variant="outline" onClick={dictate}>
          {listening ? "Listening" : "Mic"}
        </JobsButton>
        <JobsButton type="button" variant="outline" onClick={reenter}>
          重新输入
        </JobsButton>
      </div>
      <JobsButton type="button" onClick={() => void submit()} disabled={Boolean(busy) || !text.trim()}>
        {busy || "Save note"}
      </JobsButton>
      {error ? <p role="alert" className="text-base">{error}</p> : null}
      {saved ? <p className="text-base">{saved}</p> : null}
      {parsed ? (
        <section className="rounded-2xl border border-black p-3">
          <p className="text-base font-semibold">{chosen ? noteJobLabel(chosen) : group === "chore" ? "Not job-related" : "No job picked"}</p>
          {suggestion ? (
            <button type="button" className="mt-2 min-h-11 text-left text-base underline" onClick={() => setJobId(suggestion.jobId)}>
              Use {noteJobLabel(suggestion)}
            </button>
          ) : null}
          {parsed.materials.length > 0 ? <p className="mt-3 text-sm font-semibold">Materials</p> : null}
          {parsed.materials.map((item, index) => (
            <label key={`material-${index}`} className="mt-2 flex items-center gap-2">
              <input
                value={item.item}
                onChange={(event) => {
                  const next = [...parsed.materials];
                  next[index] = { ...item, item: event.target.value };
                  setParsed({ ...parsed, materials: next });
                }}
                className={fieldClass}
              />
              {item.costAud != null ? <span className="shrink-0 text-sm">${item.costAud.toFixed(2)}{item.store ? ` · ${item.store}` : ""}</span> : null}
              <button type="button" className="min-h-11 text-sm underline" onClick={() => setParsed({ ...parsed, materials: parsed.materials.filter((_, itemIndex) => itemIndex !== index) })}>
                Delete
              </button>
            </label>
          ))}
          {parsed.tools.length > 0 ? <p className="mt-3 text-sm font-semibold">Tools</p> : null}
          {parsed.tools.map((item, index) => (
            <label key={`tool-${index}`} className="mt-2 flex items-center gap-2">
              <input
                value={item}
                onChange={(event) => {
                  const next = [...parsed.tools];
                  next[index] = event.target.value;
                  setParsed({ ...parsed, tools: next });
                }}
                className={fieldClass}
              />
              <button type="button" className="min-h-11 text-sm underline" onClick={() => setParsed({ ...parsed, tools: parsed.tools.filter((_, itemIndex) => itemIndex !== index) })}>
                Delete
              </button>
            </label>
          ))}
          {parsed.notes.length > 0 ? <p className="mt-3 text-sm font-semibold">Notes</p> : null}
          {parsed.notes.map((item, index) => (
            <label key={`note-${index}`} className="mt-2 flex items-center gap-2">
              <input
                value={item}
                onChange={(event) => {
                  const next = [...parsed.notes];
                  next[index] = event.target.value;
                  setParsed({ ...parsed, notes: next });
                }}
                className={fieldClass}
              />
              <button type="button" className="min-h-11 text-sm underline" onClick={() => setParsed({ ...parsed, notes: parsed.notes.filter((_, itemIndex) => itemIndex !== index) })}>
                Delete
              </button>
            </label>
          ))}
          {parsed.todos.length > 0 ? <p className="mt-3 text-sm font-semibold">To-dos</p> : null}
          {parsed.todos.map((item, index) => (
            <label key={`todo-${index}`} className="mt-2 flex items-center gap-2">
              <input
                value={item.text}
                onChange={(event) => {
                  const next = [...parsed.todos];
                  next[index] = { ...item, text: event.target.value };
                  setParsed({ ...parsed, todos: next });
                }}
                className={fieldClass}
              />
              {item.due ? <span className="shrink-0 text-sm">{item.due}</span> : null}
              <button type="button" className="min-h-11 text-sm underline" onClick={() => setParsed({ ...parsed, todos: parsed.todos.filter((_, itemIndex) => itemIndex !== index) })}>
                Delete
              </button>
            </label>
          ))}
          <div className="mt-3 flex flex-col gap-2">
            <JobsButton type="button" onClick={() => void keep(parsed, Boolean(suggestion && suggestion.jobId === jobId), group === "chore" ? "" : jobId)} disabled={Boolean(busy)}>
              Save
            </JobsButton>
            <JobsButton type="button" variant="outline" onClick={leave}>
              Leave it
            </JobsButton>
          </div>
        </section>
      ) : null}
    </main>
    </div>
  );
}
