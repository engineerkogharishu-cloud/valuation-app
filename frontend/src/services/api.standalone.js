/**
 * Standalone (no-backend) API — stores everything in localStorage.
 * Mirrors the shape of the real api.js so ValuationForm / Dashboard work unchanged.
 */

const KEYS = {
  REPORTS:   "ncc_sa_reports",
  SETTINGS:  "ncc_sa_settings",  // company profile + letterhead + theme combined
  VALUATORS: "ncc_sa_valuators",
  BANKS:     "ncc_sa_banks",
};

function lsGet(key, def) {
  try { const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); }
  catch { return def; }
}
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

let _nextId = Date.now();
const uid = () => (++_nextId).toString(36);

export const api = {
  // ── Auth (no-op) ───────────────────────────────────────────
  login:          async () => { throw new Error("Standalone mode — no server login"); },
  logout:         async () => {},
  changePassword: async () => {},

  // ── Company profile ────────────────────────────────────────
  getCompanyProfile: async () => {
    const s = lsGet(KEYS.SETTINGS, {});
    return { company_name: s.company_name || "My Valuation Company", ...s };
  },
  updateCompanyProfile: async (data) => {
    lsSet(KEYS.SETTINGS, { ...lsGet(KEYS.SETTINGS, {}), ...data });
    return data;
  },
  updateCompanyTheme: async (report_color_theme) => {
    lsSet(KEYS.SETTINGS, { ...lsGet(KEYS.SETTINGS, {}), report_color_theme });
    return {};
  },

  // ── Letterhead (returns combined settings so ValuationForm gets
  //    company_name / report_color_theme / letterhead_text_box etc.) ──
  getCompanyLetterhead: async () => {
    const s = lsGet(KEYS.SETTINGS, {});
    return {
      company_name:            s.company_name            || "",
      letterhead_png:          s.letterhead_png          || null,
      letterhead_text_box:     s.letterhead_text_box     || null,
      letterhead_watermark_box:s.letterhead_watermark_box|| null,
      report_color_theme:      s.report_color_theme      || null,
    };
  },
  updateCompanyLetterhead: async (letterhead_png) => {
    lsSet(KEYS.SETTINGS, { ...lsGet(KEYS.SETTINGS, {}), letterhead_png });
    return { letterhead_png };
  },

  // ── Banks ──────────────────────────────────────────────────
  getCompanyBanks:   async () => ({ banks: lsGet(KEYS.BANKS, []) }),
  updateCompanyBanks: async (banks) => { lsSet(KEYS.BANKS, banks); return { banks }; },

  // ── Valuators ──────────────────────────────────────────────
  getCompanyValuators:    async () => ({ valuators: lsGet(KEYS.VALUATORS, []) }),
  updateCompanyValuators: async (valuators) => { lsSet(KEYS.VALUATORS, valuators); return { valuators }; },

  // ── Reports ────────────────────────────────────────────────
  listReports: async ({ search = "", limit = 100 } = {}) => {
    const all = lsGet(KEYS.REPORTS, []);
    const q = search.toLowerCase().trim();
    const filtered = q
      ? all.filter(r => {
          const st = r.state || {};
          const cl = (st.clients || [])[0] || {};
          const clientName = (cl.showPerson && cl.person?.name) ||
                             (cl.showCompany && cl.company?.name) || "";
          return (r.filename      || "").toLowerCase().includes(q) ||
                 (st.bank         || "").toLowerCase().includes(q) ||
                 (st.branch       || "").toLowerCase().includes(q) ||
                 clientName.toLowerCase().includes(q);
        })
      : all;
    const rows = filtered.slice(0, limit).map(r => {
      const st = r.state || {};
      const cl = (st.clients || [])[0] || {};
      const clientName = (cl.showPerson && cl.person?.name) ||
                         (cl.showCompany && cl.company?.name) || "";
      return {
        id:          r.id,
        filename:    r.filename,
        created_at:  r.created_at,
        updated_at:  r.updated_at,
        bank:        st.bank        || "",
        branch:      st.branch      || "",
        client_name: clientName,
        report_type: st.reportType  || "",
        visit_date:  st.visitDate   || null,
        report_date: st.reportDate  || null,
      };
    });
    return { reports: rows, total: filtered.length };
  },

  getReport: async (id) => {
    const r = lsGet(KEYS.REPORTS, []).find(x => x.id === id);
    if (!r) throw new Error("Report not found");
    return r;
  },

  saveReport: async (state, filename) => {
    const all = lsGet(KEYS.REPORTS, []);
    const now = new Date().toISOString();
    const r = { id: uid(), state, filename, created_at: now, updated_at: now };
    lsSet(KEYS.REPORTS, [r, ...all]);
    return r;
  },

  updateReport: async (id, state, filename) => {
    const all = lsGet(KEYS.REPORTS, []);
    const idx = all.findIndex(x => x.id === id);
    if (idx === -1) throw new Error("Report not found");
    all[idx] = { ...all[idx], state, filename, updated_at: new Date().toISOString() };
    lsSet(KEYS.REPORTS, all);
    return all[idx];
  },

  deleteReport: async (id) => {
    lsSet(KEYS.REPORTS, lsGet(KEYS.REPORTS, []).filter(x => x.id !== id));
    return {};
  },

  // ── Print tracking (no-op) ─────────────────────────────────
  recordPrint: async () => {},

  // ── Unused in standalone (admin / super-user pages) ───────
  listAdminReports:  async () => ({ reports: [], total: 0 }),
  getReportStats:    async () => ({}),
  getMapData:        async () => ({}),
  listCompanies:     async () => ([]),
  createCompany:     async () => ({}),
  updateCompany:     async () => ({}),
  deleteCompany:     async () => ({}),
  listUsers:         async () => ([]),
  createUser:        async () => ({}),
  updateUser:        async () => ({}),
  deleteUser:        async () => ({}),
};
