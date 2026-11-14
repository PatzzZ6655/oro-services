import { addCalendarDays, isRealCalendarDate } from "@/lib/appointments";
import { itemPhotoField, itemPhotoMax, type CompanyId, type FieldErrors } from "@/lib/reports/catalog";
import { dateError } from "@/lib/reports/dates";
import { parseSignature } from "@/lib/reports/validate";

export const safetyKinds = [
  "swms",
  "take-5",
  "confined-space",
  "hot-work",
  "heights",
  "induction",
  "toolbox",
  "incident",
  "hazard",
  "plant-prestart",
] as const;

export type SafetyKind = (typeof safetyKinds)[number];

export function isSafetyKind(value: string): value is SafetyKind {
  return (safetyKinds as readonly string[]).includes(value);
}

export const safetyCards: { kind: SafetyKind; title: string; summary: string; folder: string; footer: string }[] = [
  {
    kind: "swms",
    title: "SWMS",
    summary: "Safe work method statement for high risk construction work.",
    folder: "SWMS",
    footer: "OHS Regulations 2017, r.322 and r.327. OHS Act 2004.",
  },
  {
    kind: "take-5",
    title: "Take 5",
    summary: "Short pre-start check before the task.",
    folder: "Take 5",
    footer: "OHS Act 2004, s.21.",
  },
  {
    kind: "confined-space",
    title: "Confined space entry permit",
    summary: "Permit, air tests, standby person, and entry log.",
    folder: "Confined Space Entry Permit",
    footer: "OHS Regulations 2017, Part 3.4.",
  },
  {
    kind: "hot-work",
    title: "Hot work permit",
    summary: "Permit for work that can start a fire.",
    folder: "Hot Work Permit",
    footer: "OHS Act 2004, s.21. OHS Regulations 2017, r.322.",
  },
  {
    kind: "heights",
    title: "Working at heights",
    summary: "Ladder, scaffold, roof, harness, and anchor check.",
    folder: "Working at Heights",
    footer: "OHS Regulations 2017, Part 3.3.",
  },
  {
    kind: "induction",
    title: "Site induction",
    summary: "Worker details, white card, and site rules.",
    folder: "Site Induction",
    footer: "OHS Regulations 2017, r.330.",
  },
  {
    kind: "toolbox",
    title: "Toolbox talk",
    summary: "Topic, notes, and who attended.",
    folder: "Toolbox Talk",
    footer: "OHS Act 2004, s.35.",
  },
  {
    kind: "incident",
    title: "Incident / near miss",
    summary: "What happened, and whether the site must be left as it is.",
    folder: "Incident Near Miss",
    footer: "OHS Act 2004, s.38. The employer notifies WorkSafe Victoria. This form does not.",
  },
  {
    kind: "hazard",
    title: "Hazard report",
    summary: "Hazard, risk, action, and close-out.",
    folder: "Hazard Report",
    footer: "OHS Act 2004, s.21 and s.22.",
  },
  {
    kind: "plant-prestart",
    title: "Plant pre-start",
    summary: "Ladder, scaffold, tool, and test-and-tag check.",
    folder: "Plant Pre-start",
    footer: "OHS Regulations 2017, Part 3.5.",
  },
];

export function safetyCard(kind: SafetyKind) {
  const card = safetyCards.find((item) => item.kind === kind);
  if (!card) throw new Error("unknown safety form");
  return card;
}

export const hrcwItems = [
  { id: "fall", label: "A person could fall more than 2 metres" },
  { id: "tower", label: "Work on a telecommunication tower" },
  { id: "demolition", label: "Demolition of a load-bearing part of a structure" },
  { id: "asbestos", label: "Likely to disturb asbestos" },
  { id: "support", label: "Temporary support needed to prevent collapse" },
  { id: "confined", label: "Work in or near a confined space" },
  { id: "trench", label: "Shaft or trench deeper than 1.5 metres, or a tunnel" },
  { id: "explosives", label: "Use of explosives" },
  { id: "gas", label: "Work on or near pressurised gas mains or piping" },
  { id: "chemical", label: "Work on or near chemical, fuel or refrigerant lines" },
  { id: "electrical", label: "Work on or near energised electrical installations" },
  { id: "atmosphere", label: "Area that may have a contaminated or flammable atmosphere" },
  { id: "concrete", label: "Tilt-up or precast concrete" },
  { id: "traffic", label: "Work on or next to a road, railway or traffic corridor in use" },
  { id: "plant", label: "Movement of powered mobile plant" },
  { id: "temperature", label: "Artificial extremes of temperature" },
  { id: "water", label: "Water or other liquid with a risk of drowning" },
  { id: "diving", label: "Diving" },
] as const;

export const swmsPresets: Record<string, { step: string; hazard: string; control: string }[]> = {
  roof: [
    { step: "Set up access and keep people clear below", hazard: "Fall. Falling objects.", control: "Edge protection or harness and anchor. Exclusion zone below." },
    { step: "Work on the roof", hazard: "Fragile surface. Weather.", control: "Use crawl boards. Stop if the surface is wet or the wind is strong." },
    { step: "Climb down and pack up", hazard: "Fall from the ladder.", control: "Three points of contact. Foot the ladder or tie it off." },
  ],
  confined: [
    { step: "Isolate and ventilate before entry", hazard: "Atmosphere. Stored energy.", control: "Lock out sources. Test the air. Forced ventilation if needed." },
    { step: "Enter with a standby person", hazard: "Collapse. Rescue delay.", control: "Standby stays outside. Communication and rescue gear ready." },
    { step: "Leave and close the space", hazard: "Someone re-enters.", control: "Log the exit. Sign the permit off. Secure the opening." },
  ],
  trench: [
    { step: "Check the ground and services", hazard: "Collapse. Strike a service.", control: "Shoring or benching. Service location before digging." },
    { step: "Work in the trench", hazard: "Fall of material. Water.", control: "Keep spoil back from the edge. Means of exit within reach." },
    { step: "Backfill", hazard: "Plant movement.", control: "Spotter. People out of the trench before the machine moves in." },
  ],
  electrical: [
    { step: "Confirm isolation or the live approach", hazard: "Electric shock. Arc.", control: "Isolate and test dead, or follow the live-work controls. Barriers." },
    { step: "Do the task", hazard: "Contact with live parts.", control: "Insulated tools. Dry conditions. Second person if required." },
    { step: "Restore and test", hazard: "Re-energising onto a fault.", control: "Remove tools. Test before leaving the area live." },
  ],
};

export const heightChecks = [
  { id: "ladder-condition", label: "Ladder is sound, with feet and rungs intact" },
  { id: "ladder-setup", label: "Ladder angle and footing are stable" },
  { id: "scaffold-tag", label: "Scaffold tag is current, or scaffold is not in use" },
  { id: "scaffold-access", label: "Scaffold access and platforms are clear" },
  { id: "roof-edge", label: "Roof edge protection or a travel-restraint system is in place" },
  { id: "harness", label: "Harness, lanyard and fittings were inspected today" },
  { id: "anchor", label: "Anchor point is suitable and was inspected" },
] as const;

export const plantChecks = [
  { id: "guards", label: "Guards are in place" },
  { id: "leads", label: "Leads and plugs are undamaged" },
  { id: "tag", label: "Test-and-tag is current, or the item is not electrical" },
  { id: "ladder", label: "Ladders on this job were checked" },
  { id: "scaffold", label: "Scaffold in use is tagged, or none is in use" },
] as const;

export const take5Checks = [
  { id: "task", label: "I understand the task" },
  { id: "people", label: "People nearby are clear of the work" },
  { id: "equipment", label: "Tools and plant are right for the task" },
  { id: "environment", label: "The area is safe to start" },
  { id: "stop", label: "I will stop if something changes" },
] as const;

export type StepRow = { step: string; hazard: string; control: string };
export type PersonSign = { name: string; date: string; signature: Uint8Array };
export type LogRow = { name: string; timeIn: string; timeOut: string };
export type AirRow = { time: string; oxygen: string; lel: string; co: string; result: string };
export type Tick = { id: string; label: string; on: boolean };
export type CheckRow = { id: string; label: string; result: "pass" | "fail" | "na" | "yes" | "no"; comment?: string };

export type SafetyDocument = {
  kind: SafetyKind;
  company: CompanyId;
  date: string;
  address: string;
  title: string;
  footer: string;
  fields: { label: string; value: string }[];
  ticks?: Tick[];
  steps?: StepRow[];
  checks?: { title: string; rows: CheckRow[]; photoGroup?: string }[];
  air?: AirRow[];
  log?: LogRow[];
  signs: PersonSign[];
  signLabel: string;
  note?: string;
};

function oneLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function block(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function companyOf(value: string): CompanyId | null {
  return value === "emoro" || value === "emporo" ? value : null;
}

function requireText(errors: FieldErrors, key: string, value: string, min: number, max: number, message: string) {
  if (value.length < min) errors[key] = message;
  else if (value.length > max) errors[key] = `Use ${max} characters or fewer.`;
}

function fileCount(formData: FormData, key: string): number {
  return formData.getAll(key).filter((item) => item instanceof File && item.size > 0).length;
}

function readSigns(formData: FormData, errors: FieldErrors, prefix: string, min: number): PersonSign[] {
  const signs: PersonSign[] = [];
  for (let index = 0; index < 12; index += 1) {
    const name = oneLine(read(formData, `${prefix}.${index}.name`));
    const date = oneLine(read(formData, `${prefix}.${index}.date`));
    const signature = read(formData, `${prefix}.${index}.signature`);
    if (!name && !date && !signature) continue;
    if (name.length < 2) errors[`${prefix}.${index}.name`] = "Enter the name.";
    if (dateError(date)) errors[`${prefix}.${index}.date`] = "Enter the date.";
    const parsed = parseSignature(signature);
    if (!parsed.ok) errors[`${prefix}.${index}.signature`] = "Add a signature.";
    if (!errors[`${prefix}.${index}.name`] && !errors[`${prefix}.${index}.date`] && parsed.ok) {
      signs.push({ name, date, signature: parsed.bytes });
    }
  }
  if (signs.length < min && !Object.keys(errors).some((key) => key.startsWith(`${prefix}.`))) {
    errors[prefix] = min === 1 ? "Add one signature." : "Add the people who signed on.";
  }
  return signs;
}

function readPassChecks(
  formData: FormData,
  errors: FieldErrors,
  group: string,
  items: readonly { id: string; label: string }[],
): CheckRow[] {
  const rows: CheckRow[] = [];
  for (const item of items) {
    const key = `${group}.${item.id}`;
    const result = oneLine(read(formData, key));
    const comment = block(read(formData, `${key}.comment`));
    if (result !== "pass" && result !== "fail" && result !== "na") {
      errors[key] = "Choose a result.";
      continue;
    }
    if (result === "fail" && comment.length < 3) errors[`${key}.comment`] = "Add a comment for this fail.";
    const photos = fileCount(formData, itemPhotoField(key));
    if (photos > itemPhotoMax) errors[`${key}.photos`] = "Use up to 4 photos.";
    if (result === "fail" && photos === 0) errors[`${key}.photos`] = "Add a photo for this fail.";
    if (!errors[key] && !errors[`${key}.comment`] && !errors[`${key}.photos`]) {
      rows.push({ id: item.id, label: item.label, result, comment: comment || undefined });
    }
  }
  return rows;
}

export function validateSafety(kind: string, formData: FormData, now = new Date()): { ok: true; value: SafetyDocument } | { ok: false; errors: FieldErrors } {
  if (!isSafetyKind(kind)) return { ok: false, errors: { kind: "Choose a form." } };
  const errors: FieldErrors = {};
  const company = companyOf(oneLine(read(formData, "company")));
  const date = oneLine(read(formData, "date"));
  const address = oneLine(read(formData, "address"));
  if (!company) errors.company = "Choose Emoro Building or Emporo Plumbing.";
  const dateProblem = dateError(date, now);
  if (dateProblem) errors.date = dateProblem;
  requireText(errors, "address", address, 5, 200, "Enter the site address.");
  const card = safetyCard(kind);
  const base = { kind, company: company ?? "emoro", date, address, title: card.title, footer: card.footer };

  if (kind === "swms") {
    const jobNumber = oneLine(read(formData, "jobNumber"));
    const work = block(read(formData, "work"));
    const emergency = block(read(formData, "emergency"));
    const review = oneLine(read(formData, "review"));
    requireText(errors, "jobNumber", jobNumber, 1, 40, "Enter the job number.");
    requireText(errors, "work", work, 3, 2000, "Describe the work.");
    requireText(errors, "emergency", emergency, 3, 1000, "Add the emergency plan.");
    const ticks = hrcwItems.map((item) => ({ id: item.id, label: item.label, on: oneLine(read(formData, `hrcw.${item.id}`)) === "yes" }));
    if (!ticks.some((item) => item.on)) errors.hrcw = "Tick the high risk construction work that applies.";
    const steps: StepRow[] = [];
    for (let index = 0; index < 12; index += 1) {
      const step = oneLine(read(formData, `step.${index}.step`));
      const hazard = oneLine(read(formData, `step.${index}.hazard`));
      const control = oneLine(read(formData, `step.${index}.control`));
      if (!step && !hazard && !control) continue;
      if (step.length < 2 || hazard.length < 2 || control.length < 2) errors[`step.${index}`] = "Add the step, the hazard, and the control.";
      else steps.push({ step, hazard, control });
    }
    if (steps.length === 0 && !Object.keys(errors).some((key) => key.startsWith("step."))) errors.steps = "Add at least one job step.";
    const signs = readSigns(formData, errors, "worker", 1);
    if (Object.keys(errors).length || !company) return { ok: false, errors };
    return {
      ok: true,
      value: {
        ...base,
        company,
        fields: [
          { label: "Job / invoice", value: jobNumber },
          { label: "Work", value: work },
          { label: "Emergency", value: emergency },
          { label: "Review", value: review || "Not recorded" },
        ],
        ticks,
        steps,
        signs,
        signLabel: "Workers signed on",
      },
    };
  }

  if (kind === "take-5") {
    const task = oneLine(read(formData, "task"));
    requireText(errors, "task", task, 3, 200, "Name the task.");
    const rows: CheckRow[] = [];
    for (const item of take5Checks) {
      const answer = oneLine(read(formData, `take.${item.id}`));
      if (answer !== "yes" && answer !== "no") errors[`take.${item.id}`] = "Choose yes or no.";
      else rows.push({ id: item.id, label: item.label, result: answer });
    }
    const notes = block(read(formData, "notes"));
    const signs = readSigns(formData, errors, "worker", 1);
    if (Object.keys(errors).length || !company) return { ok: false, errors };
    return { ok: true, value: { ...base, company, fields: [{ label: "Task", value: task }, { label: "Notes", value: notes || "None" }], checks: [{ title: "Pre-start", rows }], signs, signLabel: "Signed" } };
  }

  if (kind === "confined-space") {
    const location = oneLine(read(formData, "location"));
    const standby = oneLine(read(formData, "standby"));
    const rescue = block(read(formData, "rescue"));
    const isolation = oneLine(read(formData, "isolation"));
    requireText(errors, "location", location, 2, 120, "Name the space.");
    requireText(errors, "standby", standby, 2, 80, "Name the standby person.");
    requireText(errors, "rescue", rescue, 3, 1000, "Add the rescue plan.");
    if (isolation !== "yes" && isolation !== "no") errors.isolation = "Say whether the space is isolated.";
    const air: AirRow[] = [];
    for (let index = 0; index < 6; index += 1) {
      const time = oneLine(read(formData, `air.${index}.time`));
      const oxygen = oneLine(read(formData, `air.${index}.oxygen`));
      const lel = oneLine(read(formData, `air.${index}.lel`));
      const co = oneLine(read(formData, `air.${index}.co`));
      const result = oneLine(read(formData, `air.${index}.result`));
      if (!time && !oxygen && !lel && !co && !result) continue;
      if (!time || !oxygen || !result) errors[`air.${index}`] = "Add the time, oxygen, and result.";
      else air.push({ time, oxygen, lel: lel || "—", co: co || "—", result });
    }
    if (air.length === 0 && !Object.keys(errors).some((key) => key.startsWith("air."))) errors.air = "Add one atmospheric test.";
    const log: LogRow[] = [];
    for (let index = 0; index < 8; index += 1) {
      const name = oneLine(read(formData, `log.${index}.name`));
      const timeIn = oneLine(read(formData, `log.${index}.in`));
      const timeOut = oneLine(read(formData, `log.${index}.out`));
      if (!name && !timeIn && !timeOut) continue;
      if (name.length < 2 || !timeIn) errors[`log.${index}`] = "Add the name and time in.";
      else log.push({ name, timeIn, timeOut: timeOut || "Still in" });
    }
    const closed = oneLine(read(formData, "closed"));
    if (closed !== "yes" && closed !== "no") errors.closed = "Say whether the permit is closed.";
    const signs = readSigns(formData, errors, "worker", 1);
    if (Object.keys(errors).length || !company) return { ok: false, errors };
    return {
      ok: true,
      value: {
        ...base,
        company,
        fields: [
          { label: "Space", value: location },
          { label: "Standby", value: standby },
          { label: "Isolation", value: isolation === "yes" ? "Yes" : "No" },
          { label: "Rescue", value: rescue },
          { label: "Closed", value: closed === "yes" ? "Yes" : "No" },
        ],
        air,
        log,
        signs,
        signLabel: "Permit signed",
      },
    };
  }

  if (kind === "hot-work") {
    const work = block(read(formData, "work"));
    const watch = oneLine(read(formData, "watch"));
    const extinguisher = oneLine(read(formData, "extinguisher"));
    const duration = oneLine(read(formData, "duration"));
    requireText(errors, "work", work, 3, 1000, "Describe the hot work.");
    requireText(errors, "watch", watch, 2, 80, "Name the fire watch.");
    if (extinguisher !== "yes") errors.extinguisher = "An extinguisher needs to be at the work.";
    requireText(errors, "duration", duration, 1, 40, "Enter how long the permit covers.");
    const signs = readSigns(formData, errors, "worker", 1);
    if (Object.keys(errors).length || !company) return { ok: false, errors };
    return { ok: true, value: { ...base, company, fields: [{ label: "Work", value: work }, { label: "Fire watch", value: watch }, { label: "Extinguisher", value: "At the work" }, { label: "Duration", value: duration }], signs, signLabel: "Permit signed" } };
  }

  if (kind === "heights") {
    const rows = readPassChecks(formData, errors, "height", heightChecks);
    const signs = readSigns(formData, errors, "worker", 1);
    if (Object.keys(errors).length || !company) return { ok: false, errors };
    return { ok: true, value: { ...base, company, fields: [], checks: [{ title: "Checklist", rows, photoGroup: "height" }], signs, signLabel: "Checked by" } };
  }

  if (kind === "induction") {
    const worker = oneLine(read(formData, "worker"));
    const whiteCard = oneLine(read(formData, "whiteCard"));
    const licence = oneLine(read(formData, "licence"));
    const emergency = oneLine(read(formData, "emergency"));
    const rules = oneLine(read(formData, "rules"));
    requireText(errors, "worker", worker, 2, 80, "Enter the worker's name.");
    requireText(errors, "whiteCard", whiteCard, 2, 40, "Enter the construction induction card number.");
    requireText(errors, "emergency", emergency, 2, 120, "Enter the emergency contact.");
    if (rules !== "yes") errors.rules = "The site rules need to be acknowledged.";
    const signs = readSigns(formData, errors, "workerSign", 1);
    if (Object.keys(errors).length || !company) return { ok: false, errors };
    return { ok: true, value: { ...base, company, fields: [{ label: "Worker", value: worker }, { label: "White card", value: whiteCard }, { label: "Licence", value: licence || "Not recorded" }, { label: "Emergency", value: emergency }, { label: "Site rules", value: "Acknowledged" }], signs, signLabel: "Inducted worker" } };
  }

  if (kind === "toolbox") {
    const topic = oneLine(read(formData, "topic"));
    const notes = block(read(formData, "notes"));
    requireText(errors, "topic", topic, 2, 120, "Enter the topic.");
    requireText(errors, "notes", notes, 3, 2000, "Add the notes.");
    const signs = readSigns(formData, errors, "worker", 1);
    if (Object.keys(errors).length || !company) return { ok: false, errors };
    return { ok: true, value: { ...base, company, fields: [{ label: "Topic", value: topic }, { label: "Notes", value: notes }], signs, signLabel: "Attendees" } };
  }

  if (kind === "incident") {
    const time = oneLine(read(formData, "time"));
    const what = block(read(formData, "what"));
    const people = oneLine(read(formData, "people"));
    const kindOf = oneLine(read(formData, "kindOf"));
    const preserved = oneLine(read(formData, "preserved"));
    const actions = block(read(formData, "actions"));
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.time = "Enter the time.";
    requireText(errors, "what", what, 3, 2000, "Describe what happened.");
    if (kindOf !== "incident" && kindOf !== "near-miss") errors.kindOf = "Choose incident or near miss.";
    if (preserved !== "yes" && preserved !== "no") errors.preserved = "Say whether the site was left as it was.";
    const signs = readSigns(formData, errors, "worker", 1);
    if (Object.keys(errors).length || !company) return { ok: false, errors };
    return {
      ok: true,
      value: {
        ...base,
        company,
        fields: [
          { label: "Time", value: time },
          { label: "Type", value: kindOf === "incident" ? "Incident" : "Near miss" },
          { label: "People", value: people || "Not recorded" },
          { label: "What happened", value: what },
          { label: "Site left as it was", value: preserved === "yes" ? "Yes" : "No" },
          { label: "Actions", value: actions || "None recorded" },
        ],
        signs,
        signLabel: "Reported by",
        note: "If this is a notifiable incident under the OHS Act 2004, section 38, the employer must notify WorkSafe Victoria. The site of a notifiable incident must not be disturbed until an inspector arrives, unless it is necessary to protect a person's health or safety, or to help an injured person, or to make the site safe, or to prevent a further incident. This form does not send that notice.",
      },
    };
  }

  if (kind === "hazard") {
    const hazard = block(read(formData, "hazard"));
    const risk = oneLine(read(formData, "risk"));
    const action = block(read(formData, "action"));
    const close = oneLine(read(formData, "close"));
    requireText(errors, "hazard", hazard, 3, 1000, "Describe the hazard.");
    if (risk !== "low" && risk !== "medium" && risk !== "high") errors.risk = "Choose the risk.";
    requireText(errors, "action", action, 3, 1000, "Add the action.");
    if (close && !isRealCalendarDate(close)) errors.close = "Enter a close-out date, or leave it blank.";
    const signs = readSigns(formData, errors, "worker", 1);
    if (Object.keys(errors).length || !company) return { ok: false, errors };
    return { ok: true, value: { ...base, company, fields: [{ label: "Hazard", value: hazard }, { label: "Risk", value: risk }, { label: "Action", value: action }, { label: "Close-out", value: close || "Open" }], signs, signLabel: "Reported by" } };
  }

  const equipment = oneLine(read(formData, "equipment"));
  const asset = oneLine(read(formData, "asset"));
  requireText(errors, "equipment", equipment, 2, 80, "Name the plant or tools.");
  const rows = readPassChecks(formData, errors, "plant", plantChecks);
  const signs = readSigns(formData, errors, "worker", 1);
  if (Object.keys(errors).length || !company) return { ok: false, errors };
  return { ok: true, value: { ...base, company, fields: [{ label: "Equipment", value: equipment }, { label: "ID / serial", value: asset || "Not recorded" }], checks: [{ title: "Pre-start", rows, photoGroup: "plant" }], signs, signLabel: "Checked by" } };
}

export type LicenceRecord = {
  id: string;
  name: string;
  company: CompanyId;
  whiteCard: string;
  licence: string;
  expiry: string;
  created: string;
};

export function licenceStatus(expiry: string, today: string): "current" | "soon" | "expired" | "none" {
  if (!isRealCalendarDate(expiry)) return "none";
  if (expiry < today) return "expired";
  if (expiry <= addCalendarDays(today, 30)) return "soon";
  return "current";
}

export function latestLicences(records: LicenceRecord[]): LicenceRecord[] {
  const byName = new Map<string, LicenceRecord>();
  const sorted = [...records].sort((a, b) => a.created.localeCompare(b.created));
  for (const record of sorted) byName.set(record.name.toLowerCase(), record);
  return [...byName.values()].sort((a, b) => a.expiry.localeCompare(b.expiry));
}
