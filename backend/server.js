require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const crypto       = require("crypto");
const bcrypt       = require("bcryptjs");
const jwt          = require("jsonwebtoken");
const helmet       = require("helmet");
const rateLimit    = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@libsql/client");
const nodemailer       = require("nodemailer");

// ── Fail-fast on missing / weak secrets ─────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("FATAL: JWT_SECRET must be set to at least 32 random characters in .env");
  process.exit(1);
}

if (!process.env.TURSO_DATABASE_URL) {
  console.error("FATAL: TURSO_DATABASE_URL must be set");
  process.exit(1);
}

// ── Turso / libsql client ─────────────────────────────────────────────────────
const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

// ── DB helpers ────────────────────────────────────────────────────────────────
async function dbGet(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return rs.rows[0] || null;
}
async function dbAll(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return rs.rows;
}
async function dbRun(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return { lastInsertRowid: Number(rs.lastInsertRowid), changes: rs.rowsAffected };
}

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (!allowedOrigins.length) {
  allowedOrigins.push("http://localhost:3000");
}

// Allow any *.netlify.app subdomain as a safe fallback for production
const NETLIFY_PATTERN = /^https:\/\/[a-z0-9-]+\.netlify\.app$/;

// ── App bootstrap ────────────────────────────────────────────────────────────
const app = express();

// Trust the Netlify CDN proxy layer so req.ip reflects the real client IP.
app.set("trust proxy", process.env.TRUST_PROXY === "false" ? false : 1);

// ── Security headers (Helmet) ─────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use((req, res, next) => {
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:              ["'self'"],
        scriptSrc:               ["'self'", `'nonce-${res.locals.cspNonce}'`,
                                  "https://cdnjs.cloudflare.com"],
        scriptSrcAttr:           ["'none'"],
        styleSrc:                ["'self'", "https://fonts.googleapis.com",
                                  `'nonce-${res.locals.cspNonce}'`],
        fontSrc:                 ["'self'", "https://fonts.gstatic.com"],
        imgSrc:                  ["'self'", "data:", "blob:"],
        connectSrc:              ["'self'"],
        frameSrc:                ["'none'"],
        objectSrc:               ["'none'"],
        baseUri:                 ["'self'"],
        formAction:              ["'self'"],
        upgradeInsecureRequests: [],
      },
      reportOnly: false,
    },
    hsts:            { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy:  { policy: "strict-origin-when-cross-origin" },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    crossOriginEmbedderPolicy:    false,
    crossOriginOpenerPolicy:      { policy: "same-origin" },
  })(req, res, next);
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (process.env.NODE_ENV === "production" && !origin) {
      return cb(new Error("CORS: missing Origin header"));
    }
    if (!origin || allowedOrigins.includes(origin) || NETLIFY_PATTERN.test(origin)) return cb(null, true);
    cb(new Error("CORS policy violation"));
  },
  credentials:     true,
  methods:         ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders:  ["Content-Type"],
  maxAge:          600,
}));

app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

// ── DB initialisation (runs once per Lambda cold-start) ──────────────────────
let dbReady = false;
let dbInitPromise = null;

async function initDb() {
  await db.execute("PRAGMA foreign_keys = ON");

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS companies (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      company_code  TEXT    UNIQUE NOT NULL,
      company_name  TEXT    NOT NULL DEFAULT '',
      address1      TEXT    DEFAULT '',
      address2      TEXT    DEFAULT '',
      city          TEXT    DEFAULT '',
      state         TEXT    DEFAULT '',
      zip           TEXT    DEFAULT '',
      country       TEXT    DEFAULT '',
      contact_email TEXT    DEFAULT '',
      contact_phone TEXT    DEFAULT '',
      logo_url      TEXT    DEFAULT '',
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      company_code         TEXT    NOT NULL,
      username             TEXT    NOT NULL,
      password_hash        TEXT    NOT NULL,
      email                TEXT    DEFAULT '',
      role                 TEXT    NOT NULL CHECK(role IN ('super_user','admin','user')),
      must_change_password INTEGER DEFAULT 0,
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_code, username)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      filename     TEXT    NOT NULL,
      report_type  TEXT    NOT NULL DEFAULT 'preliminary',
      bank         TEXT,
      branch       TEXT,
      visit_date   TEXT,
      report_date  TEXT,
      client_name  TEXT,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      state_json   TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reports_bank        ON reports(bank);
    CREATE INDEX IF NOT EXISTS idx_reports_report_date ON reports(report_date);
    CREATE INDEX IF NOT EXISTS idx_reports_client_name ON reports(client_name);

    CREATE TABLE IF NOT EXISTS report_versions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id     INTEGER NOT NULL,
      changed_by_id INTEGER NOT NULL,
      state_json    TEXT    NOT NULL,
      state_hash    TEXT    NOT NULL DEFAULT '',
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_rv_report ON report_versions(report_id);

    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti        TEXT    PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rt_exp ON revoked_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS security_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type   TEXT    NOT NULL,
      user_id      INTEGER,
      username     TEXT,
      company_code TEXT,
      ip_address   TEXT,
      detail       TEXT,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_se_type ON security_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_se_user ON security_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_se_ts   ON security_events(created_at);

    CREATE TABLE IF NOT EXISTS report_prints (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id     INTEGER NOT NULL,
      company_code  TEXT    NOT NULL,
      user_id       INTEGER NOT NULL,
      username      TEXT    NOT NULL,
      print_type    TEXT    NOT NULL DEFAULT 'preliminary',
      action        TEXT    NOT NULL DEFAULT 'print',
      printed_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prints_report  ON report_prints(report_id);
    CREATE INDEX IF NOT EXISTS idx_prints_company ON report_prints(company_code);

    CREATE TABLE IF NOT EXISTS field_submissions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      company_code      TEXT    NOT NULL,
      submitter_name    TEXT    DEFAULT '',
      data_json         TEXT    NOT NULL DEFAULT '{}',
      photos_json       TEXT    NOT NULL DEFAULT '[]',
      status            TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','pulled')),
      pulled_by_user_id INTEGER,
      pulled_at         DATETIME,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_fs_company ON field_submissions(company_code);
    CREATE INDEX IF NOT EXISTS idx_fs_status  ON field_submissions(status);

    CREATE TABLE IF NOT EXISTS field_links (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      company_code TEXT    NOT NULL,
      short_code   TEXT    NOT NULL UNIQUE,
      label        TEXT    NOT NULL DEFAULT '',
      link_type    TEXT    NOT NULL DEFAULT 'permanent' CHECK(link_type IN ('permanent','temporary')),
      expires_at   DATETIME,
      max_uses     INTEGER,
      use_count    INTEGER NOT NULL DEFAULT 0,
      active       INTEGER NOT NULL DEFAULT 1,
      created_by   TEXT    NOT NULL DEFAULT '',
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_fl_company ON field_links(company_code);
    CREATE INDEX IF NOT EXISTS idx_fl_code    ON field_links(short_code);

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      company_code   TEXT    NOT NULL,
      actor_id       INTEGER,
      actor_username TEXT    NOT NULL DEFAULT '',
      action         TEXT    NOT NULL,
      amount         INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after  INTEGER NOT NULL,
      report_id      INTEGER,
      report_type    TEXT,
      note           TEXT    DEFAULT '',
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ct_company ON credit_transactions(company_code);
    CREATE INDEX IF NOT EXISTS idx_ct_ts      ON credit_transactions(created_at);

    CREATE TABLE IF NOT EXISTS rate_map_sessions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      company_code     TEXT    NOT NULL,
      user_id          INTEGER NOT NULL,
      username         TEXT    NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL,
      credits_used     INTEGER NOT NULL,
      expires_at       DATETIME NOT NULL,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_rms_company ON rate_map_sessions(company_code);

    CREATE TABLE IF NOT EXISTS system_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      company_code    TEXT    NOT NULL,
      user_id         INTEGER NOT NULL,
      username        TEXT    NOT NULL DEFAULT '',
      user_email      TEXT    DEFAULT '',
      message         TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'pending',
      credit_awarded  INTEGER NOT NULL DEFAULT 0,
      approved_by     TEXT    DEFAULT '',
      approved_at     DATETIME,
      rejection_note  TEXT    DEFAULT '',
      email_sent      INTEGER NOT NULL DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_fb_company ON feedback(company_code);
    CREATE INDEX IF NOT EXISTS idx_fb_status  ON feedback(status);

    CREATE TABLE IF NOT EXISTS registration_requests (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name   TEXT    NOT NULL,
      contact_name   TEXT    NOT NULL,
      email          TEXT    NOT NULL,
      phone          TEXT    DEFAULT '',
      message        TEXT    DEFAULT '',
      status         TEXT    NOT NULL DEFAULT 'pending',
      reviewed_by    TEXT    DEFAULT '',
      rejection_note TEXT    DEFAULT '',
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at    DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_reg_status ON registration_requests(status);
  `);

  // Safe schema migrations — ignore "duplicate column" errors
  const migrations = [
    "ALTER TABLE reports    ADD COLUMN company_code TEXT DEFAULT ''",
    "ALTER TABLE reports    ADD COLUMN created_by_user_id INTEGER",
    "ALTER TABLE companies  ADD COLUMN custom_banks TEXT DEFAULT '[]'",
    "ALTER TABLE companies  ADD COLUMN letterhead_png TEXT DEFAULT ''",
    "ALTER TABLE companies  ADD COLUMN letterhead_text_box TEXT DEFAULT ''",
    "ALTER TABLE companies  ADD COLUMN letterhead_watermark_box TEXT DEFAULT ''",
    "ALTER TABLE companies  ADD COLUMN valuators TEXT DEFAULT '[]'",
    "ALTER TABLE companies  ADD COLUMN report_color_theme TEXT DEFAULT 'blue'",
    "ALTER TABLE report_versions ADD COLUMN state_hash TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE field_submissions ADD COLUMN rejection_reason TEXT DEFAULT ''",
    "ALTER TABLE field_submissions ADD COLUMN rejected_at DATETIME",
    "ALTER TABLE field_submissions ADD COLUMN rejected_by_user_id INTEGER",
    "ALTER TABLE field_submissions ADD COLUMN rejected_by_username TEXT DEFAULT ''",
    // Credit system
    "ALTER TABLE companies ADD COLUMN credit_balance INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE companies ADD COLUMN credit_expiry  DATETIME",
    "ALTER TABLE companies ADD COLUMN credit_low_threshold INTEGER NOT NULL DEFAULT 5",
    // Rate map feature
    "ALTER TABLE companies ADD COLUMN rate_map_free INTEGER NOT NULL DEFAULT 0",
    // Feedback screenshot
    "ALTER TABLE feedback ADD COLUMN screenshot TEXT DEFAULT ''",
    // Bill / company identification fields
    "ALTER TABLE companies ADD COLUMN pan_vat TEXT DEFAULT ''",
    "ALTER TABLE companies ADD COLUMN bank_account TEXT DEFAULT ''",
    "ALTER TABLE companies ADD COLUMN bill_prefix TEXT DEFAULT 'BILL'",
    // Payment methods (bank accounts with QR for bill)
    "ALTER TABLE companies ADD COLUMN payment_methods TEXT DEFAULT '[]'",
    // Valuation fee tiers (NRB schedule, configurable per company)
    "ALTER TABLE companies ADD COLUMN fee_tiers TEXT DEFAULT '[]'",
    // Payment tracking for final reports
    "ALTER TABLE reports ADD COLUMN amount_received REAL",
    "ALTER TABLE reports ADD COLUMN received_by_user_id INTEGER",
    "ALTER TABLE reports ADD COLUMN received_at TEXT",
    "ALTER TABLE reports ADD COLUMN received_bank TEXT",
    // Field links (short codes for mobile data collection)
    `CREATE TABLE IF NOT EXISTS field_links (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      company_code TEXT    NOT NULL,
      short_code   TEXT    NOT NULL UNIQUE,
      label        TEXT    NOT NULL DEFAULT '',
      link_type    TEXT    NOT NULL DEFAULT 'permanent' CHECK(link_type IN ('permanent','temporary')),
      expires_at   DATETIME,
      max_uses     INTEGER,
      use_count    INTEGER NOT NULL DEFAULT 0,
      active       INTEGER NOT NULL DEFAULT 1,
      created_by   TEXT    NOT NULL DEFAULT '',
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS idx_fl_company ON field_links(company_code)",
    "CREATE INDEX IF NOT EXISTS idx_fl_code    ON field_links(short_code)",
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch (_) {}
  }

  try { await db.execute("UPDATE reports SET company_code = '' WHERE company_code IS NULL"); } catch (_) {}

  // Expand field_submissions status CHECK to include 'rejected'
  // libsql/SQLite can't ALTER a CHECK constraint, so recreate the table
  try {
    const tblInfo = await dbGet("SELECT sql FROM sqlite_master WHERE type='table' AND name='field_submissions'");
    if (tblInfo && tblInfo.sql && !String(tblInfo.sql).includes("'rejected'")) {
      await db.execute({ sql: `CREATE TABLE IF NOT EXISTS field_submissions_new (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        company_code            TEXT    NOT NULL,
        submitter_name          TEXT    DEFAULT '',
        data_json               TEXT    NOT NULL DEFAULT '{}',
        photos_json             TEXT    NOT NULL DEFAULT '[]',
        status                  TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','pulled','rejected')),
        pulled_by_user_id       INTEGER,
        pulled_at               DATETIME,
        rejection_reason        TEXT    DEFAULT '',
        rejected_at             DATETIME,
        rejected_by_user_id     INTEGER,
        rejected_by_username    TEXT    DEFAULT '',
        created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, args: [] });
      await db.execute({ sql: `INSERT INTO field_submissions_new
        SELECT id, company_code, submitter_name, data_json, photos_json, status,
               pulled_by_user_id, pulled_at,
               COALESCE(rejection_reason,''), rejected_at,
               rejected_by_user_id, COALESCE(rejected_by_username,''), created_at
        FROM field_submissions`, args: [] });
      await db.execute({ sql: `DROP TABLE field_submissions`, args: [] });
      await db.execute({ sql: `ALTER TABLE field_submissions_new RENAME TO field_submissions`, args: [] });
      await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_fs_company ON field_submissions(company_code)`, args: [] });
      await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_fs_status  ON field_submissions(status)`, args: [] });
    }
  } catch (e) { console.warn("field_submissions CHECK migration:", e.message); }

  // Purge expired tokens on cold start
  await purgeExpiredTokens();
  await purgeOldSecurityEvents();
  await pruneReportVersions();

  await seedSuperUser();
  dbReady = true;
}

function ensureDb() {
  if (!dbInitPromise) dbInitPromise = initDb().catch((err) => {
    console.error("DB init failed:", err);
    dbInitPromise = null; // allow retry on next request
    throw err;
  });
  return dbInitPromise;
}

// Middleware: ensure DB is initialised before any route runs
app.use(async (req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    res.status(500).json({ error: "Database initialisation failed." });
  }
});

// ── Seed super user ──────────────────────────────────────────────────────────
async function seedSuperUser() {
  const existing = await dbGet("SELECT id FROM users WHERE role = 'super_user'");
  if (existing) return;
  await dbRun("INSERT OR IGNORE INTO companies (company_code, company_name) VALUES (?,?)", ["SYSTEM", "System Administration"]);
  const initialPassword = process.env.SUPER_ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) {
    console.error("FATAL: SUPER_ADMIN_INITIAL_PASSWORD must be set to seed the super user.");
    process.exit(1);
  }
  const hash = await bcrypt.hash(initialPassword, 12);
  await dbRun(
    `INSERT OR IGNORE INTO users (company_code, username, password_hash, role, must_change_password)
     VALUES (?, ?, ?, 'super_user', 1)`,
    ["SYSTEM", "superadmin", hash]
  );
  console.log("Super user seeded. Change the password on first login.");
}

// ── Persistent token revocation ───────────────────────────────────────────────
async function isRevoked(jti) {
  const now = Math.floor(Date.now() / 1000);
  const row = await dbGet("SELECT 1 FROM revoked_tokens WHERE jti = ? AND expires_at > ?", [jti, now]);
  return !!row;
}
async function revokeToken(jti, exp) {
  await dbRun("INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)", [jti, exp]);
}
async function purgeExpiredTokens() {
  const now = Math.floor(Date.now() / 1000);
  try { await db.execute({ sql: "DELETE FROM revoked_tokens WHERE expires_at <= ?", args: [now] }); } catch (_) {}
}

// ── Data retention ────────────────────────────────────────────────────────────
async function purgeOldSecurityEvents() {
  try {
    await db.execute("DELETE FROM security_events WHERE created_at < datetime('now', '-90 days')");
  } catch (_) {}
}

const MAX_VERSIONS_PER_REPORT = 10;

async function pruneReportVersions(reportId = null) {
  try {
    // If a specific report, prune only that one (called after each save)
    // Otherwise prune all (called at startup)
    if (reportId) {
      await dbRun(`
        DELETE FROM report_versions
        WHERE report_id = ? AND id NOT IN (
          SELECT id FROM report_versions
          WHERE report_id = ?
          ORDER BY id DESC
          LIMIT ${MAX_VERSIONS_PER_REPORT}
        )
      `, [reportId, reportId]);
    } else {
      // Startup: prune all reports in one pass
      const reportIds = await dbAll("SELECT DISTINCT report_id FROM report_versions");
      for (const { report_id } of reportIds) {
        await dbRun(`
          DELETE FROM report_versions
          WHERE report_id = ? AND id NOT IN (
            SELECT id FROM report_versions
            WHERE report_id = ?
            ORDER BY id DESC
            LIMIT ${MAX_VERSIONS_PER_REPORT}
          )
        `, [report_id, report_id]);
      }
    }
  } catch (_) {}
}

// ── Audit trail hash chain ────────────────────────────────────────────────────
function hashVersionChain(stateJson, prevHash = "") {
  return crypto.createHash("sha256").update(prevHash + stateJson).digest("hex");
}

// ── Security event logger ─────────────────────────────────────────────────────
function logEvent(type, req, detail = "") {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  dbRun(
    "INSERT INTO security_events (event_type, user_id, username, company_code, ip_address, detail) VALUES (?,?,?,?,?,?)",
    [type, req.user?.userId ?? null, req.user?.username ?? null,
     req.user?.companyCode ?? null, ip, String(detail).substring(0, 500)]
  ).catch(() => {});
}

// ── Input validation ──────────────────────────────────────────────────────────
const EMAIL_RE    = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{1,63}$/;
const CODE_RE     = /^[A-Z0-9]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.\-]+$/;

function validateField(val, name, maxLen, pattern = null) {
  if (typeof val !== "string") return `${name} must be a string`;
  if (val.length > maxLen)    return `${name} must be ≤${maxLen} characters`;
  if (pattern && !pattern.test(val)) return `${name} contains invalid characters`;
  return null;
}

// ── State JSON sanitizer ──────────────────────────────────────────────────────
const SCRIPT_RE   = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const ALL_TAGS_RE = /<(?!\/?\s*(?:br|p|strong|em|b|i|u|ul|ol|li|table|thead|tbody|tr|th|td|div|span|h[1-6])\b)[^>]*>/gi;
const EVENT_RE    = /\bon\w+\s*=/gi;
const JSPROTO_RE  = /javascript\s*:/gi;
const DATAHTML_RE = /data\s*:\s*text\/html/gi;

function sanitizeStr(v) {
  if (typeof v !== "string") return v;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(v)) return v;
  if (/^data:application\/pdf;base64,/i.test(v)) return v;
  return v
    .replace(SCRIPT_RE,   "")
    .replace(ALL_TAGS_RE, "")
    .replace(EVENT_RE,    "")
    .replace(JSPROTO_RE,  "")
    .replace(DATAHTML_RE, "")
    .substring(0, 8000);
}
function deepSanitize(val, depth = 0) {
  if (depth > 12 || val === null || val === undefined) return val;
  if (typeof val === "string") return sanitizeStr(val);
  if (Array.isArray(val)) return val.map((v) => deepSanitize(v, depth + 1));
  if (typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = deepSanitize(v, depth + 1);
    return out;
  }
  return val;
}

// ── Per-account login lockout ─────────────────────────────────────────────────
const accountAttempts = new Map();
const ACCOUNT_WINDOW  = 15 * 60 * 1000;
const ACCOUNT_MAX     = 10;

function checkAccountLock(companyCode, username) {
  const key = `${companyCode.toUpperCase()}:${username.toLowerCase()}`;
  const now  = Date.now();
  const rec  = accountAttempts.get(key);
  if (rec && now < rec.resetAt && rec.count >= ACCOUNT_MAX) {
    const wait = Math.ceil((rec.resetAt - now) / 60000);
    return { locked: true, wait };
  }
  return { locked: false };
}
function recordFailedLogin(companyCode, username) {
  const key = `${companyCode.toUpperCase()}:${username.toLowerCase()}`;
  const now  = Date.now();
  const rec  = accountAttempts.get(key);
  if (!rec || now >= rec.resetAt) {
    accountAttempts.set(key, { count: 1, resetAt: now + ACCOUNT_WINDOW });
  } else {
    rec.count++;
  }
}
function clearAccountLock(companyCode, username) {
  accountAttempts.delete(`${companyCode.toUpperCase()}:${username.toLowerCase()}`);
}

// ── Password strength validation ─────────────────────────────────────────────
function isStrongPassword(pwd) {
  return (
    typeof pwd === "string" &&
    pwd.length >= 10 &&
    /[A-Z]/.test(pwd) &&
    /[a-z]/.test(pwd) &&
    /[0-9]/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd)
  );
}

// ── Generic error handler ────────────────────────────────────────────────────
function handleError(res, err, context = "") {
  console.error(`[ERROR] ${context}:`, err);
  res.status(500).json({ error: "An internal error occurred." });
}

// ── Cookie helpers ───────────────────────────────────────────────────────────
const COOKIE_NAME = "val_auth";
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge:   8 * 60 * 60 * 1000,
  path:     "/",
};

// ── Auth middleware ───────────────────────────────────────────────────────────
function auth(roles = []) {
  return async (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (await isRevoked(decoded.jti))
        return res.status(401).json({ error: "Session has been revoked. Please log in again." });
      if (roles.length && !roles.includes(decoded.role))
        return res.status(403).json({ error: "Forbidden" });
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

// ── Rate limiters ────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  message:         { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders:   false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      300,
  standardHeaders: true,
  legacyHeaders:   false,
});

app.use("/api/", apiLimiter);

// ── Auth Routes ───────────────────────────────────────────────────────────────

const DUMMY_HASH = bcrypt.hashSync("dummy_constant_time_placeholder", 12);

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { company_code, username, password } = req.body;
    if (!company_code || !username || !password)
      return res.status(400).json({ error: "company_code, username, and password required" });

    const cc  = company_code.toUpperCase().trim();
    const usr = username.trim();

    const lock = checkAccountLock(cc, usr);
    if (lock.locked) {
      logEvent("LOGIN_LOCKED", req, `company=${cc} username=${usr}`);
      return res.status(429).json({ error: `Account locked. Try again in ${lock.wait} minute(s).` });
    }

    const user = await dbGet(
      `SELECT id, company_code, username, email, role, must_change_password, password_hash
       FROM users WHERE company_code = ? AND username = ?`,
      [cc, usr]
    );

    const hashToCompare = user ? user.password_hash : DUMMY_HASH;
    const ok = await bcrypt.compare(password, hashToCompare);

    if (!user || !ok) {
      recordFailedLogin(cc, usr);
      logEvent("LOGIN_FAILURE", req, `company=${cc} username=${usr}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    clearAccountLock(cc, usr);

    const jti   = uuidv4();
    const token = jwt.sign(
      { jti, userId: user.id, username: user.username, role: user.role, companyCode: user.company_code },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    logEvent("LOGIN_SUCCESS", { ...req, user: { userId: user.id, username: user.username, companyCode: user.company_code } }, "");
    res.json({
      user: {
        id:                 user.id,
        username:           user.username,
        role:               user.role,
        companyCode:        user.company_code,
        email:              user.email,
        mustChangePassword: user.must_change_password === 1,
      },
    });
  } catch (err) {
    handleError(res, err, "POST /api/auth/login");
  }
});

app.post("/api/auth/logout", auth(), async (req, res) => {
  await revokeToken(req.user.jti, req.user.exp);
  logEvent("LOGOUT", req);
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ message: "Logged out" });
});

app.get("/api/auth/me", auth(), async (req, res) => {
  const user = await dbGet(
    "SELECT id, username, role, company_code, email, must_change_password FROM users WHERE id = ?",
    [req.user.userId]
  );
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

app.put("/api/auth/change-password", auth(), async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!isStrongPassword(new_password))
      return res.status(400).json({
        error: "Password must be at least 10 characters and include uppercase, lowercase, a number, and a symbol.",
      });
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [req.user.userId]);
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(400).json({ error: "Current password is incorrect" });
    const hash = await bcrypt.hash(new_password, 12);
    await dbRun(
      "UPDATE users SET password_hash=?, must_change_password=0, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [hash, req.user.userId]
    );
    logEvent("PASSWORD_CHANGE", req);
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    handleError(res, err, "PUT /api/auth/change-password");
  }
});

// ── Company Management (super_user only) ──────────────────────────────────────

app.get("/api/companies", auth(["super_user"]), async (req, res) => {
  try {
    const companies = await dbAll("SELECT * FROM companies ORDER BY company_code");
    const users     = await dbAll("SELECT company_code, COUNT(*) as user_count FROM users GROUP BY company_code");
    const userMap   = Object.fromEntries(users.map((u) => [u.company_code, u.user_count]));
    res.json(companies.map((c) => ({ ...c, user_count: userMap[c.company_code] || 0 })));
  } catch (err) {
    handleError(res, err, "GET /api/companies");
  }
});

app.post("/api/companies", auth(["super_user"]), async (req, res) => {
  try {
    const { company_name, company_code: preferred, admin_username, admin_password } = req.body;
    if (!admin_username || !admin_password)
      return res.status(400).json({ error: "admin_username and admin_password required" });

    const userErr = validateField(admin_username, "admin_username", 50, USERNAME_RE);
    if (userErr) return res.status(400).json({ error: userErr });
    if (company_name) {
      const nameErr = validateField(company_name, "company_name", 200);
      if (nameErr) return res.status(400).json({ error: nameErr });
    }
    if (!isStrongPassword(admin_password))
      return res.status(400).json({
        error: "Admin password must be ≥10 chars with uppercase, lowercase, number, and symbol.",
      });

    let code = preferred?.toUpperCase().trim();
    if (!code) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      do {
        code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      } while (await dbGet("SELECT id FROM companies WHERE company_code=?", [code]));
    } else {
      const codeErr = validateField(code, "company_code", 12, CODE_RE);
      if (codeErr) return res.status(400).json({ error: codeErr });
      if (await dbGet("SELECT id FROM companies WHERE company_code=?", [code]))
        return res.status(409).json({ error: "Company code already exists" });
    }

    await dbRun("INSERT INTO companies (company_code, company_name) VALUES (?,?)", [code, company_name || ""]);
    const hash = await bcrypt.hash(admin_password, 12);
    await dbRun(
      `INSERT INTO users (company_code, username, password_hash, role, must_change_password)
       VALUES (?, ?, ?, 'admin', 1)`,
      [code, admin_username, hash]
    );

    logEvent("COMPANY_CREATED", req, `company_code=${code}`);
    res.status(201).json({ company_code: code, message: "Company created" });
  } catch (err) {
    handleError(res, err, "POST /api/companies");
  }
});

app.put(
  "/api/companies/:id",
  auth(["super_user"]),
  async (req, res) => {
    try {
      const {
        company_name, address1, address2, city, state, zip,
        country, contact_email, contact_phone, letterhead_png, letterhead_text_box,
        letterhead_watermark_box,
      } = req.body;
      const result = await dbRun(`
        UPDATE companies SET company_name=?, address1=?, address2=?, city=?, state=?, zip=?,
          country=?, contact_email=?, contact_phone=?, letterhead_png=?, letterhead_text_box=?,
          letterhead_watermark_box=?,
          updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [
          company_name || "", address1 || "", address2 || "", city || "", state || "", zip || "",
          country || "", contact_email || "", contact_phone || "",
          letterhead_png !== undefined ? letterhead_png : "",
          letterhead_text_box !== undefined ? letterhead_text_box : "",
          letterhead_watermark_box !== undefined ? letterhead_watermark_box : "",
          req.params.id,
        ]
      );
      if (result.changes === 0) return res.status(404).json({ error: "Not found" });
      res.json({ message: "Updated" });
    } catch (err) {
      handleError(res, err, "PUT /api/companies/:id");
    }
  }
);

app.delete("/api/companies/:id", auth(["super_user"]), async (req, res) => {
  try {
    const company = await dbGet("SELECT company_code FROM companies WHERE id=?", [req.params.id]);
    if (!company) return res.status(404).json({ error: "Not found" });
    if (company.company_code === "SYSTEM") return res.status(400).json({ error: "Cannot delete the system company" });
    await dbRun("DELETE FROM users WHERE company_code=?", [company.company_code]);
    await dbRun("DELETE FROM companies WHERE id=?", [req.params.id]);
    logEvent("COMPANY_DELETED", req, `company_code=${company.company_code}`);
    res.json({ message: "Company and all associated users deleted" });
  } catch (err) {
    handleError(res, err, "DELETE /api/companies/:id");
  }
});

// ── Company Profile ───────────────────────────────────────────────────────────

app.get("/api/company/profile", auth(), async (req, res) => {
  const company = await dbGet("SELECT * FROM companies WHERE company_code=?", [req.user.companyCode]);
  if (!company) return res.status(404).json({ error: "Company not found" });
  res.json(company);
});

app.put("/api/company/profile", auth(["admin"]), async (req, res) => {
  try {
    const { company_name, address1, address2, city, state, zip, country, contact_email, contact_phone, report_color_theme, pan_vat, bank_account, bill_prefix } = req.body;
    const LEGACY_THEMES = ["blue","green","maroon","purple","teal","charcoal","orange","indigo"];
    const HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
    const theme = (LEGACY_THEMES.includes(report_color_theme) || HEX_RE.test(report_color_theme))
      ? report_color_theme : "blue";
    await dbRun(
      `UPDATE companies SET company_name=?, address1=?, address2=?, city=?, state=?, zip=?,
        country=?, contact_email=?, contact_phone=?, report_color_theme=?,
        pan_vat=?, bank_account=?, bill_prefix=?, updated_at=CURRENT_TIMESTAMP
        WHERE company_code=?`,
      [company_name, address1 || "", address2 || "", city || "", state || "", zip || "",
       country || "", contact_email || "", contact_phone || "", theme,
       pan_vat || "", bank_account || "", bill_prefix || "BILL", req.user.companyCode]
    );
    res.json({ message: "Profile updated" });
  } catch (err) {
    handleError(res, err, "PUT /api/company/profile");
  }
});

// ── Company Color Theme ───────────────────────────────────────────────────────

app.put("/api/company/theme", auth(["admin", "super_user"]), async (req, res) => {
  try {
    const { report_color_theme } = req.body;
    const LEGACY = ["blue","green","maroon","purple","teal","charcoal","orange","indigo"];
    const HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
    if (!LEGACY.includes(report_color_theme) && !HEX_RE.test(report_color_theme))
      return res.status(400).json({ error: "Invalid theme value" });
    await dbRun(
      "UPDATE companies SET report_color_theme=?, updated_at=CURRENT_TIMESTAMP WHERE company_code=?",
      [report_color_theme, req.user.companyCode]
    );
    res.json({ message: "Theme updated" });
  } catch (err) {
    handleError(res, err, "PUT /api/company/theme");
  }
});

// ── Company Letterhead ────────────────────────────────────────────────────────

app.get("/api/company/letterhead", auth(), async (req, res) => {
  try {
    const company = await dbGet(
      "SELECT company_name, letterhead_png, letterhead_text_box, letterhead_watermark_box, report_color_theme, address1, address2, city, state, contact_email, contact_phone, pan_vat, bank_account, bill_prefix, payment_methods FROM companies WHERE company_code=?",
      [req.user.companyCode]
    );
    if (!company) return res.status(404).json({ error: "Company not found" });
    let textBox = null;
    let watermarkBox = null;
    try { if (company.letterhead_text_box) textBox = JSON.parse(company.letterhead_text_box); } catch (_) {}
    try { if (company.letterhead_watermark_box) watermarkBox = JSON.parse(company.letterhead_watermark_box); } catch (_) {}
    res.json({
      company_name:             company.company_name || "",
      letterhead_png:           company.letterhead_png || "",
      letterhead_text_box:      textBox,
      letterhead_watermark_box: watermarkBox,
      report_color_theme:       company.report_color_theme || "blue",
      address:                  [company.address1, company.address2, company.city, company.state].filter(Boolean).join(", "),
      contact_email:            company.contact_email || "",
      contact_phone:            company.contact_phone || "",
      pan_vat:                  company.pan_vat || "",
      bank_account:             company.bank_account || "",
      bill_prefix:              company.bill_prefix || "BILL",
      payment_methods:          (() => { try { return JSON.parse(company.payment_methods || "[]"); } catch (_) { return []; } })(),
    });
  } catch (err) {
    handleError(res, err, "GET /api/company/letterhead");
  }
});

const VALID_IMG_PREFIX = /^data:image\/(png|jpeg|webp|gif);base64,/;
app.put(
  "/api/company/letterhead",
  auth(["admin", "super_user"]),
  async (req, res) => {
    try {
      const { letterhead_png } = req.body;
      if (letterhead_png) {
        if (!VALID_IMG_PREFIX.test(letterhead_png))
          return res.status(400).json({ error: "letterhead_png must be a valid base64 image data URI (png/jpeg/webp/gif)" });
        if (letterhead_png.length > 11 * 1024 * 1024)
          return res.status(413).json({ error: "Image too large (max 8 MB raw)" });
      }
      await dbRun(
        "UPDATE companies SET letterhead_png=?, updated_at=CURRENT_TIMESTAMP WHERE company_code=?",
        [letterhead_png || "", req.user.companyCode]
      );
      res.json({ message: "Letterhead updated" });
    } catch (err) {
      handleError(res, err, "PUT /api/company/letterhead");
    }
  }
);

// ── Company Custom Banks ──────────────────────────────────────────────────────

app.get("/api/company/banks", auth(), async (req, res) => {
  try {
    const company = await dbGet("SELECT custom_banks FROM companies WHERE company_code=?", [req.user.companyCode]);
    if (!company) return res.status(404).json({ error: "Company not found" });
    let banks = [];
    try { banks = JSON.parse(company.custom_banks || "[]"); } catch (_) {}
    res.json({ banks });
  } catch (err) {
    handleError(res, err, "GET /api/company/banks");
  }
});

app.put("/api/company/banks", auth(["admin", "super_user"]), async (req, res) => {
  try {
    const { banks } = req.body;
    if (!Array.isArray(banks)) return res.status(400).json({ error: "banks must be an array" });
    const clean = banks.map((b) => String(b).trim()).filter(Boolean);
    await dbRun(
      "UPDATE companies SET custom_banks=?, updated_at=CURRENT_TIMESTAMP WHERE company_code=?",
      [JSON.stringify(clean), req.user.companyCode]
    );
    res.json({ banks: clean, message: "Bank list updated" });
  } catch (err) {
    handleError(res, err, "PUT /api/company/banks");
  }
});

// ── Company Payment Methods ───────────────────────────────────────────────────

app.get("/api/company/payment-methods", auth(), async (req, res) => {
  try {
    const company = await dbGet("SELECT payment_methods FROM companies WHERE company_code=?", [req.user.companyCode]);
    if (!company) return res.status(404).json({ error: "Company not found" });
    let methods = [];
    try { methods = JSON.parse(company.payment_methods || "[]"); } catch (_) {}
    res.json({ payment_methods: methods });
  } catch (err) {
    handleError(res, err, "GET /api/company/payment-methods");
  }
});

app.put("/api/company/payment-methods", auth(["admin", "super_user"]), async (req, res) => {
  try {
    const { payment_methods } = req.body;
    if (!Array.isArray(payment_methods)) return res.status(400).json({ error: "payment_methods must be an array" });
    const clean = payment_methods.map(m => ({
      id:            String(m.id || Date.now() + Math.random()),
      bankName:      String(m.bankName    || "").trim(),
      branch:        String(m.branch      || "").trim(),
      location:      String(m.location    || "").trim(),
      accountName:   String(m.accountName || "").trim(),
      accountNumber: String(m.accountNumber || "").trim(),
      qrCode:        typeof m.qrCode === "string" && VALID_IMG_PREFIX.test(m.qrCode) ? m.qrCode : "",
    })).filter(m => m.bankName || m.accountName || m.accountNumber);
    await dbRun(
      "UPDATE companies SET payment_methods=?, updated_at=CURRENT_TIMESTAMP WHERE company_code=?",
      [JSON.stringify(clean), req.user.companyCode]
    );
    res.json({ payment_methods: clean, message: "Payment methods updated" });
  } catch (err) {
    handleError(res, err, "PUT /api/company/payment-methods");
  }
});

// ── Company Valuators ─────────────────────────────────────────────────────────

app.get("/api/company/valuators", auth(), async (req, res) => {
  try {
    const company = await dbGet("SELECT valuators FROM companies WHERE company_code=?", [req.user.companyCode]);
    if (!company) return res.status(404).json({ error: "Company not found" });
    let valuators = [];
    try { valuators = JSON.parse(company.valuators || "[]"); } catch (_) {}
    res.json({ valuators });
  } catch (err) {
    handleError(res, err, "GET /api/company/valuators");
  }
});

app.put("/api/company/valuators", auth(["admin", "super_user"]), async (req, res) => {
  try {
    const { valuators } = req.body;
    if (!Array.isArray(valuators)) return res.status(400).json({ error: "valuators must be an array" });
    const clean = valuators
      .map((v) => ({
        id:        v.id        || String(Date.now() + Math.random()),
        name:      String(v.name      || "").trim(),
        licenseNo: String(v.licenseNo || "").trim(),
        company:   String(v.company   || "").trim(),
        phone:     String(v.phone     || "").trim(),
        email:     String(v.email     || "").trim(),
      }))
      .filter((v) => v.name);
    await dbRun(
      "UPDATE companies SET valuators=?, updated_at=CURRENT_TIMESTAMP WHERE company_code=?",
      [JSON.stringify(clean), req.user.companyCode]
    );
    res.json({ valuators: clean, message: "Valuator list updated" });
  } catch (err) {
    handleError(res, err, "PUT /api/company/valuators");
  }
});

// ── Company Fee Tiers ─────────────────────────────────────────────────────────

app.get("/api/company/fee-tiers", auth(), async (req, res) => {
  try {
    const company = await dbGet("SELECT fee_tiers FROM companies WHERE company_code=?", [req.user.companyCode]);
    if (!company) return res.status(404).json({ error: "Company not found" });
    let tiers = {};
    try {
      const parsed = JSON.parse(company.fee_tiers || "{}");
      // Migrate old array format to empty object
      tiers = Array.isArray(parsed) ? {} : (parsed && typeof parsed === "object" ? parsed : {});
      // Migrate old "Default" key to "Nepal Valuators Association"
      if (tiers["Default"] !== undefined && tiers["Nepal Valuators Association"] === undefined) {
        tiers["Nepal Valuators Association"] = tiers["Default"];
        delete tiers["Default"];
      }
    } catch (_) {}
    res.json({ fee_tiers: tiers });
  } catch (err) {
    handleError(res, err, "GET /api/company/fee-tiers");
  }
});

app.put("/api/company/fee-tiers", auth(["admin", "super_user"]), async (req, res) => {
  try {
    const { fee_tiers } = req.body;
    // fee_tiers is an object: { [bankName]: tier[] }
    if (typeof fee_tiers !== "object" || Array.isArray(fee_tiers) || fee_tiers === null)
      return res.status(400).json({ error: "fee_tiers must be an object keyed by bank name" });
    const cleanTierList = (list) => (Array.isArray(list) ? list : []).map(t => ({
      label: String(t.label || "").trim(),
      upto:  t.upto === null || t.upto === "" ? null : Number(t.upto),
      base:  Number(t.base  || 0),
      rate:  Number(t.rate  || 0),
    })).filter(t => t.label);
    const clean = {};
    for (const [bank, list] of Object.entries(fee_tiers)) {
      const key = String(bank).trim();
      if (key) clean[key] = cleanTierList(list);
    }
    await dbRun(
      "UPDATE companies SET fee_tiers=?, updated_at=CURRENT_TIMESTAMP WHERE company_code=?",
      [JSON.stringify(clean), req.user.companyCode]
    );
    res.json({ fee_tiers: clean, message: "Fee tiers updated" });
  } catch (err) {
    handleError(res, err, "PUT /api/company/fee-tiers");
  }
});

// ── User Management ───────────────────────────────────────────────────────────

app.get("/api/users", auth(["super_user", "admin"]), async (req, res) => {
  try {
    let users;
    if (req.user.role === "super_user") {
      users = await dbAll(
        "SELECT id, company_code, username, email, role, must_change_password, created_at FROM users ORDER BY company_code, username"
      );
    } else {
      users = await dbAll(
        "SELECT id, company_code, username, email, role, must_change_password, created_at FROM users WHERE company_code=? AND role='user' ORDER BY username",
        [req.user.companyCode]
      );
    }
    res.json(users);
  } catch (err) {
    handleError(res, err, "GET /api/users");
  }
});

app.post("/api/users", auth(["super_user", "admin"]), async (req, res) => {
  try {
    let { username, password, email, role, company_code } = req.body;
    if (req.user.role === "admin") {
      company_code = req.user.companyCode;
      role = "user";
    }
    if (!company_code || !username || !password)
      return res.status(400).json({ error: "company_code, username, and password required" });

    const userErr = validateField(username, "username", 50, USERNAME_RE);
    if (userErr) return res.status(400).json({ error: userErr });
    if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: "Invalid email format" });
    if (!isStrongPassword(password))
      return res.status(400).json({
        error: "Password must be ≥10 chars with uppercase, lowercase, number, and symbol.",
      });

    const hash = await bcrypt.hash(password, 12);
    await dbRun(
      `INSERT INTO users (company_code, username, password_hash, email, role, must_change_password)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [company_code, username.trim(), hash, email || "", role || "user"]
    );
    logEvent("USER_CREATED", req, `new_user=${username.trim()} company=${company_code}`);
    res.status(201).json({ message: "User created" });
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return res.status(409).json({ error: "Username already exists in this company" });
    handleError(res, err, "POST /api/users");
  }
});

app.put("/api/users/:id", auth(["super_user", "admin"]), async (req, res) => {
  try {
    const user = await dbGet("SELECT * FROM users WHERE id=?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Not found" });
    if (req.user.role === "admin" && user.company_code !== req.user.companyCode)
      return res.status(403).json({ error: "Forbidden" });
    if (req.user.role === "admin" && req.body.role && req.body.role !== "user")
      return res.status(403).json({ error: "Admins cannot assign roles other than 'user'" });

    const { username, email, password } = req.body;
    if (password) {
      if (!isStrongPassword(password))
        return res.status(400).json({
          error: "Password must be ≥10 chars with uppercase, lowercase, number, and symbol.",
        });
      const hash = await bcrypt.hash(password, 12);
      await dbRun(
        "UPDATE users SET username=?, email=?, password_hash=?, must_change_password=1, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [username || user.username, email ?? user.email, hash, req.params.id]
      );
    } else {
      await dbRun(
        "UPDATE users SET username=?, email=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [username || user.username, email ?? user.email, req.params.id]
      );
    }
    logEvent("USER_UPDATED", req, `target_id=${req.params.id}`);
    res.json({ message: "User updated" });
  } catch (err) {
    handleError(res, err, "PUT /api/users/:id");
  }
});

app.delete("/api/users/:id", auth(["super_user", "admin"]), async (req, res) => {
  try {
    const user = await dbGet("SELECT * FROM users WHERE id=?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Not found" });
    if (req.user.role === "admin" && user.company_code !== req.user.companyCode)
      return res.status(403).json({ error: "Forbidden" });
    if (user.id === req.user.userId) return res.status(400).json({ error: "Cannot delete yourself" });
    await dbRun("DELETE FROM users WHERE id=?", [req.params.id]);
    logEvent("USER_DELETED", req, `target_id=${req.params.id} username=${user.username}`);
    res.json({ message: "User deleted" });
  } catch (err) {
    handleError(res, err, "DELETE /api/users/:id");
  }
});

// ── Report helpers ────────────────────────────────────────────────────────────

function extractMeta(state) {
  let clientName = "";
  try {
    const parts = [];
    for (const cl of state.clients || []) {
      if (cl.showPerson  && cl.person?.name)  parts.push(cl.person.name);
      if (cl.showCompany && cl.company?.name) parts.push(cl.company.name);
    }
    clientName = parts.join(" / ");
  } catch (_) {}
  return {
    report_type: state.reportType || "preliminary",
    bank:        state.bank       || "",
    branch:      state.branch     || "",
    visit_date:  state.visitDate  || "",
    report_date: state.reportDate || "",
    client_name: clientName,
  };
}

function scopeCompany(req) {
  if (req.user.role === "super_user")
    return req.query.company_code?.toUpperCase().trim() || null;
  return req.user.companyCode;
}

async function assertReportAccess(req, res, reportId) {
  const row = await dbGet("SELECT * FROM reports WHERE id = ?", [reportId]);
  if (!row) { res.status(404).json({ error: "Report not found" }); return null; }
  if (req.user.role !== "super_user" && row.company_code !== req.user.companyCode) {
    res.status(403).json({ error: "Forbidden" }); return null;
  }
  return row;
}

// ── Reports ───────────────────────────────────────────────────────────────────

app.get("/api/reports", auth(), async (req, res) => {
  try {
    const { bank, search } = req.query;
    const limit   = Math.min(Number(req.query.limit)  || 50, 200);
    const offset  = Math.max(Number(req.query.offset) || 0,  0);
    const company = scopeCompany(req);
    const params  = [];

    let sql = `SELECT id, filename, report_type, bank, branch, visit_date,
                      report_date, client_name, company_code, created_at, updated_at
               FROM reports WHERE 1=1`;

    if (company !== null) { sql += " AND company_code = ?"; params.push(company); }
    if (bank)   { sql += " AND bank = ?"; params.push(bank); }
    if (search) {
      sql += " AND (client_name LIKE ? OR bank LIKE ? OR branch LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countSql = sql.replace(
      /SELECT id, filename.*?FROM reports/s,
      "SELECT COUNT(*) as n FROM reports"
    );
    const countRow = await dbGet(countSql, params);
    const total = countRow?.n ?? 0;

    sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
    const rows = await dbAll(sql, [...params, limit, offset]);

    res.json({ reports: rows, total });
  } catch (err) {
    handleError(res, err, "GET /api/reports");
  }
});

app.get("/api/reports/:id", auth(), async (req, res) => {
  try {
    const row = await assertReportAccess(req, res, req.params.id);
    if (!row) return;
    res.json({ ...row, state: JSON.parse(row.state_json) });
  } catch (err) {
    handleError(res, err, "GET /api/reports/:id");
  }
});

app.post("/api/reports", auth(), express.json({ limit: "50mb" }), async (req, res) => {
  try {
    const { state, filename } = req.body;
    if (!state) return res.status(400).json({ error: "state is required" });
    const sanitized = deepSanitize(state);
    const meta = extractMeta(sanitized);
    const name = filename || `valuation-${Date.now()}.json`;
    const result = await dbRun(
      `INSERT INTO reports
        (filename, report_type, bank, branch, visit_date, report_date, client_name, company_code, created_by_user_id, state_json)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [name, meta.report_type, meta.bank, meta.branch, meta.visit_date, meta.report_date,
       meta.client_name, req.user.companyCode, req.user.userId, JSON.stringify(sanitized)]
    );
    res.status(201).json({ id: result.lastInsertRowid, message: "Report saved" });
  } catch (err) {
    handleError(res, err, "POST /api/reports");
  }
});

app.put("/api/reports/:id", auth(), express.json({ limit: "50mb" }), async (req, res) => {
  try {
    const { state, filename } = req.body;
    if (!state) return res.status(400).json({ error: "state is required" });

    const existing = await assertReportAccess(req, res, req.params.id);
    if (!existing) return;

    const prevVersion = await dbGet(
      "SELECT state_hash FROM report_versions WHERE report_id = ? ORDER BY id DESC LIMIT 1",
      [existing.id]
    );
    const prevHash  = prevVersion?.state_hash || "";
    const stateHash = hashVersionChain(existing.state_json, prevHash);

    await dbRun(
      `INSERT INTO report_versions (report_id, changed_by_id, state_json, state_hash) VALUES (?, ?, ?, ?)`,
      [existing.id, req.user.userId, existing.state_json, stateHash]
    );
    pruneReportVersions(existing.id); // keep only last 10 — fire and forget

    const sanitized = deepSanitize(state);
    const meta = extractMeta(sanitized);

    const isFinal = meta.report_type === "final";
    const hasPayment = isFinal && sanitized.amountReceived !== undefined;
    const amtReceived = hasPayment
      ? (parseFloat(sanitized.amountReceived) || null)
      : existing.amount_received ?? null;
    const receivedBy = hasPayment ? req.user.userId : existing.received_by_user_id ?? null;
    const receivedAt   = hasPayment ? (sanitized.receivedAt   || null) : existing.received_at   ?? null;
    const receivedBank = hasPayment ? (sanitized.receivedBank || null) : existing.received_bank ?? null;

    await dbRun(
      `UPDATE reports SET filename=?, report_type=?, bank=?, branch=?, visit_date=?,
        report_date=?, client_name=?, state_json=?, amount_received=?, received_by_user_id=?,
        received_at=?, received_bank=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [filename || existing.filename, meta.report_type, meta.bank, meta.branch, meta.visit_date,
       meta.report_date, meta.client_name, JSON.stringify(sanitized),
       amtReceived, receivedBy, receivedAt, receivedBank, req.params.id]
    );
    res.json({ message: "Report updated" });
  } catch (err) {
    handleError(res, err, "PUT /api/reports/:id");
  }
});

// ── Report edit history ───────────────────────────────────────────────────────
app.get("/api/reports/:id/versions", auth(["admin", "super_user"]), async (req, res) => {
  try {
    const existing = await assertReportAccess(req, res, req.params.id);
    if (!existing) return;
    const rows = await dbAll(
      `SELECT rv.id, rv.created_at, u.username AS edited_by, rv.state_json
       FROM report_versions rv
       LEFT JOIN users u ON u.id = rv.changed_by_id
       WHERE rv.report_id = ?
       ORDER BY rv.id DESC`,
      [req.params.id]
    );
    const versions = rows.map(rv => {
      let state = {};
      try { state = JSON.parse(rv.state_json || "{}"); } catch (_) {}
      const clientParts = [];
      for (const cl of state.clients || []) {
        if (cl.showPerson  && cl.person?.name)  clientParts.push(cl.person.name);
        if (cl.showCompany && cl.company?.name) clientParts.push(cl.company.name);
      }
      return {
        id:          rv.id,
        created_at:  rv.created_at,
        edited_by:   rv.edited_by,
        client_name: clientParts.join(" / ") || "",
        bank:        state.bank        || "",
        branch:      state.branch      || "",
        visit_date:  state.visitDate   || "",
        report_date: state.reportDate  || "",
        report_type: state.reportType  || "",
      };
    });
    res.json({ versions });
  } catch (err) {
    handleError(res, err, "GET /api/reports/:id/versions");
  }
});

// Single version state (no photos)
app.get("/api/reports/:id/versions/:vid", auth(["admin", "super_user"]), async (req, res) => {
  try {
    const existing = await assertReportAccess(req, res, req.params.id);
    if (!existing) return;
    const row = await dbGet(
      "SELECT state_json FROM report_versions WHERE id=? AND report_id=?",
      [req.params.vid, req.params.id]
    );
    if (!row) return res.status(404).json({ error: "Version not found" });
    let state = {};
    try { state = JSON.parse(row.state_json || "{}"); } catch (_) {}
    // strip photo blobs before sending
    function stripPhotos(obj) {
      if (!obj || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(stripPhotos);
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" && v.startsWith("data:image")) out[k] = "[photo]";
        else out[k] = stripPhotos(v);
      }
      return out;
    }
    res.json({ state: stripPhotos(state) });
  } catch (err) {
    handleError(res, err, "GET /api/reports/:id/versions/:vid");
  }
});

app.delete("/api/reports/:id", auth(["admin", "super_user"]), async (req, res) => {
  try {
    const existing = await assertReportAccess(req, res, req.params.id);
    if (!existing) return;
    await dbRun("DELETE FROM reports WHERE id = ?", [req.params.id]);
    logEvent("REPORT_DELETED", req, `report_id=${req.params.id} filename=${existing.filename}`);
    res.json({ message: "Report deleted" });
  } catch (err) {
    handleError(res, err, "DELETE /api/reports/:id");
  }
});

app.get("/api/banks", auth(), async (req, res) => {
  try {
    const company = scopeCompany(req);
    let sql = "SELECT DISTINCT bank FROM reports WHERE bank != ''";
    const params = [];
    if (company !== null) { sql += " AND company_code = ?"; params.push(company); }
    sql += " ORDER BY bank";
    const rows = await dbAll(sql, params);
    res.json(rows.map((r) => r.bank));
  } catch (err) {
    handleError(res, err, "GET /api/banks");
  }
});

// ── Print / download audit ────────────────────────────────────────────────────

app.post("/api/reports/:id/print", auth(), async (req, res) => {
  try {
    const row = await assertReportAccess(req, res, req.params.id);
    if (!row) return;
    const VALID_PRINT_TYPES = new Set(["preliminary", "final"]);
    const VALID_ACTIONS     = new Set(["print", "download"]);
    const print_type = VALID_PRINT_TYPES.has(req.body.print_type) ? req.body.print_type : "preliminary";
    const action     = VALID_ACTIONS.has(req.body.action)         ? req.body.action     : "print";
    await dbRun(
      `INSERT INTO report_prints (report_id, company_code, user_id, username, print_type, action)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, req.user.companyCode, req.user.userId, req.user.username, print_type, action]
    );
    res.json({ message: "Print recorded" });
  } catch (err) {
    handleError(res, err, "POST /api/reports/:id/print");
  }
});

// ── Admin report list ─────────────────────────────────────────────────────────

app.get("/api/admin/reports", auth(["admin", "super_user"]), async (req, res) => {
  try {
    const company = req.user.role === "super_user"
      ? (req.query.company_code?.toUpperCase().trim() || req.user.companyCode)
      : req.user.companyCode;

    const { search = "" } = req.query;
    const limit  = Math.min(Number(req.query.limit)  || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0,   0);
    const params = [company];

    let sql = `
      SELECT r.id, r.filename, r.report_type, r.bank, r.branch,
             r.visit_date, r.report_date, r.client_name,
             r.created_at, r.updated_at,
             r.amount_received, r.received_by_user_id, r.received_at,
             u.username AS created_by,
             ru.username AS received_by
      FROM reports r
      LEFT JOIN users u  ON u.id  = r.created_by_user_id
      LEFT JOIN users ru ON ru.id = r.received_by_user_id
      WHERE r.company_code = ?
    `;
    if (search) {
      sql += " AND (r.client_name LIKE ? OR r.bank LIKE ? OR r.branch LIKE ? OR u.username LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countSql = sql.replace(/SELECT r\.id.*?FROM reports r/s, "SELECT COUNT(*) as n FROM reports r");
    const countRow = await dbGet(countSql, params);
    const total    = countRow?.n ?? 0;

    sql += " ORDER BY r.updated_at DESC LIMIT ? OFFSET ?";
    const reports = await dbAll(sql, [...params, limit, offset]);

    const ids = reports.map((r) => r.id);
    let prints = [];
    if (ids.length > 0) {
      prints = await dbAll(
        `SELECT report_id, username, print_type, action, printed_at
         FROM report_prints
         WHERE report_id IN (${ids.map(() => "?").join(",")})
         ORDER BY printed_at ASC`,
        ids
      );
    }

    const printMap = {};
    for (const p of prints) {
      if (!printMap[p.report_id]) printMap[p.report_id] = [];
      printMap[p.report_id].push(p);
    }

    res.json({ reports: reports.map((r) => ({ ...r, prints: printMap[r.id] || [] })), total });
  } catch (err) {
    handleError(res, err, "GET /api/admin/reports");
  }
});

// ── Credit System ─────────────────────────────────────────────────────────────

const CREDIT_COST = { preliminary: 1, final: 2 };

// Helper: record a credit transaction
async function recordCreditTx(company_code, actor_id, actor_username, action, amount, balance_before, balance_after, report_id, report_type, note) {
  await dbRun(
    `INSERT INTO credit_transactions
       (company_code, actor_id, actor_username, action, amount, balance_before, balance_after, report_id, report_type, note)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [company_code, actor_id, actor_username, action, amount, balance_before, balance_after, report_id ?? null, report_type ?? null, note ?? ""]
  );
}

// Super Admin: assign / top-up credits for a company
app.post("/api/admin/credits/assign", auth(["super_user"]), express.json(), async (req, res) => {
  try {
    const { company_code, amount, expiry, note, low_threshold } = req.body;
    if (!company_code || typeof amount !== "number" || amount <= 0)
      return res.status(400).json({ error: "company_code and positive amount are required" });

    const company = await dbGet("SELECT credit_balance, company_name, contact_email FROM companies WHERE company_code=?", [company_code.toUpperCase()]);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const before = company.credit_balance || 0;
    const after  = before + amount;

    const updates = ["credit_balance = ?"];
    const params  = [after];
    if (expiry) { updates.push("credit_expiry = ?"); params.push(expiry); }
    if (typeof low_threshold === "number") { updates.push("credit_low_threshold = ?"); params.push(low_threshold); }
    params.push(company_code.toUpperCase());

    await dbRun(`UPDATE companies SET ${updates.join(", ")} WHERE company_code=?`, params);
    await recordCreditTx(company_code.toUpperCase(), req.user.userId, req.user.username, "assign", amount, before, after, null, null, note || `Assigned by super admin`);

    // Send credits notification email
    if (company.contact_email) {
      sendCreditsAssignedEmail(company.contact_email, company.company_name, company.company_name, amount, after, note || null);
    }

    res.json({ message: "Credits assigned", balance: after });
  } catch (err) { handleError(res, err, "POST /api/admin/credits/assign"); }
});

// Super Admin: get credit overview for all companies
app.get("/api/admin/credits", auth(["super_user"]), async (req, res) => {
  try {
    const companies = await dbAll(
      `SELECT company_code, company_name, credit_balance, credit_expiry, credit_low_threshold FROM companies ORDER BY company_name`
    );
    res.json({ companies });
  } catch (err) { handleError(res, err, "GET /api/admin/credits"); }
});

// Super Admin: credit transaction history for a company
app.get("/api/admin/credits/:company_code/history", auth(["super_user"]), async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT * FROM credit_transactions WHERE company_code=? ORDER BY created_at DESC LIMIT 200`,
      [req.params.company_code.toUpperCase()]
    );
    res.json({ transactions: rows });
  } catch (err) { handleError(res, err, "GET /api/admin/credits/:company_code/history"); }
});

// Company: get own credit balance + recent history
app.get("/api/credits", auth(["admin", "user"]), async (req, res) => {
  try {
    const company = await dbGet(
      "SELECT credit_balance, credit_expiry, credit_low_threshold FROM companies WHERE company_code=?",
      [req.user.companyCode]
    );
    const history = await dbAll(
      `SELECT id, actor_username, action, amount, balance_before, balance_after, report_id, report_type, note, created_at
       FROM credit_transactions WHERE company_code=? ORDER BY created_at DESC LIMIT 50`,
      [req.user.companyCode]
    );
    res.json({
      balance:       company?.credit_balance       ?? 0,
      expiry:        company?.credit_expiry         ?? null,
      low_threshold: company?.credit_low_threshold  ?? 5,
      history,
    });
  } catch (err) { handleError(res, err, "GET /api/credits"); }
});

// Deduct credits before printing — atomic with SQLite serialisation
app.post("/api/credits/deduct", auth(["admin", "user"]), express.json(), async (req, res) => {
  try {
    const { report_id, report_type } = req.body;
    const type = ["preliminary", "final"].includes(report_type) ? report_type : "preliminary";
    const cost = CREDIT_COST[type];

    // Atomic read-check-update using SQLite serialisation
    const company = await dbGet(
      "SELECT credit_balance, credit_expiry FROM companies WHERE company_code=?",
      [req.user.companyCode]
    );
    if (!company) return res.status(404).json({ error: "Company not found" });

    // Check expiry
    if (company.credit_expiry && new Date(company.credit_expiry) < new Date()) {
      return res.status(402).json({ error: "Your credit package has expired. Please contact the Super Admin to renew." });
    }

    const before = company.credit_balance || 0;
    if (before < cost) {
      return res.status(402).json({
        error: `Insufficient credits. This action requires ${cost} credit(s) but your balance is ${before}. Please contact the Super Admin.`,
        balance: before, required: cost,
      });
    }

    const after = before - cost;
    // Use a conditional UPDATE to guard against race conditions
    const result = await dbRun(
      "UPDATE companies SET credit_balance=? WHERE company_code=? AND credit_balance=?",
      [after, req.user.companyCode, before]
    );

    if (result.changes === 0) {
      // Another concurrent request changed the balance — retry is safe, tell client
      return res.status(409).json({ error: "Credit balance changed concurrently. Please try again." });
    }

    await recordCreditTx(
      req.user.companyCode, req.user.userId, req.user.username,
      "deduct", cost, before, after, report_id ?? null, type,
      `Print ${type} report`
    );

    // Also record in report_prints if report_id provided
    if (report_id) {
      await dbRun(
        `INSERT INTO report_prints (report_id, company_code, user_id, username, print_type, action) VALUES (?,?,?,?,?,?)`,
        [report_id, req.user.companyCode, req.user.userId, req.user.username, type, "print"]
      ).catch(() => {});
    }

    res.json({ message: "Credits deducted", balance: after, cost, report_type: type });
  } catch (err) { handleError(res, err, "POST /api/credits/deduct"); }
});

// ── Email (Resend via SMTP or fallback to custom SMTP) ───────────────────────
let mailer = null;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_NAME  = process.env.EMAIL_FROM_NAME  || "One Degree Consultant";
const FROM_EMAIL = process.env.EMAIL_FROM       || "noreply@onedegree.com.np";

if (RESEND_API_KEY) {
  // Resend SMTP bridge
  mailer = nodemailer.createTransport({
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: { user: "resend", pass: RESEND_API_KEY },
  });
  console.log("✉️  Email: using Resend SMTP");
} else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  console.log("✉️  Email: using custom SMTP");
} else {
  console.warn("⚠️  Email not configured — set RESEND_API_KEY in .env");
}

function emailFrom() {
  return `"${FROM_NAME}" <${FROM_EMAIL}>`;
}

// ── Registration emails ───────────────────────────────────────────────────────

async function sendRegistrationReceivedEmail(toEmail, contactName, companyName) {
  if (!mailer || !toEmail) return false;
  try {
    await mailer.sendMail({
      from: emailFrom(),
      to: toEmail,
      subject: "Registration Request Received — Valuation System",
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e0e4ea;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#0f1f3d 0%,#1a3a6b 100%);padding:32px 36px;color:#fff">
            <div style="font-size:36px;margin-bottom:10px">📋</div>
            <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.3px">Registration Request Received</h1>
            <p style="margin:6px 0 0;opacity:0.65;font-size:13px">One Degree Consultant Pvt. Ltd. — Valuation System</p>
          </div>
          <!-- Body -->
          <div style="padding:32px 36px">
            <p style="font-size:15px;color:#1a202c;margin:0 0 14px;line-height:1.6">
              Dear <strong>${contactName}</strong>,
            </p>
            <p style="font-size:14px;color:#4a5568;line-height:1.7;margin:0 0 20px">
              Thank you for registering <strong>${companyName}</strong> on the Valuation System. We have received your request and our team is currently reviewing it.
            </p>
            <!-- Status box -->
            <div style="background:#f0f4ff;border-radius:10px;padding:18px 22px;margin:0 0 22px;border-left:4px solid #1a73e8">
              <div style="font-size:11px;font-weight:800;color:#1a73e8;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">What happens next?</div>
              <ol style="margin:0;padding-left:18px;font-size:13px;color:#2d3748;line-height:1.9">
                <li>Our team reviews your registration details</li>
                <li>We create your company account and admin credentials</li>
                <li>You'll receive a confirmation email with your login details</li>
              </ol>
            </div>
            <p style="font-size:13px;color:#718096;line-height:1.6;margin:0 0 24px">
              This process typically takes <strong>less than 24 hours</strong>. If you have any questions, feel free to reply to this email.
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#a0aec0">
                  <strong style="color:#4a5568">One Degree Consultant Pvt. Ltd.</strong><br>
                  Property Valuation Management System<br>
                  <a href="mailto:onedegreeconsultant@gmail.com" style="color:#1a73e8;text-decoration:none">onedegreeconsultant@gmail.com</a>
                  &nbsp;·&nbsp; 9841357433
                </td>
                <td align="right" style="font-size:22px">🏢</td>
              </tr>
            </table>
          </div>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Registration received email failed:", e.message);
    return false;
  }
}

async function sendRegistrationApprovedEmail(toEmail, contactName, companyName, companyCode, adminUsername) {
  if (!mailer || !toEmail) return false;
  try {
    await mailer.sendMail({
      from: emailFrom(),
      to: toEmail,
      subject: `✅ Your Account is Ready — ${companyName}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e0e4ea;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#1a5c3a 0%,#27ae60 100%);padding:32px 36px;color:#fff">
            <div style="font-size:36px;margin-bottom:10px">🎉</div>
            <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.3px">Your Account is Ready!</h1>
            <p style="margin:6px 0 0;opacity:0.75;font-size:13px">One Degree Consultant Pvt. Ltd. — Valuation System</p>
          </div>
          <!-- Body -->
          <div style="padding:32px 36px">
            <p style="font-size:15px;color:#1a202c;margin:0 0 14px;line-height:1.6">
              Dear <strong>${contactName}</strong>,
            </p>
            <p style="font-size:14px;color:#4a5568;line-height:1.7;margin:0 0 22px">
              Great news! Your registration for <strong>${companyName}</strong> has been <strong style="color:#27ae60">approved</strong>. Your company account has been created on the Valuation System and is ready to use.
            </p>

            <!-- Login credentials box -->
            <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;padding:22px 26px;margin:0 0 24px;border:1.5px solid #86efac">
              <div style="font-size:11px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:14px">🔑 Your Login Credentials</div>
              <table cellpadding="0" cellspacing="0" style="width:100%">
                <tr>
                  <td style="font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.4px;padding:5px 0;width:40%">Company Code</td>
                  <td style="font-size:15px;font-weight:800;color:#0f1f3d;font-family:monospace;padding:5px 0">${companyCode}</td>
                </tr>
                <tr>
                  <td style="font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.4px;padding:5px 0">Username</td>
                  <td style="font-size:15px;font-weight:800;color:#0f1f3d;font-family:monospace;padding:5px 0">${adminUsername}</td>
                </tr>
                <tr>
                  <td style="font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.4px;padding:5px 0">Password</td>
                  <td style="font-size:13px;color:#4a5568;padding:5px 0">
                    <em>You'll be asked to set a new password on first login</em>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Steps -->
            <div style="background:#f8fafc;border-radius:10px;padding:18px 22px;margin:0 0 22px;border-left:4px solid #0f1f3d">
              <div style="font-size:11px;font-weight:800;color:#0f1f3d;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px">Getting started</div>
              <ol style="margin:0;padding-left:18px;font-size:13px;color:#2d3748;line-height:2">
                <li>Visit the Valuation System login page</li>
                <li>Enter your <strong>Company Code</strong> and <strong>Username</strong> above</li>
                <li>Use the temporary password provided by the admin</li>
                <li>You'll be prompted to set a secure new password immediately</li>
              </ol>
            </div>

            <p style="font-size:13px;color:#718096;line-height:1.6;margin:0 0 24px">
              As the admin of your company account you can add users, manage reports, and configure your company settings. If you need any help, don't hesitate to contact us.
            </p>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#a0aec0">
                  <strong style="color:#4a5568">One Degree Consultant Pvt. Ltd.</strong><br>
                  Property Valuation Management System<br>
                  <a href="mailto:onedegreeconsultant@gmail.com" style="color:#1a73e8;text-decoration:none">onedegreeconsultant@gmail.com</a>
                  &nbsp;·&nbsp; 9841357433
                </td>
                <td align="right" style="font-size:22px">🏢</td>
              </tr>
            </table>
          </div>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Registration approved email failed:", e.message);
    return false;
  }
}

async function sendFeedbackApprovalEmail(toEmail, toName, feedbackMessage) {
  if (!mailer || !toEmail) return false;
  try {
    await mailer.sendMail({
      from: emailFrom(),
      to: toEmail,
      subject: "Thank You for Your Feedback — 1 Credit Awarded!",
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0e4ea">
          <div style="background:linear-gradient(135deg,#0f1f3d,#1a3a6b);padding:28px 32px;color:#fff">
            <div style="font-size:28px;margin-bottom:8px">🎉</div>
            <h1 style="margin:0;font-size:22px;font-weight:700">Thank You for Your Feedback!</h1>
            <p style="margin:6px 0 0;opacity:0.8;font-size:13px">One Degree Consultant Pvt. Ltd.</p>
          </div>
          <div style="padding:28px 32px">
            <p style="font-size:15px;color:#2c3e50;line-height:1.6">Dear <strong>${toName}</strong>,</p>
            <p style="font-size:14px;color:#5f6b7a;line-height:1.7">
              We have reviewed and approved your feedback. Thank you for taking the time to share your thoughts — your input helps us improve our platform.
            </p>
            <div style="background:#f4f6fa;border-radius:10px;padding:16px 20px;margin:20px 0;border-left:4px solid #1a73e8">
              <div style="font-size:11px;font-weight:700;color:#7f8c8d;text-transform:uppercase;margin-bottom:6px">Your Feedback</div>
              <p style="margin:0;font-size:13px;color:#2c3e50;font-style:italic">"${feedbackMessage}"</p>
            </div>
            <div style="background:linear-gradient(135deg,#27ae60,#1a7a3f);border-radius:10px;padding:16px 22px;display:flex;align-items:center;gap:14px;margin:20px 0">
              <span style="font-size:32px">🪙</span>
              <div style="color:#fff">
                <div style="font-weight:700;font-size:16px">1 Credit Awarded</div>
                <div style="font-size:12px;opacity:0.85;margin-top:2px">Added to your company's credit balance</div>
              </div>
            </div>
            <p style="font-size:13px;color:#7f8c8d;line-height:1.6">
              You can use this credit to generate reports on the platform. Keep the feedback coming!
            </p>
            <hr style="border:none;border-top:1px solid #e0e4ea;margin:24px 0">
            <p style="font-size:12px;color:#aaa;margin:0">
              One Degree Consultant Pvt. Ltd. &nbsp;|&nbsp;
              <a href="mailto:onedegreeconsultant@gmail.com" style="color:#1a73e8;text-decoration:none">onedegreeconsultant@gmail.com</a> &nbsp;|&nbsp;
              9841357433
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Email send failed:", e.message);
    return false;
  }
}

// ── Credits assigned email ────────────────────────────────────────────────────
async function sendCreditsAssignedEmail(toEmail, contactName, companyName, creditsAdded, newBalance, note) {
  if (!mailer || !toEmail) return false;
  try {
    await mailer.sendMail({
      from: emailFrom(),
      to: toEmail,
      subject: `🪙 ${creditsAdded} Credits Added — ${companyName}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e0e4ea;box-shadow:0 4px 24px rgba(0,0,0,0.07)">
          <div style="background:linear-gradient(135deg,#1a5c3a 0%,#27ae60 100%);padding:30px 34px;color:#fff">
            <div style="font-size:36px;margin-bottom:8px">🪙</div>
            <h1 style="margin:0;font-size:21px;font-weight:800">Credits Added to Your Account</h1>
            <p style="margin:6px 0 0;opacity:0.75;font-size:13px">One Degree Consultant Pvt. Ltd. — Valuation System</p>
          </div>
          <div style="padding:30px 34px">
            <p style="font-size:15px;color:#1a202c;margin:0 0 14px;line-height:1.6">Dear <strong>${contactName || companyName}</strong>,</p>
            <p style="font-size:14px;color:#4a5568;line-height:1.7;margin:0 0 22px">
              We are pleased to inform you that <strong>${creditsAdded} credit${creditsAdded !== 1 ? "s" : ""}</strong> have been added to your company account <strong>${companyName}</strong>.
            </p>
            <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;padding:22px 26px;margin:0 0 22px;border:1.5px solid #86efac;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:11px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">Credits Added</div>
                <div style="font-size:32px;font-weight:900;color:#15803d">+${creditsAdded}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:11px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">New Balance</div>
                <div style="font-size:28px;font-weight:900;color:#0f1f3d">${newBalance}</div>
              </div>
            </div>
            ${note ? `<div style="background:#f8fafc;border-radius:8px;padding:14px 18px;margin:0 0 20px;border-left:4px solid #1a73e8;font-size:13px;color:#2d3748"><strong>Note from admin:</strong> ${note}</div>` : ""}
            <p style="font-size:13px;color:#718096;line-height:1.6;margin:0 0 24px">
              Each credit allows you to generate one valuation report. Log in to your dashboard to use your credits.
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px">
            <p style="font-size:12px;color:#a0aec0;margin:0">
              <strong style="color:#4a5568">One Degree Consultant Pvt. Ltd.</strong><br>
              <a href="mailto:onedegreeconsultant@gmail.com" style="color:#1a73e8;text-decoration:none">onedegreeconsultant@gmail.com</a> &nbsp;·&nbsp; 9841357433
            </p>
          </div>
        </div>`,
    });
    return true;
  } catch (e) {
    console.error("Credits email failed:", e.message);
    return false;
  }
}

// ── Test email (super admin only) ─────────────────────────────────────────────
app.post("/api/admin/email/test", auth(["super_user"]), express.json(), async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: "to email is required" });
    if (!mailer) return res.status(503).json({ error: "Email not configured — set RESEND_API_KEY in Railway environment variables" });
    await mailer.sendMail({
      from: emailFrom(),
      to,
      subject: "✅ Test Email — One Degree Consultant Valuation System",
      html: `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;border:1px solid #e0e4ea">
        <div style="font-size:40px;text-align:center;margin-bottom:16px">✅</div>
        <h2 style="text-align:center;color:#0f1f3d;margin:0 0 12px">Email System Working!</h2>
        <p style="color:#4a5568;text-align:center;font-size:14px;line-height:1.7">
          This is a test email from <strong>One Degree Consultant Pvt. Ltd.</strong> Valuation System.<br/>
          If you received this, your email configuration is correct.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="font-size:11px;color:#aaa;text-align:center">Sent from: ${emailFrom()}</p>
      </div>`,
    });
    res.json({ message: "Test email sent to " + to });
  } catch (err) {
    res.status(500).json({ error: "Failed: " + (err.message || String(err)) });
  }
});

// ── Mass email (super admin broadcast) ────────────────────────────────────────
app.post("/api/admin/email/broadcast", auth(["super_user"]), express.json(), async (req, res) => {
  try {
    const { subject, html, target } = req.body;
    if (!subject || !html) return res.status(400).json({ error: "subject and html are required" });
    if (!mailer) return res.status(503).json({ error: "Email not configured — set RESEND_API_KEY in server environment" });

    // Get all company admin emails
    let companies;
    if (target === "all") {
      companies = await dbAll("SELECT company_name, contact_email FROM companies WHERE contact_email != '' AND contact_email IS NOT NULL");
    } else {
      companies = await dbAll("SELECT company_name, contact_email FROM companies WHERE company_code=? AND contact_email != ''", [target]);
    }
    if (!companies.length) return res.status(404).json({ error: "No email recipients found" });

    let sent = 0; let failed = 0;
    for (const co of companies) {
      try {
        await mailer.sendMail({ from: emailFrom(), to: co.contact_email, subject, html });
        sent++;
      } catch (_) { failed++; }
    }
    res.json({ message: `Broadcast complete`, sent, failed, total: companies.length });
  } catch (err) { handleError(res, err, "POST /api/admin/email/broadcast"); }
});

// ── Feedback ──────────────────────────────────────────────────────────────────

// Submit feedback (admin/user)
// 10 MB body limit for feedback (screenshot may be base64)
app.post("/api/feedback", auth(["admin", "user"]), express.json({ limit: "10mb" }), async (req, res) => {
  try {
    const { message, screenshot } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Feedback message is required." });
    // Validate screenshot is a base64 image if provided
    const shot = screenshot && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(screenshot) ? screenshot : "";
    const user = await dbGet("SELECT email FROM users WHERE id=?", [req.user.userId]);
    const result = await dbRun(
      `INSERT INTO feedback (company_code, user_id, username, user_email, message, screenshot) VALUES (?,?,?,?,?,?)`,
      [req.user.companyCode, req.user.userId, req.user.username, user?.email || "", message.trim(), shot]
    );
    res.json({ message: "Feedback submitted. You will earn 1 credit once approved.", id: result.lastInsertRowid });
  } catch (err) { handleError(res, err, "POST /api/feedback"); }
});

// Get feedback — role-scoped (list view strips large screenshot field)
app.get("/api/feedback", auth(["admin", "user"]), async (req, res) => {
  try {
    let sql, params;
    if (req.user.role === "admin") {
      sql = "SELECT id,company_code,user_id,username,user_email,message,status,credit_awarded,approved_by,approved_at,rejection_note,email_sent,created_at, CASE WHEN screenshot!='' THEN 1 ELSE 0 END as has_screenshot FROM feedback WHERE company_code=? ORDER BY created_at DESC";
      params = [req.user.companyCode];
    } else {
      sql = "SELECT id,company_code,user_id,username,user_email,message,status,credit_awarded,approved_by,approved_at,rejection_note,email_sent,created_at, CASE WHEN screenshot!='' THEN 1 ELSE 0 END as has_screenshot FROM feedback WHERE user_id=? ORDER BY created_at DESC";
      params = [req.user.userId];
    }
    const rows = await dbAll(sql, params);
    res.json({ feedback: rows });
  } catch (err) { handleError(res, err, "GET /api/feedback"); }
});

// Get single feedback with screenshot (own or admin)
app.get("/api/feedback/:id", auth(["admin", "user"]), async (req, res) => {
  try {
    const fb = await dbGet("SELECT * FROM feedback WHERE id=?", [req.params.id]);
    if (!fb) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && fb.user_id !== req.user.userId) return res.status(403).json({ error: "Forbidden" });
    if (req.user.role === "admin" && fb.company_code !== req.user.companyCode) return res.status(403).json({ error: "Forbidden" });
    res.json(fb);
  } catch (err) { handleError(res, err, "GET /api/feedback/:id"); }
});

// Super Admin: all feedback across companies (list — no screenshot blob)
app.get("/api/admin/feedback", auth(["super_user"]), async (req, res) => {
  try {
    const { company_code, status } = req.query;
    let sql = `SELECT f.id,f.company_code,f.user_id,f.username,f.user_email,f.message,f.status,
      f.credit_awarded,f.approved_by,f.approved_at,f.rejection_note,f.email_sent,f.created_at,
      CASE WHEN f.screenshot!='' THEN 1 ELSE 0 END as has_screenshot,
      c.company_name FROM feedback f LEFT JOIN companies c ON f.company_code=c.company_code WHERE 1=1`;
    const params = [];
    if (company_code) { sql += " AND f.company_code=?"; params.push(company_code.toUpperCase().trim()); }
    if (status)       { sql += " AND f.status=?";       params.push(status); }
    sql += " ORDER BY f.created_at DESC";
    const rows = await dbAll(sql, params);
    const stats = {
      total:    rows.length,
      pending:  rows.filter(r => r.status === "pending").length,
      approved: rows.filter(r => r.status === "approved").length,
      rejected: rows.filter(r => r.status === "rejected").length,
      credited: rows.filter(r => r.credit_awarded).length,
    };
    res.json({ feedback: rows, stats });
  } catch (err) { handleError(res, err, "GET /api/admin/feedback"); }
});

// Super Admin: get single feedback WITH screenshot
app.get("/api/admin/feedback/:id", auth(["super_user"]), async (req, res) => {
  try {
    const fb = await dbGet(
      "SELECT f.*, c.company_name FROM feedback f LEFT JOIN companies c ON f.company_code=c.company_code WHERE f.id=?",
      [req.params.id]
    );
    if (!fb) return res.status(404).json({ error: "Not found" });
    res.json(fb);
  } catch (err) { handleError(res, err, "GET /api/admin/feedback/:id"); }
});

// Super Admin: approve feedback — grant 1 credit + email
app.put("/api/admin/feedback/:id/approve", auth(["super_user"]), express.json(), async (req, res) => {
  try {
    const fb = await dbGet("SELECT * FROM feedback WHERE id=?", [req.params.id]);
    if (!fb) return res.status(404).json({ error: "Feedback not found" });
    if (fb.status !== "pending") return res.status(409).json({ error: `Feedback is already ${fb.status}.` });

    // Mark approved
    await dbRun(
      "UPDATE feedback SET status='approved', approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE id=?",
      [req.user.username, req.params.id]
    );

    // Award 1 credit to the company
    const company = await dbGet("SELECT credit_balance FROM companies WHERE company_code=?", [fb.company_code]);
    const before = company?.credit_balance || 0;
    const after  = before + 1;
    await dbRun("UPDATE companies SET credit_balance=? WHERE company_code=?", [after, fb.company_code]);
    await recordCreditTx(
      fb.company_code, fb.user_id, fb.username,
      "assign", 1, before, after, null, null,
      `Feedback #${fb.id} approved by ${req.user.username}`
    );
    await dbRun("UPDATE feedback SET credit_awarded=1 WHERE id=?", [req.params.id]);

    // Send email
    const emailSent = await sendFeedbackApprovalEmail(fb.user_email, fb.username, fb.message);
    if (emailSent) await dbRun("UPDATE feedback SET email_sent=1 WHERE id=?", [req.params.id]);

    res.json({ message: "Feedback approved, credit awarded, email sent.", credit_awarded: true, email_sent: emailSent });
  } catch (err) { handleError(res, err, "PUT /api/admin/feedback/:id/approve"); }
});

// Super Admin: reject feedback
app.put("/api/admin/feedback/:id/reject", auth(["super_user"]), express.json(), async (req, res) => {
  try {
    const { rejection_note } = req.body;
    const fb = await dbGet("SELECT * FROM feedback WHERE id=?", [req.params.id]);
    if (!fb) return res.status(404).json({ error: "Feedback not found" });
    if (fb.status !== "pending") return res.status(409).json({ error: `Feedback is already ${fb.status}.` });
    await dbRun(
      "UPDATE feedback SET status='rejected', approved_by=?, approved_at=CURRENT_TIMESTAMP, rejection_note=? WHERE id=?",
      [req.user.username, rejection_note?.trim() || "", req.params.id]
    );
    res.json({ message: "Feedback rejected." });
  } catch (err) { handleError(res, err, "PUT /api/admin/feedback/:id/reject"); }
});

// ── Rate Map ──────────────────────────────────────────────────────────────────

const DEFAULT_RATE_MAP_SETTINGS = {
  free_trial_seconds: 30,
  durations: [
    { minutes: 10, credits: 3 },
    { minutes: 15, credits: 5 },
  ],
};

async function getRateMapSettings() {
  try {
    const row = await dbGet("SELECT value FROM system_settings WHERE key='rate_map_settings'");
    return row ? { ...DEFAULT_RATE_MAP_SETTINGS, ...JSON.parse(row.value) } : DEFAULT_RATE_MAP_SETTINGS;
  } catch { return DEFAULT_RATE_MAP_SETTINGS; }
}

// Super Admin: get rate map settings
app.get("/api/admin/rate-map/settings", auth(["super_user"]), async (req, res) => {
  try { res.json(await getRateMapSettings()); }
  catch (err) { handleError(res, err, "GET /api/admin/rate-map/settings"); }
});

// Super Admin: update rate map settings
app.put("/api/admin/rate-map/settings", auth(["super_user"]), express.json(), async (req, res) => {
  try {
    const current = await getRateMapSettings();
    const updated = { ...current };
    if (typeof req.body.free_trial_seconds === "number") updated.free_trial_seconds = req.body.free_trial_seconds;
    if (Array.isArray(req.body.durations) && req.body.durations.length > 0) updated.durations = req.body.durations;
    await dbRun(
      "INSERT INTO system_settings (key,value,updated_at) VALUES ('rate_map_settings',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP",
      [JSON.stringify(updated)]
    );
    res.json(updated);
  } catch (err) { handleError(res, err, "PUT /api/admin/rate-map/settings"); }
});

// Super Admin: toggle free access per company
app.put("/api/admin/rate-map/free-access", auth(["super_user"]), express.json(), async (req, res) => {
  try {
    const { company_code, free } = req.body;
    if (!company_code) return res.status(400).json({ error: "company_code required" });
    await dbRun(
      "UPDATE companies SET rate_map_free=? WHERE company_code=?",
      [free ? 1 : 0, company_code.toUpperCase().trim()]
    );
    res.json({ message: "Updated" });
  } catch (err) { handleError(res, err, "PUT /api/admin/rate-map/free-access"); }
});

// Super Admin: bulk enable/revoke free access for ALL companies
app.put("/api/admin/rate-map/free-access/all", auth(["super_user"]), express.json(), async (req, res) => {
  try {
    const { free } = req.body;
    await dbRun("UPDATE companies SET rate_map_free=?", [free ? 1 : 0]);
    res.json({ message: free ? "Free access enabled for all companies" : "Free access revoked for all companies" });
  } catch (err) { handleError(res, err, "PUT /api/admin/rate-map/free-access/all"); }
});

// Super Admin: list companies with rate_map_free status
app.get("/api/admin/rate-map/free-access", auth(["super_user"]), async (req, res) => {
  try {
    const companies = await dbAll("SELECT company_code, company_name, rate_map_free FROM companies ORDER BY company_name");
    res.json({ companies });
  } catch (err) { handleError(res, err, "GET /api/admin/rate-map/free-access"); }
});

// Company: get access status (free flag + active session + settings)
app.get("/api/rate-map/access", auth(["admin", "user"]), async (req, res) => {
  try {
    const [company, settings] = await Promise.all([
      dbGet("SELECT rate_map_free, credit_balance, credit_expiry FROM companies WHERE company_code=?", [req.user.companyCode]),
      getRateMapSettings(),
    ]);
    const now = new Date().toISOString();
    const session = await dbGet(
      "SELECT id, duration_minutes, credits_used, expires_at FROM rate_map_sessions WHERE company_code=? AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
      [req.user.companyCode, now]
    );
    res.json({
      free:            !!(company?.rate_map_free),
      balance:         company?.credit_balance ?? 0,
      credit_expiry:   company?.credit_expiry ?? null,
      active_session:  session || null,
      settings,
    });
  } catch (err) { handleError(res, err, "GET /api/rate-map/access"); }
});

// Company: public settings (durations + trial) — no auth for the gate dialog pre-login
app.get("/api/rate-map/settings", auth(["admin", "user"]), async (req, res) => {
  try { res.json(await getRateMapSettings()); }
  catch (err) { handleError(res, err, "GET /api/rate-map/settings"); }
});

// Company: start a timed session (deduct credits unless free or free-trial)
app.post("/api/rate-map/session", auth(["admin", "user"]), express.json(), async (req, res) => {
  try {
    const settings = await getRateMapSettings();
    const { duration_minutes, free_trial } = req.body;

    const company = await dbGet(
      "SELECT rate_map_free, credit_balance, credit_expiry FROM companies WHERE company_code=?",
      [req.user.companyCode]
    );
    if (!company) return res.status(404).json({ error: "Company not found" });

    // Check for already-active session
    const now = new Date().toISOString();
    const existing = await dbGet(
      "SELECT expires_at FROM rate_map_sessions WHERE company_code=? AND expires_at > ? LIMIT 1",
      [req.user.companyCode, now]
    );
    if (existing) return res.status(409).json({ error: "Active session already running", expires_at: existing.expires_at });

    // Free trial: no credits deducted, short duration
    if (free_trial) {
      const trialSecs = settings.free_trial_seconds || 30;
      const expires_at = new Date(Date.now() + trialSecs * 1000).toISOString();
      await dbRun(
        "INSERT INTO rate_map_sessions (company_code, user_id, username, duration_minutes, credits_used, expires_at) VALUES (?,?,?,?,?,?)",
        [req.user.companyCode, req.user.userId, req.user.username, 0, 0, expires_at]
      );
      return res.json({ message: "Trial started", expires_at, credits_used: 0, free: true, trial: true, trial_seconds: trialSecs });
    }

    const validDurations = settings.durations.map(d => d.minutes);
    const dur = validDurations.includes(Number(duration_minutes)) ? Number(duration_minutes) : validDurations[0];
    const durSetting = settings.durations.find(d => d.minutes === dur);
    const cost = durSetting?.credits ?? 3;

    let credits_used = 0;
    if (!company.rate_map_free) {
      if (company.credit_expiry && new Date(company.credit_expiry) < new Date()) {
        return res.status(402).json({ error: "Your credit package has expired. Contact Super Admin." });
      }
      const before = company.credit_balance || 0;
      if (before < cost) {
        return res.status(402).json({ error: `Insufficient credits. Need ${cost}, have ${before}.`, balance: before, required: cost });
      }
      const after = before - cost;
      const result = await dbRun(
        "UPDATE companies SET credit_balance=? WHERE company_code=? AND credit_balance=?",
        [after, req.user.companyCode, before]
      );
      if (result.changes === 0) return res.status(409).json({ error: "Balance changed concurrently, please try again." });

      await recordCreditTx(
        req.user.companyCode, req.user.userId, req.user.username,
        "deduct", cost, before, after, null, null,
        `Rate Map access — ${dur} min`
      );
      credits_used = cost;
    }

    const expires_at = new Date(Date.now() + dur * 60 * 1000).toISOString();
    await dbRun(
      "INSERT INTO rate_map_sessions (company_code, user_id, username, duration_minutes, credits_used, expires_at) VALUES (?,?,?,?,?,?)",
      [req.user.companyCode, req.user.userId, req.user.username, dur, credits_used, expires_at]
    );

    res.json({ message: "Session started", expires_at, credits_used, free: !!company.rate_map_free });
  } catch (err) { handleError(res, err, "POST /api/rate-map/session"); }
});

// Helper: extract rate points from a set of report rows
function extractRatePoints(rows, ownCode) {
  const points = [];
  for (const row of rows) {
    let state;
    try { state = JSON.parse(row.state_json); } catch { continue; }
    const properties = state.properties || [];
    const rates      = state.rates || {};
    const roadAccess = state.roadAccess || {};
    const govValues  = state.govValues || {};

    for (const prop of properties) {
      const lat = parseFloat(prop.lat);
      const lng = parseFloat(prop.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      const r      = rates[prop.id] || {};
      const splits = (state.plotRateSplits || {})[prop.id] || [];
      let fmvRate = 0, commercialRate = 0;
      if (splits.length > 0) {
        let totalArea = 0, totalFmv = 0, totalComm = 0;
        for (const sp of splits) {
          const a = parseFloat(sp.areaSqm) || 0;
          const cw = parseFloat(sp.commercialWeight) ?? 70;
          const gw = parseFloat(sp.govWeight) ?? 30;
          const cr = parseFloat(sp.commercialRate) || 0;
          const gr = parseFloat(sp.govRate) || 0;
          totalFmv  += ((cr * cw + gr * gw) / 100) * a;
          totalComm += cr * a;
          totalArea += a;
        }
        if (totalArea > 0) { fmvRate = totalFmv / totalArea; commercialRate = totalComm / totalArea; }
      } else {
        const cw = parseFloat(r.commercialWeight) ?? 70;
        const gw = parseFloat(r.govWeight) ?? 30;
        const cr = parseFloat(r.commercialRate) || 0;
        const gr = parseFloat(r.govRate) || 0;
        fmvRate = (cr * cw + gr * gw) / 100;
        commercialRate = cr;
      }
      const roads = roadAccess[prop.id] || [];
      const maxRoadWidth = roads.reduce((max, rd) => {
        const w = parseFloat(rd.widthField) || parseFloat(rd.widthTrace) || 0;
        return w > max ? w : max;
      }, 0);

      points.push({
        lat, lng,
        isOwn:         row.company_code === ownCode,
        plotNo:        prop.plotNo || "",
        traceSheetNo:  prop.traceSheetNo || "",
        fieldVisitDate: state.fieldVisitDate || state.reportDate || "",
        marketRate:    Math.round(commercialRate),
        govRate:       parseFloat(govValues[prop.id]) || parseFloat(r.govRate) || 0,
        roadType:      roads.map(rd => rd.roadType).filter(Boolean).join(", ") || prop.roadType || "",
        roadWidth:     maxRoadWidth,
        hazard:        prop.hazard || state.hazardNotes || prop.hazardNotes || "",
        fmvRate:       Math.round(fmvRate),
      });
    }
  }
  return points;
}

// Company: get all rate map points (own + others) — requires active session or free access
app.get("/api/rate-map/points", auth(["admin", "user"]), async (req, res) => {
  try {
    const company = await dbGet("SELECT rate_map_free FROM companies WHERE company_code=?", [req.user.companyCode]);
    if (!company?.rate_map_free) {
      const now = new Date().toISOString();
      const session = await dbGet(
        "SELECT id FROM rate_map_sessions WHERE company_code=? AND expires_at > ? LIMIT 1",
        [req.user.companyCode, now]
      );
      if (!session) return res.status(403).json({ error: "No active rate map session. Please start a session first." });
    }

    const rows = await dbAll("SELECT id, company_code, state_json FROM reports WHERE company_code != ''");
    const points = extractRatePoints(rows, req.user.companyCode);
    res.json({ points, total: points.length });
  } catch (err) { handleError(res, err, "GET /api/rate-map/points"); }
});

// Own company report GPS points — no session gate, own data only
app.get("/api/rate-map/own-points", auth(["admin", "user"]), async (req, res) => {
  try {
    const rows = await dbAll(
      "SELECT id, company_code, state_json FROM reports WHERE company_code=?",
      [req.user.companyCode]
    );
    const points = extractRatePoints(rows, req.user.companyCode);
    res.json({ points, total: points.length });
  } catch (err) { handleError(res, err, "GET /api/rate-map/own-points"); }
});

// ── Registration Requests ─────────────────────────────────────────────────────

// Public — anyone can submit a registration request
app.post("/api/register", express.json(), async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, message } = req.body || {};
    if (!company_name?.trim() || !contact_name?.trim() || !email?.trim())
      return res.status(400).json({ error: "company_name, contact_name, and email are required" });

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email.trim()))
      return res.status(400).json({ error: "Invalid email address" });

    // Prevent duplicate pending requests from the same email
    const existing = await dbGet(
      "SELECT id FROM registration_requests WHERE email=? AND status='pending'",
      [email.trim().toLowerCase()]
    );
    if (existing)
      return res.status(409).json({ error: "A pending request from this email already exists" });

    await dbRun(
      `INSERT INTO registration_requests (company_name, contact_name, email, phone, message)
       VALUES (?,?,?,?,?)`,
      [company_name.trim(), contact_name.trim(), email.trim().toLowerCase(), (phone || "").trim(), (message || "").trim()]
    );

    // Fire-and-forget acknowledgement email
    sendRegistrationReceivedEmail(email.trim().toLowerCase(), contact_name.trim(), company_name.trim());

    res.status(201).json({ message: "Registration request submitted. We will contact you soon." });
  } catch (err) { handleError(res, err, "POST /api/register"); }
});

// Super user — list all registration requests
app.get("/api/admin/registrations", auth(["super_user"]), async (req, res) => {
  try {
    const { status } = req.query;
    const rows = await dbAll(
      `SELECT * FROM registration_requests ${status ? "WHERE status=?" : ""} ORDER BY created_at DESC`,
      status ? [status] : []
    );
    res.json({ requests: rows });
  } catch (err) { handleError(res, err, "GET /api/admin/registrations"); }
});

// Super user — approve: create the company + admin user
app.put("/api/admin/registrations/:id/approve", auth(["super_user"]), express.json(), async (req, res) => {
  try {
    const regId = Number(req.params.id);
    const { company_code, admin_username, admin_password } = req.body || {};
    if (!company_code?.trim() || !admin_username?.trim() || !admin_password)
      return res.status(400).json({ error: "company_code, admin_username, and admin_password are required" });
    if (admin_password.length < 6)
      return res.status(400).json({ error: "admin_password must be at least 6 characters" });

    const reg = await dbGet("SELECT * FROM registration_requests WHERE id=?", [regId]);
    if (!reg) return res.status(404).json({ error: "Registration request not found" });
    if (reg.status !== "pending") return res.status(400).json({ error: "Request is no longer pending" });

    const code = company_code.trim().toUpperCase();
    const exists = await dbGet("SELECT id FROM companies WHERE company_code=?", [code]);
    if (exists) return res.status(409).json({ error: `Company code ${code} already exists` });

    // Create company
    await dbRun(
      `INSERT INTO companies (company_name, company_code, contact_email, contact_phone)
       VALUES (?,?,?,?)`,
      [reg.company_name, code, reg.email, reg.phone || ""]
    );

    // Create admin user
    const hash = await bcrypt.hash(admin_password, 12);
    await dbRun(
      `INSERT INTO users (company_code, username, password_hash, role, must_change_password)
       VALUES (?,?,?,'admin',1)`,
      [code, admin_username.trim(), hash]
    );

    // Mark approved
    await dbRun(
      "UPDATE registration_requests SET status='approved', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?",
      [req.user.username, regId]
    );

    logEvent("REGISTRATION_APPROVED", req, `reg_id=${regId} company_code=${code}`);

    // Send approval email with login credentials
    sendRegistrationApprovedEmail(reg.email, reg.contact_name, reg.company_name, code, admin_username.trim());

    res.json({ message: "Company created and registration approved", company_code: code });
  } catch (err) { handleError(res, err, "PUT /api/admin/registrations/:id/approve"); }
});

// Super user — reject
app.put("/api/admin/registrations/:id/reject", auth(["super_user"]), express.json(), async (req, res) => {
  try {
    const regId = Number(req.params.id);
    const { rejection_note } = req.body || {};
    const reg = await dbGet("SELECT id, status FROM registration_requests WHERE id=?", [regId]);
    if (!reg) return res.status(404).json({ error: "Not found" });
    if (reg.status !== "pending") return res.status(400).json({ error: "Request is no longer pending" });
    await dbRun(
      "UPDATE registration_requests SET status='rejected', reviewed_by=?, rejection_note=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?",
      [req.user.username, (rejection_note || "").trim(), regId]
    );
    logEvent("REGISTRATION_REJECTED", req, `reg_id=${regId}`);
    res.json({ message: "Registration request rejected" });
  } catch (err) { handleError(res, err, "PUT /api/admin/registrations/:id/reject"); }
});

// ── Health ────────────────────────────────────────────────────────────────────
// Public endpoint — used by the frontend to warm up the backend on first load.
app.get("/api/ping", (req, res) => res.json({ ok: true }));
app.get("/api/health", auth(["super_user"]), (req, res) => res.json({ status: "ok" }));

// ── Report Statistics ─────────────────────────────────────────────────────────

app.get("/api/stats/reports", auth(["super_user", "admin"]), async (req, res) => {
  try {
    const company = req.user.role === "super_user"
      ? (req.query.company_code?.toUpperCase().trim() || null)
      : req.user.companyCode;

    const whereClause = company ? "WHERE r.company_code = ?" : "WHERE 1=1";
    const params = company ? [company] : [];

    const perCompany = await dbAll(`
      SELECT r.company_code, c.company_name,
        COUNT(*) AS total,
        SUM(CASE WHEN r.report_type = 'preliminary' THEN 1 ELSE 0 END) AS preliminary,
        SUM(CASE WHEN r.report_type = 'final'       THEN 1 ELSE 0 END) AS final,
        MAX(r.updated_at) AS last_activity
      FROM reports r
      LEFT JOIN companies c ON c.company_code = r.company_code
      ${whereClause}
      GROUP BY r.company_code
      ORDER BY total DESC
    `, params);

    const recentWhere  = company ? "WHERE company_code = ?" : "";
    const recent = await dbAll(`
      SELECT id, filename, report_type, bank, branch, client_name,
             company_code, visit_date, report_date, updated_at
      FROM reports ${recentWhere}
      ORDER BY updated_at DESC LIMIT 20
    `, params);

    const totals = await dbGet(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN report_type = 'preliminary' THEN 1 ELSE 0 END) AS preliminary,
        SUM(CASE WHEN report_type = 'final'       THEN 1 ELSE 0 END) AS final
      FROM reports
      ${company ? "WHERE company_code = ?" : ""}
    `, params);

    res.json({ perCompany, recent, totals });
  } catch (err) {
    handleError(res, err, "GET /api/stats/reports");
  }
});

// ── Billing Stats ─────────────────────────────────────────────────────────────
app.get("/api/stats/billing", auth(["super_user", "admin"]), async (req, res) => {
  try {
    const companyCode = req.user.role === "super_user"
      ? (req.query.company_code?.toUpperCase().trim() || req.user.companyCode)
      : req.user.companyCode;

    const rows = await dbAll(
      "SELECT r.id, r.client_name, r.bank, r.report_date, r.state_json, r.amount_received AS db_amount_received, r.received_at, r.received_bank, u.username AS received_by FROM reports r LEFT JOIN users u ON u.id = r.received_by_user_id WHERE r.company_code=? ORDER BY r.updated_at DESC",
      [companyCode]
    );

    // NRB fee schedule (must mirror calcValFee in buildPrintHTML.js)
    function calcValFee(fmv) {
      if (!fmv || fmv <= 0) return 0;
      if (fmv <= 2_500_000)     return 7_500;
      if (fmv <= 5_000_000)     return Math.round(7_500   + (fmv - 2_500_000)   * 0.002);
      if (fmv <= 10_000_000)    return Math.round(12_500  + (fmv - 5_000_000)   * 0.0015);
      if (fmv <= 50_000_000)    return Math.round(20_000  + (fmv - 10_000_000)  * 0.001);
      if (fmv <= 100_000_000)   return Math.round(60_000  + (fmv - 50_000_000)  * 0.0008);
      if (fmv <= 200_000_000)   return Math.round(100_000 + (fmv - 100_000_000) * 0.0005);
      if (fmv <= 500_000_000)   return Math.round(150_000 + (fmv - 200_000_000) * 0.0003);
      if (fmv <= 1_000_000_000) return Math.round(240_000 + (fmv - 500_000_000) * 0.0002);
      return Math.round(340_000 + (fmv - 1_000_000_000) * 0.0001);
    }

    let totalBilled = 0, totalReceived = 0;
    const perReport = [];

    for (const row of rows) {
      let s = {};
      try { s = JSON.parse(row.state_json || "{}"); } catch (_) {}

      const fmv        = Math.floor((parseFloat(s.finalFMV) || 0) / 100) * 100;
      const fieldFee   = parseFloat(s.fieldChargeAmount)    || 0;
      const transport  = parseFloat(s.transportationCharge) || 0;
      const fieldVisit = fieldFee + transport;
      const valFee     = calcValFee(fmv);
      const extraAmt   = parseFloat(s.extraChargeAmount)    || 0;
      const subTotal   = fieldVisit + valFee + extraAmt;
      const advance    = fieldVisit;
      const total      = subTotal - advance;
      const discount   = parseFloat(s.discountAmount)       || 0;
      const vatBase    = Math.max(0, total - discount);
      const vatAmt     = s.includeVat ? Math.round(vatBase * 0.13) : 0;
      const grandTotal = vatBase + vatAmt;
      // Prefer dedicated DB column; fall back to state_json for older records
      const received = row.db_amount_received != null
        ? (parseFloat(row.db_amount_received) || 0)
        : (parseFloat(s.amountReceived) || 0);

      if (grandTotal > 0 || received > 0) {
        totalBilled   += grandTotal;
        totalReceived += received;
        perReport.push({
          id:         row.id,
          clientName: row.client_name || "—",
          bank:       row.bank || "—",
          reportDate: row.report_date || "—",
          fmv,
          grandTotal,
          received,
          receivedBy:   row.received_by   || null,
          receivedAt:   row.received_at   || null,
          receivedBank: row.received_bank || null,
          outstanding: Math.max(0, grandTotal - received),
        });
      }
    }

    res.json({
      totalReports:  perReport.length,
      totalBilled,
      totalReceived,
      totalOutstanding: Math.max(0, totalBilled - totalReceived),
      perReport,
    });
  } catch (err) {
    handleError(res, err, "GET /api/stats/billing");
  }
});

// ── Storage Stats ─────────────────────────────────────────────────────────────

// Company admin — own storage
app.get("/api/stats/storage", auth(), async (req, res) => {
  try {
    const cc = req.user.companyCode;
    const [reportRows, versionRows, company, fieldRows] = await Promise.all([
      dbAll(`SELECT id, filename, created_at, updated_at,
               length(state_json) as report_bytes
             FROM reports WHERE company_code=? ORDER BY length(state_json) DESC`, [cc]),
      dbAll(`SELECT rv.report_id, length(rv.state_json) as sz FROM report_versions rv JOIN reports r ON r.id=rv.report_id WHERE r.company_code=?`, [cc]),
      dbGet("SELECT length(letterhead_png) as lh FROM companies WHERE company_code=?", [cc]),
      dbAll(`SELECT id, submitter_name, created_at, length(photos_json) as sz FROM field_submissions WHERE company_code=?`, [cc]),
    ]);

    // Build per-version map: report_id -> total version bytes
    const versionMap = {};
    for (const v of versionRows) {
      versionMap[v.report_id] = (versionMap[v.report_id] || 0) + (v.sz || 0);
    }

    const files = reportRows.map(r => ({
      id:           r.id,
      filename:     r.filename || `Report #${r.id}`,
      report_bytes: r.report_bytes || 0,
      version_bytes: versionMap[r.id] || 0,
      total:        (r.report_bytes || 0) + (versionMap[r.id] || 0),
      updated_at:   r.updated_at || r.created_at,
    }));

    const sum = (arr, key) => arr.reduce((a, r) => a + (r[key] || 0), 0);
    const letterheadBytes = company?.lh || 0;
    const fieldBytes      = sum(fieldRows, "sz");
    const reportsBytes    = sum(files, "report_bytes");
    const versionsBytes   = sum(files, "version_bytes");
    const totalBytes      = reportsBytes + versionsBytes + letterheadBytes + fieldBytes;

    res.json({
      total: totalBytes,
      breakdown: { reports: reportsBytes, versions: versionsBytes, letterhead: letterheadBytes, field: fieldBytes },
      report_count:  files.length,
      version_count: versionRows.length,
      files,
      letterhead_bytes: letterheadBytes,
      field_submissions: fieldRows.map(f => ({ id: f.id, name: f.submitter_name || `Submission #${f.id}`, bytes: f.sz || 0, date: f.created_at })),
    });
  } catch (err) { handleError(res, err, "GET /api/stats/storage"); }
});

// Super admin — all companies storage
app.get("/api/admin/stats/storage", auth(["super_user"]), async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT c.company_code, c.company_name,
        (SELECT COALESCE(SUM(length(state_json)),0) FROM reports       WHERE company_code=c.company_code) as report_bytes,
        (SELECT COALESCE(SUM(length(rv.state_json)),0) FROM report_versions rv JOIN reports r ON r.id=rv.report_id WHERE r.company_code=c.company_code) as version_bytes,
        COALESCE(length(c.letterhead_png),0) as letterhead_bytes,
        (SELECT COALESCE(SUM(length(photos_json)),0) FROM field_submissions WHERE company_code=c.company_code) as field_bytes,
        (SELECT COUNT(*) FROM reports WHERE company_code=c.company_code) as report_count
      FROM companies c ORDER BY (report_bytes + version_bytes + letterhead_bytes + field_bytes) DESC
    `);
    const companies = rows.map(r => ({
      company_code:  r.company_code,
      company_name:  r.company_name,
      total:         r.report_bytes + r.version_bytes + r.letterhead_bytes + r.field_bytes,
      breakdown: { reports: r.report_bytes, versions: r.version_bytes, letterhead: r.letterhead_bytes, field: r.field_bytes },
      report_count:  r.report_count,
    }));
    const grandTotal = companies.reduce((a, c) => a + c.total, 0);
    res.json({ grand_total: grandTotal, companies });
  } catch (err) { handleError(res, err, "GET /api/admin/stats/storage"); }
});

// ── Map Data (super_user only) ────────────────────────────────────────────────

app.get("/api/map/data", auth(["super_user"]), async (req, res) => {
  try {
    const { company_code } = req.query;
    let sql = "SELECT id, company_code, state_json FROM reports WHERE 1=1";
    const params = [];
    if (company_code) { sql += " AND company_code = ?"; params.push(company_code.toUpperCase().trim()); }

    const rows   = await dbAll(sql, params);
    const points = [];

    for (const row of rows) {
      let state;
      try { state = JSON.parse(row.state_json); } catch { continue; }

      const properties   = state.properties  || [];
      const rates        = state.rates        || {};
      const roadAccess   = state.roadAccess   || {};
      const govValues    = state.govValues    || {};
      const mortgagedIds = new Set(state.mortgagedIds || []);

      for (const prop of properties) {
        const lat = parseFloat(prop.lat);
        const lng = parseFloat(prop.lng);
        if (isNaN(lat) || isNaN(lng)) continue;

        const r      = rates[prop.id] || {};
        const splits = (state.plotRateSplits || {})[prop.id] || [];
        let fmvRate = 0, commercialRate = 0;
        if (splits.length > 0) {
          let totalArea = 0, totalFmv = 0, totalComm = 0;
          for (const sp of splits) {
            const a  = parseFloat(sp.areaSqm) || 0;
            const cw = parseFloat(sp.commercialWeight) ?? 70;
            const gw = parseFloat(sp.govWeight) ?? 30;
            const cr = parseFloat(sp.commercialRate) || 0;
            const gr = parseFloat(sp.govRate) || 0;
            const fmv = (cr * cw + gr * gw) / 100;
            totalFmv  += fmv * a;
            totalComm += cr * a;
            totalArea += a;
          }
          if (totalArea > 0) { fmvRate = totalFmv / totalArea; commercialRate = totalComm / totalArea; }
        } else {
          const cw = parseFloat(r.commercialWeight) ?? 70;
          const gw = parseFloat(r.govWeight) ?? 30;
          const cr = parseFloat(r.commercialRate) || 0;
          const gr = parseFloat(r.govRate) || 0;
          fmvRate = (cr * cw + gr * gw) / 100;
          commercialRate = cr;
        }

        const roads        = roadAccess[prop.id] || [];
        const maxRoadWidth = roads.reduce((max, rd) => {
          const w = parseFloat(rd.widthField) || parseFloat(rd.widthTrace) || 0;
          return w > max ? w : max;
        }, 0);

        points.push({
          reportId:       row.id,
          companyCode:    row.company_code,
          lat, lng,
          plotNo:         prop.plotNo         || "",
          traceSheetNo:   prop.traceSheetNo   || "",
          location:       prop.location       || prop.presentAddress || prop.addressLalpurja || "",
          ownerName:      prop.ownerName      || "",
          landType:       prop.landType       || "",
          fmvRate:        Math.round(fmvRate),
          commercialRate: Math.round(commercialRate),
          govRate:        parseFloat(govValues[prop.id]) || 0,
          roadWidth:      maxRoadWidth,
          roadType:       roads.map((rd) => rd.roadType).filter(Boolean).join(", "),
          isMortgaged:    mortgagedIds.has(prop.id),
          bank:           state.bank       || "",
          reportDate:     state.reportDate || "",
        });
      }
    }

    res.json({ points, total: points.length });
  } catch (err) {
    handleError(res, err, "GET /api/map/data");
  }
});

// ── Orphan reassignment (super_user only) ─────────────────────────────────────

app.put("/api/reports/reassign-orphans", auth(["super_user"]), async (req, res) => {
  try {
    const { company_code } = req.body;
    if (!company_code) return res.status(400).json({ error: "company_code required" });
    const company = await dbGet("SELECT id FROM companies WHERE company_code = ?", [company_code.toUpperCase().trim()]);
    if (!company) return res.status(404).json({ error: "Company not found" });
    const result = await dbRun(
      "UPDATE reports SET company_code = ? WHERE company_code = '' OR company_code IS NULL",
      [company_code.toUpperCase().trim()]
    );
    res.json({ message: `${result.changes} orphaned report(s) reassigned to ${company_code}` });
  } catch (err) {
    handleError(res, err, "PUT /api/reports/reassign-orphans");
  }
});

// ── Field Data Collection ─────────────────────────────────────────────────────

// Generate a 7-day submission token (admin only)
// ── Field Link helpers ────────────────────────────────────────────────────────
const SHORT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateShortCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += SHORT_CODE_CHARS[Math.floor(Math.random() * SHORT_CODE_CHARS.length)];
  return code;
}

// Admin: create a collection link (permanent or temporary)
app.post("/api/field/links", auth(["admin"]), async (req, res) => {
  try {
    const { label = "", link_type = "permanent", expires_days, max_uses } = req.body || {};
    if (!["permanent", "temporary"].includes(link_type))
      return res.status(400).json({ error: "link_type must be permanent or temporary" });

    let short_code, attempts = 0;
    do {
      short_code = generateShortCode();
      attempts++;
      if (attempts > 20) return res.status(500).json({ error: "Could not generate unique code" });
    } while (await dbGet("SELECT id FROM field_links WHERE short_code=?", [short_code]));

    const expires_at = (link_type === "temporary" && expires_days)
      ? new Date(Date.now() + expires_days * 86400000).toISOString()
      : null;

    const result = await dbRun(
      `INSERT INTO field_links (company_code, short_code, label, link_type, expires_at, max_uses, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.companyCode, short_code, String(label).substring(0, 100),
       link_type, expires_at, max_uses ? Number(max_uses) : null, req.user.username]
    );
    const link = await dbGet("SELECT * FROM field_links WHERE id=?", [result.lastInsertRowid]);
    res.status(201).json(link);
  } catch (err) { handleError(res, err, "POST /api/field/links"); }
});

// Admin: list all links for this company
app.get("/api/field/links", auth(["admin"]), async (req, res) => {
  try {
    const links = await dbAll(
      "SELECT * FROM field_links WHERE company_code=? AND active=1 ORDER BY created_at DESC",
      [req.user.companyCode]
    );
    res.json(links);
  } catch (err) { handleError(res, err, "GET /api/field/links"); }
});

// Admin: deactivate/delete a link
app.delete("/api/field/links/:id", auth(["admin"]), async (req, res) => {
  try {
    await dbRun(
      "DELETE FROM field_links WHERE id=? AND company_code=?",
      [req.params.id, req.user.companyCode]
    );
    res.json({ message: "Link deleted" });
  } catch (err) { handleError(res, err, "DELETE /api/field/links/:id"); }
});

// Public: resolve short code → return company info + API base URL
app.get("/api/field/link/:code", async (req, res) => {
  try {
    const link = await dbGet(
      "SELECT * FROM field_links WHERE short_code=? AND active=1",
      [req.params.code.toUpperCase()]
    );
    if (!link) return res.status(404).json({ error: "Link not found or deactivated" });

    if (link.expires_at && new Date(link.expires_at) < new Date())
      return res.status(410).json({ error: "This link has expired" });

    if (link.max_uses && link.use_count >= link.max_uses)
      return res.status(410).json({ error: "This link has reached its maximum uses" });

    const company = await dbGet(
      "SELECT company_name, custom_banks FROM companies WHERE company_code=?",
      [link.company_code]
    );
    let banks = [];
    try { banks = JSON.parse(company?.custom_banks || "[]"); } catch (_) {}

    // Increment use count
    await dbRun("UPDATE field_links SET use_count=use_count+1 WHERE id=?", [link.id]);

    const apiUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`);

    res.json({
      companyCode: link.company_code,
      companyName: company?.company_name || "",
      banks,
      short_code: link.short_code,
      link_type: link.link_type,
      expires_at: link.expires_at,
      apiUrl,
    });
  } catch (err) { handleError(res, err, "GET /api/field/link/:code"); }
});

app.post("/api/field/token", auth(["admin"]), async (req, res) => {
  try {
    const company = await dbGet("SELECT company_name FROM companies WHERE company_code=?", [req.user.companyCode]);
    const token = jwt.sign(
      { type: "field_submit", companyCode: req.user.companyCode, companyName: company?.company_name || "" },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({ token });
  } catch (err) {
    handleError(res, err, "POST /api/field/token");
  }
});

// Public: verify token and return company info + bank list (used by mobile form)
app.get("/api/field/company-info", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "token required" });
    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); } catch {
      return res.status(401).json({ error: "Invalid or expired link. Ask your admin for a new one." });
    }
    if (decoded.type !== "field_submit") return res.status(401).json({ error: "Invalid token type" });
    const company = await dbGet("SELECT company_name, custom_banks FROM companies WHERE company_code=?", [decoded.companyCode]);
    let banks = [];
    try { banks = JSON.parse(company?.custom_banks || "[]"); } catch (_) {}
    res.json({ companyCode: decoded.companyCode, companyName: decoded.companyName || "", banks });
  } catch (err) {
    handleError(res, err, "GET /api/field/company-info");
  }
});

// Public: submit field data — accepts short_code OR legacy JWT token
app.post("/api/field/submit", express.json({ limit: "20mb" }), async (req, res) => {
  try {
    const { token, short_code, data, photos } = req.body;
    let companyCode;

    if (short_code) {
      // New short-code based submission
      const link = await dbGet(
        "SELECT * FROM field_links WHERE short_code=? AND active=1",
        [String(short_code).toUpperCase()]
      );
      if (!link) return res.status(401).json({ error: "Invalid or deactivated link." });
      if (link.expires_at && new Date(link.expires_at) < new Date())
        return res.status(410).json({ error: "This link has expired." });
      if (link.max_uses && link.use_count >= link.max_uses)
        return res.status(410).json({ error: "This link has reached its maximum uses." });
      companyCode = link.company_code;
    } else if (token) {
      // Legacy JWT token submission
      let decoded;
      try { decoded = jwt.verify(token, JWT_SECRET); } catch {
        return res.status(401).json({ error: "Invalid or expired link." });
      }
      if (decoded.type !== "field_submit") return res.status(401).json({ error: "Invalid token type" });
      companyCode = decoded.companyCode;
    } else {
      return res.status(400).json({ error: "short_code or token required" });
    }

    const sanitized       = deepSanitize(data || {});
    const sanitizedPhotos = Array.isArray(photos)
      ? photos.filter((p) => typeof p === "string" && VALID_IMG_PREFIX.test(p)).slice(0, 20)
      : [];

    await dbRun(
      `INSERT INTO field_submissions (company_code, submitter_name, data_json, photos_json)
       VALUES (?, ?, ?, ?)`,
      [companyCode,
       String(sanitized.submitterName || "").substring(0, 100),
       JSON.stringify(sanitized),
       JSON.stringify(sanitizedPhotos)]
    );
    res.status(201).json({ message: "Submitted successfully" });
  } catch (err) {
    handleError(res, err, "POST /api/field/submit");
  }
});

// Authenticated import (from file upload — no field token required)
app.post("/api/field/submissions/import", auth(["admin", "user"]), express.json({ limit: "20mb" }), async (req, res) => {
  try {
    const { data, photos } = req.body;
    if (!data) return res.status(400).json({ error: "data is required" });
    const sanitized      = deepSanitize(data);
    const sanitizedPhotos = Array.isArray(photos)
      ? photos.filter((p) => typeof p === "string" && VALID_IMG_PREFIX.test(p)).slice(0, 20)
      : [];
    await dbRun(
      `INSERT INTO field_submissions (company_code, submitter_name, data_json, photos_json)
       VALUES (?, ?, ?, ?)`,
      [req.user.companyCode,
       String(sanitized.submitterName || "").substring(0, 100),
       JSON.stringify(sanitized),
       JSON.stringify(sanitizedPhotos)]
    );
    res.status(201).json({ message: "Imported successfully" });
  } catch (err) {
    handleError(res, err, "POST /api/field/submissions/import");
  }
});

// List submissions for company (admin + user)
app.get("/api/field/submissions", auth(["admin", "user"]), async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT id, submitter_name, pulled_at, created_at,
              rejection_reason, rejected_at, rejected_by_username,
              CASE WHEN rejection_reason IS NOT NULL AND rejection_reason != '' THEN 'rejected'
                   ELSE status END AS status,
              json_extract(data_json, '$.clientName') AS client_name,
              json_extract(data_json, '$.location')   AS location,
              json_extract(data_json, '$.bank')        AS bank,
              json_extract(data_json, '$.branch')      AS branch
       FROM field_submissions
       WHERE company_code = ?
       ORDER BY created_at DESC`,
      [req.user.companyCode]
    );
    res.json({ submissions: rows });
  } catch (err) {
    handleError(res, err, "GET /api/field/submissions");
  }
});

// Get single submission (admin + user)
app.get("/api/field/submissions/:id", auth(["admin", "user"]), async (req, res) => {
  try {
    const row = await dbGet(
      `SELECT *, CASE WHEN rejection_reason IS NOT NULL AND rejection_reason != '' THEN 'rejected' ELSE status END AS status
       FROM field_submissions WHERE id=? AND company_code=?`,
      [req.params.id, req.user.companyCode]
    );
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({
      ...row,
      data:   JSON.parse(row.data_json   || "{}"),
      photos: JSON.parse(row.photos_json || "[]"),
    });
  } catch (err) {
    handleError(res, err, "GET /api/field/submissions/:id");
  }
});

// Mark submission as pulled (admin + user)
app.post("/api/field/submissions/:id/pull", auth(["admin", "user"]), async (req, res) => {
  try {
    const row = await dbGet(
      "SELECT id FROM field_submissions WHERE id=? AND company_code=?",
      [req.params.id, req.user.companyCode]
    );
    if (!row) return res.status(404).json({ error: "Not found" });
    await dbRun(
      "UPDATE field_submissions SET status='pulled', pulled_by_user_id=?, pulled_at=CURRENT_TIMESTAMP WHERE id=?",
      [req.user.userId, req.params.id]
    );
    res.json({ message: "Marked as pulled" });
  } catch (err) {
    handleError(res, err, "POST /api/field/submissions/:id/pull");
  }
});

// Reject submission (admin only)
app.post("/api/field/submissions/:id/reject", auth(["admin", "user"]), express.json(), async (req, res) => {
  try {
    const row = await dbGet(
      "SELECT id, data_json FROM field_submissions WHERE id=? AND company_code=?",
      [req.params.id, req.user.companyCode]
    );
    if (!row) return res.status(404).json({ error: "Not found" });
    const reason = (req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "Rejection reason is required" });

    // Merge any extra fields (plotNo, traceSheetNo, visitDate, landMarketRate, roadType, roadWidth, hazards) into data_json
    const extraFields = req.body.extraFields;
    let dataJson = row.data_json;
    if (extraFields && typeof extraFields === "object") {
      try {
        const existing = JSON.parse(row.data_json || "{}");
        const merged = { ...existing, ...extraFields };
        dataJson = JSON.stringify(merged);
      } catch (_) {}
    }

    await dbRun(
      "UPDATE field_submissions SET rejection_reason=?, rejected_at=CURRENT_TIMESTAMP, rejected_by_user_id=?, rejected_by_username=?, data_json=? WHERE id=?",
      [reason, req.user.userId, req.user.username, dataJson, req.params.id]
    );
    res.json({ message: "Rejected" });
  } catch (err) {
    handleError(res, err, "POST /api/field/submissions/:id/reject");
  }
});

// Delete submission (admin + user)
app.delete("/api/field/submissions/:id", auth(["admin", "super_user"]), async (req, res) => {
  try {
    const row = await dbGet(
      "SELECT id FROM field_submissions WHERE id=? AND company_code=?",
      [req.params.id, req.user.companyCode]
    );
    if (!row) return res.status(404).json({ error: "Not found" });
    await dbRun("DELETE FROM field_submissions WHERE id=?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    handleError(res, err, "DELETE /api/field/submissions/:id");
  }
});

// ── API 404 catch-all ─────────────────────────────────────────────────────────
app.use("/api/", auth(), (req, res) => {
  res.status(404).json({ error: "Not found" });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
}
