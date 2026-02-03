/**
 * Utility functions used by the background worker.
 */

export function normalizeUrl(u) {
  try {
    const x = new URL(String(u).trim());
    x.protocol = "https:";
    return x.toString();
  } catch {
    return String(u || "");
  }
}

export function isOffHost(url, host) {
  try { return new URL(url).hostname !== host; } catch { return false; }
}

export function includesBadAuthPart(url, badParts) {
  const lower = String(url || "").toLowerCase();
  return (badParts || []).some((p) => lower.includes(String(p).toLowerCase()));
}
