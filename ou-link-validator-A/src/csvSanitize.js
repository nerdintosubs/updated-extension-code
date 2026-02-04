/**
 * CSV sanitizer to mitigate spreadsheet formula injection.
 * Keep this in sync with the csvSanitize used in popup.js.
 * @param {any} v
 * @returns {string}
 */
export function csvSanitize(v){
  if (v == null) return "";
  const s = String(v);
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}
