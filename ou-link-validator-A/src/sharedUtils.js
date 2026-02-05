/**
 * Shared utility functions used across the extension.
 * These functions are safe to import in both background and injected contexts.
 */

/**
 * Normalize unicode punctuation for consistent text matching.
 */
export function normalizePunctuation(s) {
  return String(s || "")
    .replace(/[\u2018\u2019\u02BC\uFF07]/g, "'")  // apostrophes
    .replace(/[\u201C\u201D\u2033]/g, '"')        // quotes
    .replace(/[\u2013\u2014]/g, "-");              // dashes
}

/**
 * Unicode-safe text normalization for error marker matching.
 * Handles curly quotes, accents, case, and whitespace.
 */
export function normalizeText(input) {
  const raw = normalizePunctuation(String(input || ""));
  const nfkd = raw.normalize("NFKD");
  const noMarks = nfkd.replace(/[\u0300-\u036f]/g, "");
  return noMarks.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Validate MyLearn URL format.
 */
export function validateMyLearnUrl(url, host = "mylearn.oracle.com") {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
           parsed.hostname === host &&
           parsed.pathname.startsWith('/ou/');
  } catch {
    return false;
  }
}