/**
 * Security utilities — input sanitisation, masking, and safe logging.
 *
 * Defense-in-depth principles for a financial app:
 *
 *   1. Never log PII or financial values in production.
 *   2. Sanitise user-typed strings before sending to the backend
 *      (prevents header/body injection, control-char attacks).
 *   3. Mask sensitive values in the UI by default (account numbers, etc.).
 *   4. Validate every external URL before opening.
 *
 * Usage:
 *   import { sanitizeText, maskAccount, secureLog, isSafeUrl } from "@/utils/security";
 */

/** Strip control chars + zero-width/invisible characters. Trim. Cap length. */
export function sanitizeText(input: string, maxLength = 280): string {
  if (typeof input !== "string") return "";
  return input
    // Control chars (0x00–0x1F, 0x7F)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    // Zero-width + bidi-override chars often used in spoofing
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
    .trim()
    .slice(0, maxLength);
}

/** Strict email-shape check. Backend still validates authoritatively. */
export function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Reject pasted strings that are clearly not in numeric range. */
export function sanitizeMoney(input: string): string {
  return input.replace(/[^0-9.]/g, "").slice(0, 12);
}

/** Mask all but the last `visible` characters. Used for account numbers, etc. */
export function maskAccount(value: string, visible = 4): string {
  if (!value) return "";
  if (value.length <= visible) return "•".repeat(value.length);
  return "•".repeat(Math.max(0, value.length - visible)) + value.slice(-visible);
}

/** Format currency without exposing the number to logs. */
export function formatCurrency(
  amount: number,
  opts: { compact?: boolean; sign?: boolean } = {}
): string {
  const { compact, sign } = opts;
  const abs = Math.abs(amount);
  let body: string;
  if (compact && abs >= 1000) {
    body = `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}K`;
  } else {
    body = `$${abs.toLocaleString("en-US", {
      minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (sign && amount > 0) return `+${body}`;
  if (amount < 0) return `−${body}`;
  return body;
}

/**
 * Logger that strips obvious financial keys before printing in dev,
 * and goes silent in production. Use this everywhere instead of console.log.
 */
const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "ssn",
  "accountNumber",
  "routingNumber",
  "balance",
  "amount",
  "card",
  "cvc",
  "cvv",
  "iban",
  "swift",
  "publicToken",
  "linkToken",
]);

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) =>
        SENSITIVE_KEYS.has(k) ? [k, "[REDACTED]"] : [k, redact(v)]
      )
    );
  }
  return value;
}

export const secureLog = {
  debug: (...args: unknown[]) => {
    if (__DEV__) console.log(...args.map(redact));
  },
  warn: (...args: unknown[]) => {
    if (__DEV__) console.warn(...args.map(redact));
  },
  error: (...args: unknown[]) => {
    // Errors stay loud in dev only. In prod: forward to Sentry/Crashlytics
    // (already a TODO inside ErrorBoundary).
    if (__DEV__) console.error(...args.map(redact));
  },
};

/** Allow only https + your own deep-link scheme. Reject everything else. */
const SAFE_SCHEMES = ["https:", "budget-buddy:"];
export function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return SAFE_SCHEMES.includes(u.protocol);
  } catch {
    return false;
  }
}
