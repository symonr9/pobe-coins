/**
 * Fetch wrapper for the Pobe API. The active profile's token and household are
 * provided by the session module; refreshed tokens are saved automatically.
 */
import { API_URL } from '@/config';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get offline() {
    return this.code === 'OFFLINE';
  }
}

interface AuthBridge {
  token: () => Promise<string | null>;
  householdId: () => string | undefined;
  onRefreshed: (token: string) => void;
  onUnauthorized: () => void;
}

let bridge: AuthBridge = {
  token: async () => null,
  householdId: () => undefined,
  onRefreshed: () => undefined,
  onUnauthorized: () => undefined,
};

export function setAuthBridge(b: AuthBridge) {
  bridge = b;
}

export async function api<T = any>(method: string, path: string, body?: unknown, opts: { token?: string | null; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const token = opts.token !== undefined ? opts.token : opts.auth === false ? null : await bridge.token();
  if (token) headers.authorization = `Bearer ${token}`;
  const hid = bridge.householdId();
  if (hid && opts.token === undefined) headers['x-household-id'] = hid;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('OFFLINE', 'You seem to be offline. Check your connection and try again.', 0);
  }
  const refreshed = res.headers.get('x-refreshed-token');
  if (refreshed && opts.token === undefined) bridge.onRefreshed(refreshed);
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!res.ok) {
    const err = json?.error;
    if (res.status === 401 && opts.token === undefined && token) bridge.onUnauthorized();
    throw new ApiError(err?.code ?? 'HTTP', err?.message ?? `Something went wrong (${res.status}).`, res.status, err?.details);
  }
  return json as T;
}

export const get = <T = any>(path: string) => api<T>('GET', path);
export const post = <T = any>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});
export const patch = <T = any>(path: string, body: unknown) => api<T>('PATCH', path, body);
export const put = <T = any>(path: string, body: unknown) => api<T>('PUT', path, body);
export const del = <T = any>(path: string, body?: unknown) => api<T>('DELETE', path, body);
