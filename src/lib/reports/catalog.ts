export const reportKinds = ["site-job-sheet", "job-sign-off", "gas-safety", "electrical-safety"] as const;

export type ReportKind = (typeof reportKinds)[number];

export type CompanyId = "emoro" | "emporo";

export type CheckResult = "pass" | "fail" | "na";

export type YesNo = "yes" | "no";

export type OverallResult = "compliant" | "non-compliant";

export type ExtentStatus = "included" | "excluded" | "na";

export type NamedItem = { id: string; label: string };

export const companies = {
  emoro: {
    id: "emoro" as const,
    name: "Emoro Building",
    legalName: "Emoro Building Pty Ltd",
    email: "info.emoro@orosvc.com",
    logo: "/logos/emoro-building.png",
    logoWidth: 923,
    logoHeight: 295,
    accent: "orange" as const,
  },
  emporo: {
    id: "emporo" as const,
    name: "Emporo Plumbing",
    legalName: "Emporo Plumbing Pty Ltd",
    email: "info.emporo@orosvc.com",
    logo: "/logos/emporo-plumbing.png",
    logoWidth: 734,
    logoHeight: 194,
    accent: "blue" as const,
  },
};

export type CompanyProfile = (typeof companies)[CompanyId];

export const reportCards: { kind: ReportKind; title: string; summary: string; folder: string }[] = [
  {
    kind: "site-job-sheet",
    title: "Site job sheet",
    summary: "Hours, work done, and the safety checks for that company.",
    folder: "Site Job Sheet",
  },
  {
    kind: "job-sign-off",
    title: "Job completion sign-off",
    summary: "Client confirmation that the job is finished.",
    folder: "Job Completion Sign-off",
  },
  {
    kind: "gas-safety",
    title: "Gas safety check",
    summary: "Victorian rental gas check for Emporo Plumbing.",
    folder: "Gas Safety Check",
  },
  {
    kind: "electrical-safety",
    title: "Electrical safety check",
    summary: "Rental electrical check, including RCDs and smoke alarms.",
    folder: "Electrical Safety Check",
  },
];

export function reportCard(kind: ReportKind) {
  const card = reportCards.find((item) => item.kind === kind);
  if (!card) throw new Error("unknown report");
  return card;
}

export function isReportKind(value: string): value is ReportKind {
  return (reportKinds as readonly string[]).includes(value);
}

export const jobSafety: Record<CompanyId, readonly NamedItem[]> = {
  emoro: [
    { id: "ppe", label: "PPE worn" },
    { id: "hazards", label: "Site hazards checked" },
    { id: "tools", label: "Tools tagged" },
  ],
  emporo: [
    { id: "isolated", label: "Water and gas isolated before work" },
    { id: "leak", label: "Leak test done" },
    { id: "ppe", label: "PPE worn" },
  ],
};

export const signOffConfirmations: readonly NamedItem[] = [
  { id: "completed", label: "Work completed as described" },
  { id: "tidy", label: "Site left clean and tidy" },
  { id: "walkthrough", label: "Client walked through the work" },
];

export const gasChecks: readonly NamedItem[] = [
  { id: "lpg", label: "LPG cylinders and components installed correctly" },
  { id: "isolation", label: "Isolation valves fitted where required" },
  { id: "access", label: "Appliances accessible for servicing" },
  { id: "electrical", label: "Installation is electrically safe" },
  { id: "clearances", label: "Clearances to combustible surfaces" },
  { id: "ventilation", label: "Adequate ventilation" },
  { id: "restraint", label: "Appliances, including cookers, restrained from tipping" },
  { id: "flue", label: "Flue or chimney condition" },
  { id: "certification", label: "Evidence of certification" },
  { id: "leakage", label: "Gas leakage test" },
];

export const electricalExtent: readonly NamedItem[] = [
  { id: "main-switchboard", label: "Main switchboard" },
  { id: "main-earthing", label: "Main earthing system" },
  { id: "kitchen", label: "Kitchen" },
  { id: "bathroom-main", label: "Bathroom (main)" },
  { id: "bathrooms-other", label: "Other bathrooms / ensuites" },
  { id: "bedroom-main", label: "Bedroom (main)" },
  { id: "bedrooms-other", label: "Other bedrooms" },
  { id: "living", label: "Living room" },
  { id: "living-other", label: "Other living areas" },
  { id: "laundry", label: "Laundry" },
  { id: "garage", label: "Garage" },
  { id: "solar", label: "Solar / battery system" },
  { id: "electric-water-heater", label: "Electric water heater" },
  { id: "dishwasher", label: "Dishwasher" },
  { id: "heaters", label: "Electric room / space heaters" },
  { id: "pool", label: "Swimming pool equipment" },
];

export const electricalVisual: readonly NamedItem[] = [
  { id: "consumers-mains", label: "Consumers mains" },
  { id: "switchboards", label: "Switchboards" },
  { id: "earth-electrode", label: "Exposed earth electrode" },
  { id: "water-bond", label: "Metallic water pipe bond" },
  { id: "rcds", label: "RCDs (safety switches)" },
  { id: "circuit-protection", label: "Circuit protection (circuit breakers / fuses)" },
  { id: "socket-outlets", label: "Socket-outlets" },
  { id: "light-fittings", label: "Light fittings" },
  { id: "electric-water-heater", label: "Electric water heater" },
  { id: "air-conditioners", label: "Air conditioners" },
  { id: "space-heaters", label: "Space heaters" },
  { id: "cooking", label: "Cooking equipment" },
  { id: "dishwasher", label: "Dishwasher" },
  { id: "exhaust-fans", label: "Exhaust fans" },
  { id: "ceiling-fans", label: "Ceiling fans" },
  { id: "laundry-appliances", label: "Washing machine / dryer" },
  { id: "wiring", label: "Installation wiring" },
  { id: "solar", label: "Solar and other renewable systems" },
  { id: "pool", label: "Swimming pool equipment" },
  { id: "chargers", label: "Vehicle chargers" },
];

export const electricalPolarity: readonly NamedItem[] = [
  { id: "consumers-mains", label: "Consumers mains" },
  { id: "circuit-protection", label: "Circuit protection (circuit breakers / fuses)" },
  { id: "rcds", label: "RCDs (safety switches)" },
  { id: "socket-outlets", label: "Socket-outlets" },
  { id: "light-fittings", label: "Light fittings" },
  { id: "electric-water-heater", label: "Electric water heater" },
  { id: "air-conditioners", label: "Air conditioners" },
  { id: "cooking", label: "Cooking equipment" },
  { id: "dishwasher", label: "Dishwasher" },
  { id: "solar", label: "Solar and other renewable systems" },
  { id: "pool", label: "Swimming pool equipment" },
  { id: "chargers", label: "Vehicle chargers" },
];

export const electricalEarth: readonly NamedItem[] = [
  { id: "mains-earth", label: "Mains earth conductor" },
  { id: "switchboard", label: "Switchboard enclosure" },
  { id: "water-bond", label: "Metallic water pipe bond" },
  { id: "socket-outlets", label: "Socket-outlets" },
  { id: "light-fittings", label: "Light fittings" },
  { id: "exhaust-fans", label: "Exhaust fans" },
  { id: "ceiling-fans", label: "Ceiling fans" },
  { id: "electric-water-heater", label: "Electric water heater" },
  { id: "air-conditioners", label: "Air conditioners" },
  { id: "cooking", label: "Cooking equipment" },
  { id: "dishwasher", label: "Dishwasher" },
  { id: "solar", label: "Solar and other renewable systems" },
  { id: "pool", label: "Swimming pool equipment" },
  { id: "chargers", label: "Vehicle chargers" },
];

export const maxRepeatRows = 12;
export const reportPhotoMax = 8;
export const itemPhotoMax = 4;
export const reportPhotoBytes = 1024 * 1024;
export const reportPhotoTotalBytes = 2_800_000;

export function itemPhotoField(key: string): string {
  return `itemPhoto.${key}`;
}

export type CheckAnswer = {
  id: string;
  label: string;
  result: CheckResult;
  comment?: string;
  reading?: string;
};

export type SafetyAnswer = {
  id: string;
  label: string;
  answer: YesNo;
};

export type ConfirmationAnswer = {
  id: string;
  label: string;
  answer: "yes";
};

export type GasAppliance = {
  type: string;
  location: string;
  makeModel: string;
  serviced: YesNo;
  coSpillage: string;
  recordNo?: string;
};

export type ExtentAnswer = {
  id: string;
  label: string;
  status: ExtentStatus;
};

export type RcdRow = {
  circuit: string;
  pushButton: "pass" | "fail";
  timeTest?: "pass" | "fail";
  timeMs?: string;
};

export type SiteJobSheet = {
  kind: "site-job-sheet";
  company: CompanyId;
  workerName: string;
  date: string;
  jobNumber: string;
  address: string;
  startTime: string;
  finishTime: string;
  work: string;
  materials?: string;
  safety: SafetyAnswer[];
  issues?: string;
};

export type JobSignOff = {
  kind: "job-sign-off";
  company: CompanyId;
  jobNumber: string;
  clientName: string;
  address: string;
  date: string;
  work: string;
  confirmations: ConfirmationAnswer[];
  comments?: string;
  clientEmail?: string;
};

export type GasReport = {
  kind: "gas-safety";
  address: string;
  providerName: string;
  providerEmail: string;
  date: string;
  nextDue: string;
  gasfitterName: string;
  licence: string;
  checks: CheckAnswer[];
  appliances: GasAppliance[];
  faults?: string;
  urgent: YesNo;
  urgentDetails?: string;
  overall: OverallResult;
};

export type ElectricalReport = {
  kind: "electrical-safety";
  address: string;
  providerName: string;
  providerEmail: string;
  date: string;
  previousDate?: string;
  nextDue: string;
  smokeNextDue: string;
  electricianName: string;
  licence: string;
  rec?: string;
  extent: ExtentAnswer[];
  limitations?: string;
  visual: CheckAnswer[];
  polarity: CheckAnswer[];
  earth: CheckAnswer[];
  rcds: RcdRow[];
  smokeAlarms: YesNo;
  smokeComment?: string;
  faults?: string;
  urgent: YesNo;
  urgentDetails?: string;
  overall: OverallResult;
};

export type ReportValue = SiteJobSheet | JobSignOff | GasReport | ElectricalReport;

export type FieldErrors = Record<string, string>;

export function companyName(company: CompanyId): string {
  return companies[company].name;
}

export function companyFor(report: ReportValue): CompanyId {
  if (report.kind === "gas-safety") return "emporo";
  if (report.kind === "electrical-safety") return "emoro";
  return report.company;
}

export function reportMailIdentity(report: ReportValue): { fromName: string; alias: string; replyTo: string } {
  const company = companies[companyFor(report)];
  return { fromName: company.name, alias: company.email, replyTo: company.email };
}

export function accentFor(report: ReportValue): "orange" | "blue" {
  return companies[companyFor(report)].accent;
}
