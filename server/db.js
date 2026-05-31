// db.js — SQLite via sql.js (pure JavaScript, no native build required)
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'zenscreen.db');

// We export a promise that resolves to the initialized db object
let _db = null;

async function getDb() {
  if (_db) return _db;

  const SQL = await initSqlJs();

  // Load existing DB from file or create fresh
  let buffer;
  if (fs.existsSync(DB_PATH)) {
    buffer = fs.readFileSync(DB_PATH);
  }
  _db = buffer ? new SQL.Database(buffer) : new SQL.Database();

  // Enable WAL-equivalent and foreign keys
  _db.run('PRAGMA foreign_keys = ON;');

  // ─── Schema ────────────────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password    TEXT    NOT NULL,
      daily_goal  INTEGER NOT NULL DEFAULT 360,
      streak      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_limits (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_name    TEXT    NOT NULL,
      limit_mins  INTEGER NOT NULL,
      UNIQUE(user_id, app_name)
    );

    CREATE TABLE IF NOT EXISTS screen_time (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date        TEXT    NOT NULL,
      app_name    TEXT    NOT NULL,
      minutes     INTEGER NOT NULL DEFAULT 0,
      timestamp   INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(user_id, date, app_name)
    );

    CREATE TABLE IF NOT EXISTS preferences (
      user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      notifications     INTEGER NOT NULL DEFAULT 1,
      bedtime_mode      INTEGER NOT NULL DEFAULT 1,
      weekly_report     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notification_log (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type              TEXT NOT NULL,
      fired_at          TEXT NOT NULL DEFAULT (datetime('now')),
      date              TEXT NOT NULL DEFAULT (date('now')),
      UNIQUE(user_id, type, date)
    );
  `);

  // ─── Migrations ────────────────────────────────────────────────────────────
  // Add `timestamp` column to screen_time if it was created without it.
  // (CREATE TABLE IF NOT EXISTS never alters an existing table.)
  const screenTimeCols = _db.exec("PRAGMA table_info(screen_time)");
  if (screenTimeCols.length > 0) {
    const colNames = screenTimeCols[0].values.map(row => row[1]); // column: name
    if (!colNames.includes('timestamp')) {
      console.log('[DB] Migrating screen_time: adding timestamp column...');
      _db.run(
        "ALTER TABLE screen_time ADD COLUMN timestamp INTEGER NOT NULL DEFAULT 0"
      );
      // Back-fill existing rows with current epoch ms so they sort correctly
      _db.run(
        "UPDATE screen_time SET timestamp = (CAST(strftime('%s','now') AS INTEGER) * 1000) WHERE timestamp = 0"
      );
      console.log('[DB] Migration complete.');
    }
  }

  save();
  return _db;
}

// Persist the in-memory database to disk after every write
function save() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Helpers that mimic better-sqlite3's sync API but wrap sql.js's API
// Returns all rows as plain objects
function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Returns single row or undefined
function get(db, sql, params = []) {
  return all(db, sql, params)[0];
}

// Runs a statement, saves, returns { lastInsertRowid, changes }
function run(db, sql, params = []) {
  db.run(sql, params);
  save();
  const lastInsertRowid = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] ?? null;
  const changes = db.getRowsModified();
  return { lastInsertRowid, changes };
}

module.exports = { getDb, all, get, run, save };
