const databaseName = "oro-staff-drafts";
const storeName = "drafts";
const photoBudget = 2_800_000;

type StoredPhoto = { field: string; name: string; type: string; buffer: ArrayBuffer };
type Draft = { fields: Record<string, string>; photos: StoredPhoto[] };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFormDraft(key: string, form: HTMLFormElement): Promise<void> {
  const fields: Record<string, string> = {};
  const photos: StoredPhoto[] = [];
  let bytes = 0;
  for (const [name, value] of new FormData(form).entries()) {
    if (typeof value === "string") {
      if (name.includes("signature") || value.startsWith("data:image")) continue;
      fields[name] = value;
      continue;
    }
    if (value.size === 0 || bytes + value.size > photoBudget) continue;
    bytes += value.size;
    photos.push({ field: name, name: value.name, type: value.type, buffer: await value.arrayBuffer() });
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).put({ fields, photos }, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function loadFormDraft(key: string): Promise<Draft | null> {
  const db = await openDb();
  const draft = await new Promise<Draft | null>((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as Draft | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return draft;
}

export async function clearFormDraft(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export function applyDraft(form: HTMLFormElement, draft: Draft): void {
  for (const element of form.elements) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue;
    if (element instanceof HTMLInputElement && (element.type === "file" || element.type === "hidden")) continue;
    const value = draft.fields[element.name];
    if (element instanceof HTMLInputElement && (element.type === "radio" || element.type === "checkbox")) {
      element.checked = value === element.value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      continue;
    }
    if (value !== undefined) {
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  const grouped = new Map<string, File[]>();
  for (const photo of draft.photos) {
    const file = new File([photo.buffer], photo.name, { type: photo.type });
    grouped.set(photo.field, [...(grouped.get(photo.field) ?? []), file]);
  }
  for (const [field, files] of grouped) {
    const input = form.querySelector(`input[type="file"][name="${CSS.escape(field)}"]`);
    if (!(input instanceof HTMLInputElement)) continue;
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("oro-files"));
  }
}

export function applyAnswers(form: HTMLFormElement, answers: Record<string, string>): void {
  applyDraft(form, { fields: answers, photos: [] });
}
