export class JobsClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function read<T>(response: Response, path: string): Promise<T> {
  const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
  if (response.status === 401 && !path.endsWith("/login")) {
    throw new JobsClientError(401, "unauthorized", "请重新登录");
  }
  if (!response.ok || !data || data.ok === false) {
    throw new JobsClientError(response.status, data?.error ?? "upstream", data?.message ?? "服务器没有返回内容。请稍后再试。");
  }
  return data as T;
}

export async function postJobs<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new JobsClientError(0, "network", "网络不行，请再试一次。");
  }
  return read<T>(response, path);
}

export async function postJobsForm<T>(path: string, form: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", body: form, headers: { accept: "application/json" } });
  } catch {
    throw new JobsClientError(0, "network", "网络不行，请再试一次。");
  }
  return read<T>(response, path);
}
