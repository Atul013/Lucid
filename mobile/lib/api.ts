import { getApiKey, getApiUrl } from "./config";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = await getApiUrl();
  if (!baseUrl) {
    throw new Error("Backend URL not set — open Settings first.");
  }
  const apiKey = await getApiKey();

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `HTTP ${response.status}`;
    throw new ApiError(response.status, detail);
  }
  return body as T;
}

export function getHealth(): Promise<{ status: string }> {
  return request("/health");
}

export interface ArchiveHit {
  from: string;
  date: string;
  subject: string;
  text: string;
}

export interface ArchiveAskResponse {
  answer: string;
  sources: ArchiveHit[];
}

export function archiveAsk(question: string): Promise<ArchiveAskResponse> {
  return request<ArchiveAskResponse>("/archive/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}
