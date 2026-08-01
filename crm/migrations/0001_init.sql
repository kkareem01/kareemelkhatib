-- Migration 0001: full schema for crm.kareemelkhatib.com
-- Single-user system: no users table; settings holds account-level state.

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,          -- 'bootstrap_done', 'passphrase', 'kdf_params'
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE credentials (               -- registered passkeys
  id            TEXT PRIMARY KEY,        -- base64url credential ID
  public_key    BLOB NOT NULL,           -- COSE public key bytes
  counter       INTEGER NOT NULL DEFAULT 0,
  transports    TEXT,                    -- JSON array of transport hints
  label         TEXT NOT NULL,           -- "MacBook", "iPhone"
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER
);

CREATE TABLE challenges (                -- short-lived WebAuthn challenges
  id         TEXT PRIMARY KEY,           -- random id echoed by client
  type       TEXT NOT NULL CHECK (type IN ('registration','authentication')),
  challenge  TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,         -- sha256(token); raw token only in cookie
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,         -- min(last_seen + idle TTL, created + absolute TTL)
  ip           TEXT,
  user_agent   TEXT
);

CREATE TABLE files (
  id         TEXT PRIMARY KEY,           -- uuid
  r2_key     TEXT NOT NULL UNIQUE,       -- 'files/<uuid>' — never the user filename
  name       TEXT NOT NULL,
  mime       TEXT NOT NULL DEFAULT 'application/octet-stream',
  size       INTEGER NOT NULL,
  sha256     TEXT,
  tags       TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER                     -- soft delete; cron purges R2 after 30d
);
CREATE INDEX idx_files_name ON files(name);
CREATE INDEX idx_files_created ON files(created_at DESC);

CREATE TABLE links (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,
  icon       TEXT,                       -- emoji
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '',
  body_md    TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE clipboard (                 -- single synced scratchpad row
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  content    TEXT NOT NULL DEFAULT '',
  rev        INTEGER NOT NULL DEFAULT 0, -- optimistic concurrency for polling clients
  updated_at INTEGER NOT NULL
);
INSERT INTO clipboard (id, content, rev, updated_at) VALUES (1, '', 0, 0);

CREATE TABLE shares (
  id             TEXT PRIMARY KEY,       -- uuid, for management UI
  token_hash     TEXT NOT NULL UNIQUE,   -- sha256(url token)
  file_id        TEXT NOT NULL REFERENCES files(id),
  expires_at     INTEGER NOT NULL,
  max_downloads  INTEGER,                -- NULL = unlimited within expiry
  download_count INTEGER NOT NULL DEFAULT 0,
  revoked_at     INTEGER,
  created_at     INTEGER NOT NULL
);
CREATE INDEX idx_shares_file ON shares(file_id);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER NOT NULL,
  event      TEXT NOT NULL,
  detail     TEXT,                       -- JSON
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX idx_audit_ts ON audit_log(ts);

CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,         -- '<scope>:<ip>'
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
