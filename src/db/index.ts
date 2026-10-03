import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('multistore.db');

export function initDb() {
  db.execSync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning','shopping','completed'))
    );

    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      store_id INTEGER REFERENCES stores(id),            -- NULL = any store
      resolved_store_id INTEGER REFERENCES stores(id),   -- where an any-store item was resolved
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','bought','no_stock','skipped')),
      is_unplanned INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS to_buy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      store_name TEXT,
      from_trip_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// Finish trip: mark completed and move no_stock items to to_buy, in one transaction.
export function finishTrip(tripId: number) {
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO to_buy (name, store_name, from_trip_id)
       SELECT i.name, s.name, i.trip_id
       FROM items i LEFT JOIN stores s ON s.id = i.store_id
       WHERE i.trip_id = ? AND i.status = 'no_stock'`,
      [tripId]
    );
    db.runSync(`UPDATE trips SET status = 'completed' WHERE id = ?`, [tripId]);
  });
}