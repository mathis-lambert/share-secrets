import type {
  CreateRequest,
  CreateResponse,
  ErrorCode,
  InspectResponse,
  PublicConfig,
  RevealResponse,
} from "./types";

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new ApiError("network", "Network error");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code: ErrorCode =
      res.status === 413 ? "too_large" : ((data?.error as ErrorCode | undefined) ?? "internal");
    throw new ApiError(code, data?.message ?? res.statusText);
  }
  return data as T;
}

const secretPath = (id: string) => `/api/secrets/${encodeURIComponent(id)}`;

export const api = {
  config: () => request<PublicConfig>("GET", "/api/config"),
  create: (body: CreateRequest) => request<CreateResponse>("POST", "/api/secrets", body),
  inspect: (id: string) => request<InspectResponse>("GET", secretPath(id)),
  reveal: (id: string, auth: string) =>
    request<RevealResponse>("POST", `${secretPath(id)}/reveal`, { auth }),
  destroy: (id: string, auth: string) => request<void>("DELETE", secretPath(id), { auth }),
};
