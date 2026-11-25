import { businessLabel, type Business } from "@/lib/jobs-app/types";

export type IntroTenant = { name: string; email: string };

export type IntroPreview = {
  business: Business;
  brand: string;
  address: string;
  pmAgency: string;
  desc: string;
  tenants: IntroTenant[];
};

export function introSubject(address: string, brand: string): string {
  return `Repair Request At ${address} – ${brand}`;
}

export function introAgencyBit(pmAgency: string): string {
  const agency = pmAgency.trim();
  return agency ? ` at ${agency}` : "";
}

export function introTenantLine(tenant: IntroTenant): string {
  const name = tenant.name.trim() || "Tenant";
  const email = tenant.email.trim();
  return email ? `${name} — ${email}` : `${name} — no email - not sent`;
}

/** Optional CC. An unticked box or a missing address sends an empty address, so Make can ignore it. */
export function introCcPayload(checked: boolean, pmEmail: string): { ccPm: "0" | "1"; pmEmail: string } {
  const email = pmEmail.replace(/[\u0000-\u001F]+/g, " ").trim().slice(0, 120);
  const cc = checked && email.includes("@") && !/\s/.test(email);
  return { ccPm: cc ? "1" : "0", pmEmail: cc ? email : "" };
}

export function introBody(preview: IntroPreview, name: string): string {
  const who = name.trim() || "there";
  const brand = preview.brand || businessLabel(preview.business);
  const agency = introAgencyBit(preview.pmAgency);
  const company = preview.business === "emporo" ? "Emporo Plumbing Pty Ltd" : "Emoro Building Pty Ltd";
  const email = preview.business === "emporo" ? "info.emporo@orosvc.com" : "info.emoro@orosvc.com";
  const abn = preview.business === "emporo" ? "ABN 63 695 532 944" : "ABN 36 695 596 019";
  return [
    `Hi ${who},`,
    "",
    `We hope you're having a great week. We're ${brand}, and your property manager${agency} has kindly asked us to look after a repair at ${preview.address}:`,
    "",
    preview.desc,
    "",
    "One of our tradies will be in touch soon to arrange a time that works for you. To help everything go smoothly, we'd be grateful for your help with a few things:",
    "",
    "Timing: We always do our best to arrive on time. Occasionally, Melbourne traffic, an earlier job running over, or an urgent safety call such as a gas leak may mean we need to adjust the time. If so, we'll let you know as early as we can and rearrange at no extra cost. We really appreciate your flexibility.",
    "Access: Where possible, please make sure our tradie can reach the work area. It helps a lot if furniture or stored items are moved out of the way, and if you can let us know about any access codes, parking or building rules.",
    "Pets and children: For everyone's safety, we'd appreciate it if pets could be secured and children kept clear of the work area while we're working.",
    "Missed appointments: If we're unable to get access at the agreed time, we may need to rebook, and your property manager may be advised.",
    "Safety first: If our tradie finds anything unsafe, we may need to turn off the gas, water or power until it's made safe.",
    "Photos: We may take before and after photos of the work area for your property manager's records.",
    "",
    "Our full terms are available at https://orosvc.com/terms.",
    "",
    "If you have any questions at all, please feel free to reply to this email.",
    "",
    "Kind regards,",
    brand,
    "",
    company,
    "P  0430 016 655",
    `E  ${email}`,
    "W  www.orosvc.com",
    abn,
  ].join("\n");
}

export function introStatusText(status: string, message: string): string {
  if (status === "sent") return "Sent.";
  if (status === "queued") {
    return "Queued for the next 08:00 Melbourne time. Intro emails go out from 08:00 to 17:00 Melbourne time, including weekends.";
  }
  if (status === "skipped") return "Skipped.";
  if (status === "alreadySent") return "Already sent.";
  if (status === "failed") return message || "The intro email was not sent.";
  return message || status;
}
