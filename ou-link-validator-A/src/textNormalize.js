/**
 * Text normalization helpers for robust marker matching.
 * Mirrors the logic used in src/injectedProbe.js (kept in sync intentionally).
 */

export function normalizePunctuation(s) {
  return String(s ?? "")
    .replace(/[\u2018\u2019\u02BC\uFF07]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");
}

export function normalizeText(input) {
  const raw = normalizePunctuation(String(input ?? ""));
  const nfkd = raw.normalize("NFKD");
  const noMarks = nfkd.replace(/[\u0300-\u036f]/g, "");
  return noMarks.toLowerCase().replace(/\s+/g, " ").trim();
}
