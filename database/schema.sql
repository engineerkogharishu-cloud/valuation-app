-- ============================================================
-- Nepal Property Valuation Report - Database Schema
-- SQLite (default) or PostgreSQL compatible
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  filename    TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'preliminary',
  bank        TEXT,
  branch      TEXT,
  visit_date  TEXT,
  report_date TEXT,
  client_name TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  state_json  TEXT NOT NULL  -- full JSON state blob
);

CREATE INDEX IF NOT EXISTS idx_reports_bank        ON reports(bank);
CREATE INDEX IF NOT EXISTS idx_reports_report_date ON reports(report_date);
CREATE INDEX IF NOT EXISTS idx_reports_client_name ON reports(client_name);
