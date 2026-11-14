const DRIVE_APP = "oro-reports";

export function safeSegment(value: string, max = 80): string {
  const cleaned = value
    .replace(/[\u0000-\u001f\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned.slice(0, max).trim() || "report").replace(/[. ]+$/g, "") || "report";
}

export function submissionFolderName(date: string, address: string, jobNumber?: string): string {
  if (jobNumber?.trim()) return safeSegment(`${jobNumber} ${address}`, 96);
  return safeSegment(`${date} ${address}`, 96);
}

export function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function driveFolderQuery(name: string, parentId?: string): string {
  const nameClause = `name = '${escapeDriveQuery(name)}'`;
  const marker = `appProperties has { key='oroApp' and value='${DRIVE_APP}' }`;
  const parent = parentId ? `'${escapeDriveQuery(parentId)}' in parents` : `'root' in parents`;
  return `${nameClause} and mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${marker} and ${parent}`;
}

export const driveAppProperty = DRIVE_APP;
