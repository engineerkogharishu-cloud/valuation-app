/**
 * HTML-escape helpers for safe template-literal report generation.
 *
 * Every piece of user-supplied data that is interpolated directly into
 * an HTML string MUST pass through esc() first.  Failure to do so
 * creates stored-XSS vulnerabilities.
 *
 * Usage:
 *   import { esc, escAttr } from "../utils/htmlEscape";
 *
 *   // Inside an HTML table cell:
 *   `<td>${esc(person.name)}</td>`
 *
 *   // Inside an HTML attribute:
 *   `<img alt="${escAttr(photo.caption)}" src="...">`
 */

/**
 * Escape a value for safe insertion as HTML text content.
 *
 * @param {*}      value    - Any value (null/undefined treated as fallback)
 * @param {string} fallback - Returned when value is null/undefined/empty (default "—")
 * @returns {string}        - HTML-safe string
 */
export function esc(value, fallback = "—") {
  const str =
    value === null || value === undefined || value === ""
      ? fallback
      : String(value);
  return str
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#x27;");
}

/**
 * Escape a value for safe insertion inside an HTML attribute value.
 * Identical implementation — provided as a named alias for clarity.
 *
 * @param {*}      value    - Any value
 * @param {string} fallback - Returned when value is null/undefined/empty (default "")
 * @returns {string}        - HTML-attribute-safe string
 */
export function escAttr(value, fallback = "") {
  return esc(value, fallback);
}
