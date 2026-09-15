import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Fire-and-forget: wake the backend immediately so it's ready by login time.
// Must use the same base as api.js — a bare "/api/ping" would hit the static
// host (and its SPA fallback) instead of the backend whenever the frontend and
// backend are deployed to different origins, silently skipping the warm-up.
const API_BASE = (import.meta.env.VITE_API_URL || "") + "/api";
fetch(`${API_BASE}/ping`, { credentials: "include" }).catch(() => {});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
