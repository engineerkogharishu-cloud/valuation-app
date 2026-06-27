const BASE = (import.meta.env.VITE_API_URL || "") + "/api";

// All requests include credentials so the HttpOnly auth cookie is sent automatically.
// Never read or write the token from JavaScript — it lives only in the cookie.
async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────
  login: (company_code, username, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ company_code, username, password }) }),

  logout: () =>
    request("/auth/logout", { method: "POST" }),

  changePassword: (current_password, new_password) =>
    request("/auth/change-password", { method: "PUT", body: JSON.stringify({ current_password, new_password }) }),

  // ── Companies (super_user) ────────────────────────────────
  listCompanies: () => request("/companies"),

  createCompany: (data) =>
    request("/companies", { method: "POST", body: JSON.stringify(data) }),

  updateCompany: (id, data) =>
    request(`/companies/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCompany: (id) =>
    request(`/companies/${id}`, { method: "DELETE" }),

  // ── Company Profile (admin) ───────────────────────────────
  getCompanyProfile: () => request("/company/profile"),

  updateCompanyProfile: (data) =>
    request("/company/profile", { method: "PUT", body: JSON.stringify(data) }),

  updateCompanyTheme: (report_color_theme) =>
    request("/company/theme", { method: "PUT", body: JSON.stringify({ report_color_theme }) }),

  // ── Company Letterhead ────────────────────────────────────
  getCompanyLetterhead: () => request("/company/letterhead"),

  updateCompanyLetterhead: (letterhead_png) =>
    request("/company/letterhead", { method: "PUT", body: JSON.stringify({ letterhead_png }) }),

  // ── Company Custom Banks ──────────────────────────────────
  getCompanyBanks: () => request("/company/banks"),

  updateCompanyBanks: (banks) =>
    request("/company/banks", { method: "PUT", body: JSON.stringify({ banks }) }),

  // ── Company Payment Methods ───────────────────────────────
  getCompanyPaymentMethods: () => request("/company/payment-methods"),

  updateCompanyPaymentMethods: (payment_methods) =>
    request("/company/payment-methods", { method: "PUT", body: JSON.stringify({ payment_methods }) }),

  // ── Company Fee Tiers ─────────────────────────────────────
  getCompanyFeeTiers: () => request("/company/fee-tiers"),

  updateCompanyFeeTiers: (fee_tiers) =>
    request("/company/fee-tiers", { method: "PUT", body: JSON.stringify({ fee_tiers }) }),

  // ── Company Valuators ─────────────────────────────────────
  getCompanyValuators: () => request("/company/valuators"),

  updateCompanyValuators: (valuators) =>
    request("/company/valuators", { method: "PUT", body: JSON.stringify({ valuators }) }),

  // ── Users ─────────────────────────────────────────────────
  listUsers: () => request("/users"),

  createUser: (data) =>
    request("/users", { method: "POST", body: JSON.stringify(data) }),

  updateUser: (id, data) =>
    request(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteUser: (id) =>
    request(`/users/${id}`, { method: "DELETE" }),

  // ── Reports ───────────────────────────────────────────────
  listReports: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports${qs ? "?" + qs : ""}`);
  },

  getReport: (id) => request(`/reports/${id}`),

  saveReport: (state, filename) =>
    request("/reports", { method: "POST", body: JSON.stringify({ state, filename }) }),

  updateReport: (id, state, filename) =>
    request(`/reports/${id}`, { method: "PUT", body: JSON.stringify({ state, filename }) }),

  deleteReport: (id) =>
    request(`/reports/${id}`, { method: "DELETE" }),

  getReportVersions: (id) =>
    request(`/reports/${id}/versions`),

  getReportVersion: (id, vid) =>
    request(`/reports/${id}/versions/${vid}`),

  // ── Print tracking ────────────────────────────────────────
  recordPrint: (id, print_type, action = "print") =>
    request(`/reports/${id}/print`, { method: "POST", body: JSON.stringify({ print_type, action }) }),

  // ── Admin report list ─────────────────────────────────────
  listAdminReports: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/reports${qs ? "?" + qs : ""}`);
  },

  // ── Stats ─────────────────────────────────────────────────
  getBillingStats: () => request("/stats/billing"),

  getReportStats: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/stats/reports${qs ? "?" + qs : ""}`);
  },

  // ── Map data ──────────────────────────────────────────────
  getMapData: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/map/data${qs ? "?" + qs : ""}`);
  },

  // ── Field data collection ─────────────────────────────────
  generateFieldToken: () =>
    request("/field/token", { method: "POST" }),

  listFieldSubmissions: () =>
    request("/field/submissions"),

  getFieldSubmission: (id) =>
    request(`/field/submissions/${id}`),

  markFieldSubmissionPulled: (id) =>
    request(`/field/submissions/${id}/pull`, { method: "POST" }),

  deleteFieldSubmission: (id) =>
    request(`/field/submissions/${id}`, { method: "DELETE" }),

  importFieldSubmission: (data, photos) =>
    request("/field/submissions/import", { method: "POST", body: JSON.stringify({ data, photos }) }),

  rejectFieldSubmission: (id, reason, extraFields) =>
    request(`/field/submissions/${id}/reject`, { method: "POST", body: JSON.stringify({ reason, extraFields }) }),

  getRateMapPoints: () => request("/rate-map/points"),
  getOwnReportPoints: () => request("/rate-map/own-points"),

  // ── Credits ───────────────────────────────────────────────────
  getCredits: () => request("/credits"),

  deductCredits: (report_id, report_type) =>
    request("/credits/deduct", { method: "POST", body: JSON.stringify({ report_id, report_type }) }),

  // Feedback
  submitFeedback: (message, screenshot) =>
    request("/feedback", { method: "POST", body: JSON.stringify({ message, screenshot }) }),
  getMyFeedback: () => request("/feedback"),
  getFeedbackDetail: (id) => request(`/feedback/${id}`),
  getAdminFeedback: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/feedback${qs ? "?" + qs : ""}`);
  },
  getAdminFeedbackDetail: (id) => request(`/admin/feedback/${id}`),
  approveFeedback: (id) =>
    request(`/admin/feedback/${id}/approve`, { method: "PUT" }),
  rejectFeedback: (id, rejection_note) =>
    request(`/admin/feedback/${id}/reject`, { method: "PUT", body: JSON.stringify({ rejection_note }) }),

  // Registration Requests (public + super_user)
  submitRegistration: (data) =>
    request("/register", { method: "POST", body: JSON.stringify(data) }),

  listRegistrations: (status) => {
    const qs = status ? `?status=${status}` : "";
    return request(`/admin/registrations${qs}`);
  },

  approveRegistration: (id, data) =>
    request(`/admin/registrations/${id}/approve`, { method: "PUT", body: JSON.stringify(data) }),

  rejectRegistration: (id, rejection_note) =>
    request(`/admin/registrations/${id}/reject`, { method: "PUT", body: JSON.stringify({ rejection_note }) }),

  // Rate Map
  getRateMapAccess: () => request("/rate-map/access"),
  startRateMapSession: (duration_minutes) =>
    request("/rate-map/session", { method: "POST", body: JSON.stringify({ duration_minutes }) }),
  startRateMapTrial: () =>
    request("/rate-map/session", { method: "POST", body: JSON.stringify({ free_trial: true }) }),
  getRateMapPoints: () => request("/rate-map/points"),
  getAdminRateMapFreeAccess: () => request("/admin/rate-map/free-access"),
  setRateMapFreeAccess: (company_code, free) =>
    request("/admin/rate-map/free-access", { method: "PUT", body: JSON.stringify({ company_code, free }) }),
  setRateMapFreeAccessAll: (free) =>
    request("/admin/rate-map/free-access/all", { method: "PUT", body: JSON.stringify({ free }) }),
  getAdminRateMapSettings: () => request("/admin/rate-map/settings"),
  updateAdminRateMapSettings: (data) =>
    request("/admin/rate-map/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Super Admin credit management
  getAdminCredits: () => request("/admin/credits"),

  assignCredits: (data) =>
    request("/admin/credits/assign", { method: "POST", body: JSON.stringify(data) }),

  getCreditHistory: (company_code) =>
    request(`/admin/credits/${company_code}/history`),

  // Storage stats
  getStorageStats: () => request("/stats/storage"),
  getAdminStorageStats: () => request("/admin/stats/storage"),

  // Super Admin broadcast email
  broadcastEmail: (subject, html, target = "all") =>
    request("/admin/email/broadcast", { method: "POST", body: JSON.stringify({ subject, html, target }) }),

  // Super Admin test email
  testEmail: (to) =>
    request("/admin/email/test", { method: "POST", body: JSON.stringify({ to }) }),
};
