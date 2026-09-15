-- ============================================================================
--  Mulyanka — Nepal Property Valuation Reports
--  Reference database schema (SQLite / libSQL, as used by Turso)
--
--  DO NOT RUN THIS FILE TO SET UP A DEPLOYMENT. It is documentation only.
--  backend/server.js is the source of truth: initDb() creates every table and
--  index below on first request, then applies its own ALTER TABLE migrations.
--  Running this by hand is unnecessary and will drift from the code.
--
--  Generated from a real initDb() run, so the column lists already include
--  every migration applied by server.js.
-- ============================================================================

PRAGMA foreign_keys = ON;
-- ----------------------------------------------------------------------------
-- companies
-- Tenants. Every other table scopes to companies.company_code.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code             TEXT UNIQUE NOT NULL,
  company_name             TEXT NOT NULL DEFAULT '',
  address1                 TEXT DEFAULT '',
  address2                 TEXT DEFAULT '',
  city                     TEXT DEFAULT '',
  state                    TEXT DEFAULT '',
  zip                      TEXT DEFAULT '',
  country                  TEXT DEFAULT '',
  contact_email            TEXT DEFAULT '',
  contact_phone            TEXT DEFAULT '',
  logo_url                 TEXT DEFAULT '',
  created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
  custom_banks             TEXT DEFAULT '[]',
  letterhead_png           TEXT DEFAULT '',
  letterhead_text_box      TEXT DEFAULT '',
  letterhead_watermark_box TEXT DEFAULT '',
  valuators                TEXT DEFAULT '[]',
  report_color_theme       TEXT DEFAULT 'blue',
  credit_balance           INTEGER NOT NULL DEFAULT 0,
  credit_expiry            DATETIME,
  credit_low_threshold     INTEGER NOT NULL DEFAULT 5,
  rate_map_free            INTEGER NOT NULL DEFAULT 0,
  pan_vat                  TEXT DEFAULT '',
  bank_account             TEXT DEFAULT '',
  bill_prefix              TEXT DEFAULT 'BILL',
  payment_methods          TEXT DEFAULT '[]',
  fee_tiers                TEXT DEFAULT '[]'
);

-- ----------------------------------------------------------------------------
-- users
-- Accounts. Roles: super_user | admin | user. Unique per (company_code, username).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code         TEXT NOT NULL,
  username             TEXT NOT NULL,
  password_hash        TEXT NOT NULL,
  email                TEXT DEFAULT '',
  role                 TEXT NOT NULL CHECK(role IN ('super_user','admin','user')),
  must_change_password INTEGER DEFAULT 0,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active            INTEGER NOT NULL DEFAULT 1,
  UNIQUE(company_code, username)
);

-- ----------------------------------------------------------------------------
-- reports
-- One row per valuation report; the whole form lives in state_json.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  filename            TEXT NOT NULL,
  report_type         TEXT NOT NULL DEFAULT 'preliminary',
  bank                TEXT,
  branch              TEXT,
  visit_date          TEXT,
  report_date         TEXT,
  client_name         TEXT,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  state_json          TEXT NOT NULL,
  company_code        TEXT DEFAULT '',
  created_by_user_id  INTEGER,
  amount_received     REAL,
  received_by_user_id INTEGER,
  received_at         TEXT,
  received_bank       TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_bank        ON reports(bank);
CREATE INDEX IF NOT EXISTS idx_reports_client_name ON reports(client_name);
CREATE INDEX IF NOT EXISTS idx_reports_report_date ON reports(report_date);

-- ----------------------------------------------------------------------------
-- report_versions
-- Rolling history, pruned to the last 10 versions per report on startup.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_versions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id     INTEGER NOT NULL,
  changed_by_id INTEGER NOT NULL,
  state_json    TEXT NOT NULL,
  state_hash    TEXT NOT NULL DEFAULT '',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rv_report ON report_versions(report_id);

-- ----------------------------------------------------------------------------
-- report_prints
-- Audit log of final-report prints; drives credit consumption.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_prints (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id    INTEGER NOT NULL,
  company_code TEXT NOT NULL,
  user_id      INTEGER NOT NULL,
  username     TEXT NOT NULL,
  print_type   TEXT NOT NULL DEFAULT 'preliminary',
  action       TEXT NOT NULL DEFAULT 'print',
  printed_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prints_company ON report_prints(company_code);
CREATE INDEX IF NOT EXISTS idx_prints_report  ON report_prints(report_id);

-- ----------------------------------------------------------------------------
-- credit_transactions
-- Ledger of credit grants and spends per company.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_transactions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code   TEXT NOT NULL,
  actor_id       INTEGER,
  actor_username TEXT NOT NULL DEFAULT '',
  action         TEXT NOT NULL,
  amount         INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after  INTEGER NOT NULL,
  report_id      INTEGER,
  report_type    TEXT,
  note           TEXT DEFAULT '',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ct_company ON credit_transactions(company_code);
CREATE INDEX IF NOT EXISTS idx_ct_ts      ON credit_transactions(created_at);

-- ----------------------------------------------------------------------------
-- field_links
-- Short codes handed to field staff for the mobile collection page.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_links (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code TEXT NOT NULL,
  short_code   TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL DEFAULT '',
  link_type    TEXT NOT NULL DEFAULT 'permanent' CHECK(link_type IN ('permanent','temporary')),
  expires_at   DATETIME,
  max_uses     INTEGER,
  use_count    INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  created_by   TEXT NOT NULL DEFAULT '',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fl_code    ON field_links(short_code);
CREATE INDEX IF NOT EXISTS idx_fl_company ON field_links(company_code);

-- ----------------------------------------------------------------------------
-- field_submissions
-- Data captured on the mobile page, awaiting review.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "field_submissions" (
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
      );

CREATE INDEX IF NOT EXISTS idx_fs_company ON field_submissions(company_code);
CREATE INDEX IF NOT EXISTS idx_fs_status  ON field_submissions(status);

-- ----------------------------------------------------------------------------
-- rate_map_sessions
-- Saved land-rate map working sessions.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_map_sessions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code     TEXT NOT NULL,
  user_id          INTEGER NOT NULL,
  username         TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL,
  credits_used     INTEGER NOT NULL,
  expires_at       DATETIME NOT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rms_company ON rate_map_sessions(company_code);

-- ----------------------------------------------------------------------------
-- registration_requests
-- Self-service signup requests pending super-user approval.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registration_requests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name   TEXT NOT NULL,
  contact_name   TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT DEFAULT '',
  message        TEXT DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending',
  reviewed_by    TEXT DEFAULT '',
  rejection_note TEXT DEFAULT '',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at    DATETIME
);

CREATE INDEX IF NOT EXISTS idx_reg_status ON registration_requests(status);

-- ----------------------------------------------------------------------------
-- feedback
-- In-app feedback submitted by users.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code   TEXT NOT NULL,
  user_id        INTEGER NOT NULL,
  username       TEXT NOT NULL DEFAULT '',
  user_email     TEXT DEFAULT '',
  message        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  credit_awarded INTEGER NOT NULL DEFAULT 0,
  approved_by    TEXT DEFAULT '',
  approved_at    DATETIME,
  rejection_note TEXT DEFAULT '',
  email_sent     INTEGER NOT NULL DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  screenshot     TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_fb_company ON feedback(company_code);
CREATE INDEX IF NOT EXISTS idx_fb_status  ON feedback(status);

-- ----------------------------------------------------------------------------
-- revoked_tokens
-- JWT denylist; expired rows are purged on startup.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rt_exp ON revoked_tokens(expires_at);

-- ----------------------------------------------------------------------------
-- security_events
-- Security audit trail; rows older than 90 days are purged on startup.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT NOT NULL,
  user_id      INTEGER,
  username     TEXT,
  company_code TEXT,
  ip_address   TEXT,
  detail       TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_se_ts   ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_se_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_se_user ON security_events(user_id);

-- ----------------------------------------------------------------------------
-- system_settings
-- Global key/value settings.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
