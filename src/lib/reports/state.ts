import type { FieldErrors } from "@/lib/reports/catalog";

export type SubmitState =
  | { status: "idle" }
  | { status: "invalid"; errors: FieldErrors }
  | { status: "error"; message: string }
  | { status: "sent"; driveUrl: string; emailed: boolean; clientEmailed: boolean; clientRequested: boolean };

export const initialSubmitState: SubmitState = { status: "idle" };
