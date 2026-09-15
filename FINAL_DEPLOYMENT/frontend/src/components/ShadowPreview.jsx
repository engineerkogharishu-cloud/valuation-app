import React from "react";
import DOMPurify from "dompurify";

// DOMPurify configuration for the shadow-DOM report preview.
//
// Security intent:
//   - Strip <script> tags, on* event handlers, javascript: and data:text/html
//     URIs (handled by DOMPurify by default).
//   - Allow <style> tags so the report CSS renders correctly.
//   - Allow data: URIs on <img> so base64 photos and the letterhead PNG render.
//   - Disallow unknown data-* attributes that could carry payloads.
const PURIFY_OPTS = {
  FORCE_BODY:         true,          // wrap fragment in <body> context
  ADD_TAGS:           ["style"],     // allow inline <style> for report CSS
  ADD_DATA_URI_TAGS:  ["img"],       // allow data: URIs on <img> (photos, letterhead)
  ADD_URI_SAFE_ATTR:  ["src"],       // mark src as safe so data: URIs on img pass
  ALLOW_DATA_ATTR:    false,         // strip all data-* attributes (XSS vector)
  FORBID_TAGS:        ["script", "object", "embed", "iframe", "frame", "frameset"],
  FORBID_ATTR:        ["onerror", "onload", "onclick", "onmouseover", "onfocus",
                       "onblur", "onchange", "onsubmit", "onreset",
                       "onkeydown", "onkeypress", "onkeyup"],
};

export default function ShadowPreview({ html }) {
  const hostRef = React.useRef(null);
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || !html) return;
    let shadow = host.shadowRoot;
    if (!shadow) shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = DOMPurify.sanitize(html, PURIFY_OPTS);
  }, [html]);
  return (
    <div
      ref={hostRef}
      style={{ flex: 1, overflow: "auto", background: "#e8e8e8", display: "block", minHeight: 0 }}
    />
  );
}
