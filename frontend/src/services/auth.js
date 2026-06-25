const USER_KEY = "val_auth_user";

// Token is stored in an HttpOnly cookie set by the server — never accessible here.
// We only keep a copy of the non-sensitive user profile in sessionStorage so the
// UI can render role/username without an extra round-trip on every page load.
// sessionStorage is cleared automatically when the tab/browser closes.

export const getUser = () => {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY)); } catch { return null; }
};

export const setAuth = (user) => {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  sessionStorage.removeItem(USER_KEY);
  // Clear all app-level session data on logout
  sessionStorage.removeItem("ncc_autosave_draft");
  sessionStorage.removeItem("ncc_letterhead_html");
  sessionStorage.removeItem("ncc_custom_banks");
  sessionStorage.removeItem("lhd_designs_v1");
  // Remove any legacy localStorage keys from older versions
  try {
    localStorage.removeItem("ncc_autosave_draft");
    localStorage.removeItem("ncc_letterhead_html");
    localStorage.removeItem("ncc_custom_banks");
    localStorage.removeItem("lhd_designs_v1");
  } catch (_) {}
};
