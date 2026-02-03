import { normalizeText } from "./textNormalize.js";

/**
 * Create normalized marker index once per run.
 * @param {string[]} markers
 * @returns {{raw:string,norm:string}[]}
 */
export function compileMarkers(markers) {
  return (markers || []).map((m) => ({ raw: String(m), norm: normalizeText(m) }));
}

/**
 * Find first marker contained in bodyText (unicode-normalized).
 * @param {string} bodyText
 * @param {{raw:string,norm:string}[]} compiledMarkers
 * @returns {string|null} raw marker value if found, else null
 */
export function findSoftFailMarker(bodyText, compiledMarkers) {
  const hay = normalizeText(bodyText || "");
  for (const m of compiledMarkers || []) {
    if (m.norm && hay.includes(m.norm)) return m.raw;
  }
  return null;
}
