export const REQUIRED_ITEMS = [
  "完工照片已拍（含前后对比）",
  "水电气已恢复并测试、无漏水",
  "现场已清理、家具归位",
  "工具材料已带走",
  "门窗已锁好",
] as const;

export const OPTIONAL_ITEMS = [
  "钥匙已归还（含换锁后的新钥匙交回中介办公室）",
  "已向租客交代维修情况（租客不在可不选）",
] as const;

export function checklistText(checked: ReadonlySet<string>): { text: string; missing: string[] } {
  const lines: string[] = [];
  const missing: string[] = [];
  for (const item of REQUIRED_ITEMS) {
    if (checked.has(item)) lines.push(`✔ ${item}`);
    else {
      lines.push(`✘ ${item}`);
      missing.push(item);
    }
  }
  for (const item of OPTIONAL_ITEMS) {
    lines.push(checked.has(item) ? `✔ ${item}` : `✘ ${item}`);
  }
  return { text: lines.join("；"), missing };
}
