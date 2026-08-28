// Small shared helpers used by the Supabase-backed resource modules.

import { supabase } from '@/lib/supabase';

// Write payloads from the UI frequently use `field || null` for optional
// values. This mapped type mirrors an entity's fields but also permits null.
export type ApiInput<T> = { [K in keyof T]?: T[K] | null };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Throws ApiError with the Postgrest/Supabase error message if `error` is set.
export function throwIfError(error: { message: string } | null | undefined, status = 400): void {
  if (error) throw new ApiError(status, error.message);
}

// The signed-in user's current Supabase access token, for calling our own
// privileged `/api/**` Route Handlers (user create/update/delete/pause,
// which need the service-role key and so can't run in the browser).
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// POSTs to one of our own Next.js API routes, attaching the caller's
// Supabase session as a Bearer token so the route can identify the actor.
export async function callServerApi<T = unknown>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data && (data as { error: string }).error) ||
      `Request failed (${res.status})`;
    throw new ApiError(res.status, String(message));
  }

  return data as T;
}
