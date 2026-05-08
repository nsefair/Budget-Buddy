/**
 * API Client — single source of truth for all HTTP calls.
 *
 * HOW TO SWAP BACKENDS:
 *   1. Change EXPO_PUBLIC_API_URL in your .env file (or app.config.js env block)
 *   2. If auth scheme changes (e.g. API key instead of Bearer), update the
 *      request interceptor below — one edit, affects every call in the app.
 *   3. If token storage changes (e.g. moving from SecureStore to a different
 *      vault), update the two helpers at the bottom — nothing else changes.
 *
 * HOW TO SWITCH FROM MOCK → REAL DATA:
 *   Set EXPO_PUBLIC_USE_MOCK=false in your .env file.
 *   Each service file in src/services/ checks this flag and either returns
 *   mock data or calls the real API. No changes needed inside screens.
 */

import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import * as SecureStore from "expo-secure-store";

// ─── Environment ──────────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_API_URL in your .env or app.config.js to point at any backend.
// Changing this one value is all that's needed to switch servers.
const RAW_API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://api.budgetbuddy.app/v1";

/**
 * Cybersecurity guard: in production, refuse anything other than HTTPS.
 * In dev, plain http://localhost is allowed for local backend work, but
 * everything else must still be HTTPS — prevents accidental shipping of
 * a non-TLS endpoint and the cleartext interception that comes with it.
 */
function assertSafeBaseUrl(url: string): string {
  if (!__DEV__ && !url.startsWith("https://")) {
    throw new Error(
      "[Security] EXPO_PUBLIC_API_URL must use HTTPS in production builds."
    );
  }
  if (__DEV__ && !url.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)/.test(url)) {
    // Loud in dev — quiet warning instead of throwing so simulator local
    // dev keeps working with localhost variants.
    // eslint-disable-next-line no-console
    console.warn("[Security] Non-HTTPS API URL outside localhost is unsafe:", url);
  }
  return url;
}

export const API_BASE_URL = assertSafeBaseUrl(RAW_API_URL);

export const IS_MOCK =
  process.env.EXPO_PUBLIC_USE_MOCK !== "false" && __DEV__;

// ─── Secure token helpers ─────────────────────────────────────────────────────
// Centralised here so swapping storage (e.g. SecureStore → MMKV) is one edit.
export const TokenStore = {
  getAccess: () => SecureStore.getItemAsync("auth_token"),
  getRefresh: () => SecureStore.getItemAsync("refresh_token"),
  setAccess: (t: string) => SecureStore.setItemAsync("auth_token", t),
  setRefresh: (t: string) => SecureStore.setItemAsync("refresh_token", t),
  clearAll: async () => {
    await SecureStore.deleteItemAsync("auth_token");
    await SecureStore.deleteItemAsync("refresh_token");
  },
};

// ─── Axios instance ───────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ─── Request interceptor — attach Bearer token ────────────────────────────────
// If the backend changes auth scheme (e.g. x-api-key header), only edit here.
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await TokenStore.getAccess();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ─── Response interceptor — 401 refresh + queue ───────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  refreshQueue.forEach((p) =>
    error ? p.reject(error) : p.resolve(token!)
  );
  refreshQueue = [];
};

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await TokenStore.getRefresh();
      if (!refreshToken) throw new Error("No refresh token");

      // Refresh endpoint — update ENDPOINTS.AUTH.REFRESH if the route changes
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken }
      );

      await TokenStore.setAccess(data.accessToken);
      await TokenStore.setRefresh(data.refreshToken);
      processQueue(null, data.accessToken);

      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await TokenStore.clearAll();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── Typed request helpers ────────────────────────────────────────────────────
// Use these everywhere in services — never call apiClient directly from screens.
export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    apiClient.get<T>(url, { params }).then((r) => r.data),

  post: <T>(url: string, data?: unknown) =>
    apiClient.post<T>(url, data).then((r) => r.data),

  put: <T>(url: string, data?: unknown) =>
    apiClient.put<T>(url, data).then((r) => r.data),

  patch: <T>(url: string, data?: unknown) =>
    apiClient.patch<T>(url, data).then((r) => r.data),

  delete: <T>(url: string) =>
    apiClient.delete<T>(url).then((r) => r.data),
};
