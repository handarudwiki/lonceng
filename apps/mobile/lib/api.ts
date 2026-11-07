import * as SecureStore from "expo-secure-store";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

const REFRESH_KEY = "lonceng.refresh";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let schoolId: string | null = null;
let onSignedOut: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const setSchool = (id: string | null) => {
  schoolId = id;
};
export const onSessionLost = (fn: () => void) => {
  onSignedOut = fn;
};
export const getRefreshToken = () => refreshToken;

export async function storeTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function restoreTokens() {
  refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  return refreshToken ? refresh() : false;
}

async function refresh(): Promise<boolean> {
  if (!refreshToken) return false;
  // Refresh tokens are single use, so parallel 401s must share one attempt.
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as { accessToken: string; refreshToken: string };
      await storeTokens(body.accessToken, body.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export function authHeaders(): Record<string, string> {
  return {
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    ...(schoolId ? { "x-school-id": schoolId } : {}),
  };
}

async function send(path: string, init: RequestInit) {
  return fetch(`${API_URL}/api/v1${path}`, { ...init, headers: { ...authHeaders(), ...init.headers } });
}

export async function api<T = unknown>(path: string, options: { body?: unknown; form?: FormData; method?: string } = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? (options.body !== undefined || options.form ? "POST" : "GET"),
    headers: options.form ? {} : { "content-type": "application/json" },
    body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  };
  let res: Response;
  try {
    res = await send(path, init);
    if (res.status === 401 && refreshToken && (await refresh())) res = await send(path, init);
  } catch {
    throw new ApiFailure("Tidak ada koneksi internet", 0);
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401 && accessToken) {
    await clearTokens();
    onSignedOut?.();
  }
  if (!res.ok) throw new ApiFailure(json.error ?? "Terjadi kesalahan", res.status);
  return json;
}

/** Sends a picked photo; the server returns a path to attach to the request. */
export async function uploadPhoto(uri: string): Promise<string> {
  const form = new FormData();
  form.append("file", { uri, name: "foto.jpg", type: "image/jpeg" } as unknown as Blob);
  const { path } = await api<{ path: string }>("/uploads", { form });
  return path;
}
