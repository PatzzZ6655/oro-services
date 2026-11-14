export type SummaryResult = "pass" | "fail" | "na" | "yes" | "no";

export type SummaryItem = {
  label: string;
  result: SummaryResult;
  comment?: string;
  photoKey?: string;
};

export type Tally = { pass: number; fail: number; na: number };

export function tally(items: SummaryItem[]): Tally {
  return {
    pass: items.filter((item) => item.result === "pass" || item.result === "yes").length,
    fail: items.filter((item) => item.result === "fail" || item.result === "no").length,
    na: items.filter((item) => item.result === "na").length,
  };
}

export function summaryOrder(items: SummaryItem[], photoKeys: ReadonlySet<string>): SummaryItem[] {
  const visible = items.filter((item) => item.result !== "na");
  const fails = visible.filter((item) => item.result === "fail" || item.result === "no");
  const pictured = visible.filter((item) => item.result !== "fail" && item.result !== "no" && ((item.photoKey && photoKeys.has(item.photoKey)) || Boolean(item.comment)));
  return [...fails, ...pictured];
}

export function swmsIsUnscored(): true {
  return true;
}
