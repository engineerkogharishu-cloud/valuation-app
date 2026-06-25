import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Fire-and-forget: wake the backend immediately so it's ready by login time.
fetch("/api/ping", { credentials: "include" }).catch(() => {});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
