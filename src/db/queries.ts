import { db } from './index';

export type ToBuyRow = {
  id: number;
  name: string;
  store_name: string | null;
  created_at: string;
};

export type TripRow = {
  id: number;
  name: string;
  created_at: string;
  item_count: number;
  bought_count: number;
};
export type DraftItem = { 
  name: string; 
  storeName: string | null 
};

export type StoreRow = {
  id: number;
  name: string;
  status: 'open' | 'done';
  total: number;
  pending: number;
};

export type ItemStatus = 'pending' | 'bought' | 'no_stock' | 'skipped';

export type ShopItem = {
  id: number;
  name: string;
  store_id: number | null; // null = any store
  status: ItemStatus;
  is_unplanned: number;
};

export type ReviewItem = {
  id: number;
  name: string;
  status: ItemStatus;
  is_unplanned: number;
  store_name: string | null;
  resolved_store_name: string | null;
};

export type InProgressTrip = {
  id: number;
  name: string;
  created_at: string;
  item_count: number;
  marked_count: number;
  bought_count: number;
  open_stores: number;
};
export function getToBuy(): ToBuyRow[] {
  return db.getAllSync<ToBuyRow>(
    `SELECT id, name, store_name, created_at
     FROM to_buy
     ORDER BY created_at DESC, id DESC`
  );
}

export function deleteToBuy(id: number) {
  db.runSync('DELETE FROM to_buy WHERE id = ?', [id]);
}

export function getCompletedTrips(): TripRow[] {
  return db.getAllSync<TripRow>(
    `SELECT t.id, t.name, t.created_at,
       (SELECT COUNT(*) FROM items i WHERE i.trip_id = t.id) AS item_count,
       (SELECT COUNT(*) FROM items i WHERE i.trip_id = t.id AND i.status = 'bought') AS bought_count
     FROM trips t
     WHERE t.status = 'completed'
     ORDER BY t.created_at DESC, t.id DESC`
  );
}

// Dev only: lets you see the To buy list before the shopping flow exists.
export function seedToBuy() {
  db.runSync(
    `INSERT INTO to_buy (name, store_name) VALUES (?, ?), (?, ?)`,
    ['Cooking oil', 'Palengke', 'Notebook', null]
  );
}

export function getToBuyById(id: number): ToBuyRow | null {
  return db.getFirstSync<ToBuyRow>(
    'SELECT id, name, store_name, created_at FROM to_buy WHERE id = ?',
    [id]
  );
}

// Creates the trip, its stores, and its items in one transaction.
// Also removes the to_buy rows that were pulled into this trip.
export function createTrip(drafts: DraftItem[], toBuyIds: number[]): number {
  let tripId = 0;
  db.withTransactionSync(() => {
    const name = `Trip ${new Date().toLocaleDateString()}`;
    tripId = db.runSync(
      `INSERT INTO trips (name, status) VALUES (?, 'shopping')`,
      [name]
    ).lastInsertRowId;

    const storeIds = new Map<string, number>(); // lowercase name -> store id

    for (const d of drafts) {
      let storeId: number | null = null;

      if (d.storeName) {
        const key = d.storeName.toLowerCase();
        let id = storeIds.get(key);
        if (id === undefined) {
          id = db.runSync(
            'INSERT INTO stores (trip_id, name) VALUES (?, ?)',
            [tripId, d.storeName]
          ).lastInsertRowId;
          storeIds.set(key, id);
        }
        storeId = id;
      }

      db.runSync(
        'INSERT INTO items (trip_id, name, store_id) VALUES (?, ?, ?)',
        [tripId, d.name, storeId]
      );
    }

    for (const id of toBuyIds) {
      db.runSync('DELETE FROM to_buy WHERE id = ?', [id]);
    }
  });
  return tripId;
}

export function getStoresForTrip(tripId: number): StoreRow[] {
  return db.getAllSync<StoreRow>(
    `SELECT s.id, s.name, s.status,
       (SELECT COUNT(*) FROM items i WHERE i.store_id = s.id) AS total,
       (SELECT COUNT(*) FROM items i WHERE i.store_id = s.id AND i.status = 'pending') AS pending
     FROM stores s
     WHERE s.trip_id = ?
     ORDER BY s.id`,
    [tripId]
  );
}

export function getPendingAnyStoreCount(tripId: number): number {
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM items
     WHERE trip_id = ? AND store_id IS NULL AND status = 'pending'`,
    [tripId]
  );
  return row?.n ?? 0;
}

// Marked items keep their status; only the store itself is reopened.
export function reopenStore(storeId: number) {
  db.runSync(`UPDATE stores SET status = 'open' WHERE id = ?`, [storeId]);
}

export function getStoreById(
  storeId: number
): { id: number; name: string; status: 'open' | 'done' } | null {
  return db.getFirstSync(
    'SELECT id, name, status FROM stores WHERE id = ?',
    [storeId]
  );
}

// Own items first, then any-store items that are unresolved or resolved at this store.
export function getItemsForStore(tripId: number, storeId: number): ShopItem[] {
  return db.getAllSync<ShopItem>(
    `SELECT id, name, store_id, status, is_unplanned
     FROM items
     WHERE trip_id = ?
       AND (
         store_id = ?
         OR (store_id IS NULL AND (status = 'pending' OR resolved_store_id = ?))
       )
     ORDER BY (store_id IS NULL), id`,
    [tripId, storeId, storeId]
  );
}

export function setItemStatus(
  itemId: number,
  status: ItemStatus,
  resolvedStoreId: number | null
) {
  db.runSync(
    'UPDATE items SET status = ?, resolved_store_id = ? WHERE id = ?',
    [status, resolvedStoreId, itemId]
  );
}

export function addUnplannedItem(tripId: number, storeId: number, name: string) {
  db.runSync(
    `INSERT INTO items (trip_id, name, store_id, status, is_unplanned)
     VALUES (?, ?, ?, 'bought', 1)`,
    [tripId, name, storeId]
  );
}

export function deleteUnplannedItem(itemId: number) {
  db.runSync('DELETE FROM items WHERE id = ? AND is_unplanned = 1', [itemId]);
}

export function markStoreDone(storeId: number) {
  db.runSync(`UPDATE stores SET status = 'done' WHERE id = ?`, [storeId]);
}

export function getOpenStoreCount(tripId: number): number {
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM stores WHERE trip_id = ? AND status = 'open'`,
    [tripId]
  );
  return row?.n ?? 0;
}

export function getOtherOpenStoreCount(tripId: number, storeId: number): number {
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM stores
     WHERE trip_id = ? AND status = 'open' AND id != ?`,
    [tripId, storeId]
  );
  return row?.n ?? 0;
}

// Same name (case-insensitive) reuses and reopens the existing store.
export function addOrReopenStore(tripId: number, name: string): number {
  const existing = db.getFirstSync<{ id: number }>(
    'SELECT id FROM stores WHERE trip_id = ? AND LOWER(name) = LOWER(?)',
    [tripId, name]
  );
  if (existing) {
    db.runSync(`UPDATE stores SET status = 'open' WHERE id = ?`, [existing.id]);
    return existing.id;
  }
  return db.runSync(
    'INSERT INTO stores (trip_id, name) VALUES (?, ?)',
    [tripId, name]
  ).lastInsertRowId;
}

// Unmarked any-store items become no_stock so finishTrip sends them to To buy.
export function moveLeftoversToNoStock(tripId: number, lastStoreId: number) {
  db.runSync(
    `UPDATE items SET status = 'no_stock', resolved_store_id = ?
     WHERE trip_id = ? AND store_id IS NULL AND status = 'pending'`,
    [lastStoreId, tripId]
  );
}

export function getReviewItems(tripId: number): ReviewItem[] {
  return db.getAllSync<ReviewItem>(
    `SELECT i.id, i.name, i.status, i.is_unplanned,
            s.name AS store_name, r.name AS resolved_store_name
     FROM items i
     LEFT JOIN stores s ON s.id = i.store_id
     LEFT JOIN stores r ON r.id = i.resolved_store_id
     WHERE i.trip_id = ?
     ORDER BY i.id`,
    [tripId]
  );
}

export function getTripStatus(tripId: number): 'planning' | 'shopping' | 'completed' | null {
  const row = db.getFirstSync<{ status: 'planning' | 'shopping' | 'completed' }>(
    'SELECT status FROM trips WHERE id = ?',
    [tripId]
  );
  return row?.status ?? null;
}

export function getInProgressTrips(): InProgressTrip[] {
  return db.getAllSync<InProgressTrip>(
    `SELECT t.id, t.name, t.created_at,
       (SELECT COUNT(*) FROM items i WHERE i.trip_id = t.id) AS item_count,
       (SELECT COUNT(*) FROM items i WHERE i.trip_id = t.id AND i.status != 'pending') AS marked_count,
       (SELECT COUNT(*) FROM items i WHERE i.trip_id = t.id AND i.status = 'bought') AS bought_count,
       (SELECT COUNT(*) FROM stores s WHERE s.trip_id = t.id AND s.status = 'open') AS open_stores
     FROM trips t
     WHERE t.status = 'shopping'
     ORDER BY t.created_at DESC, t.id DESC`
  );
}

// Only for trips with nothing bought. Returns false (and changes nothing) otherwise.
export function discardTrip(tripId: number): boolean {
  const bought = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM items WHERE trip_id = ? AND status = 'bought'`,
    [tripId]
  );
  if ((bought?.n ?? 0) > 0) return false;

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO to_buy (name, store_name, from_trip_id)
       SELECT i.name, s.name, i.trip_id
       FROM items i LEFT JOIN stores s ON s.id = i.store_id
       WHERE i.trip_id = ? AND i.status IN ('pending', 'no_stock')`,
      [tripId]
    );
    db.runSync('DELETE FROM items WHERE trip_id = ?', [tripId]);
    db.runSync('DELETE FROM stores WHERE trip_id = ?', [tripId]);
    db.runSync('DELETE FROM trips WHERE id = ?', [tripId]);
  });
  return true;
}

// For trips with some bought items: save them as a journey, send the rest to To buy.
export function endTripEarly(tripId: number) {
  db.withTransactionSync(() => {
    // Never-attempted items go back to To buy and leave the journey.
    db.runSync(
      `INSERT INTO to_buy (name, store_name, from_trip_id)
       SELECT i.name, s.name, i.trip_id
       FROM items i LEFT JOIN stores s ON s.id = i.store_id
       WHERE i.trip_id = ? AND i.status = 'pending'`,
      [tripId]
    );
    db.runSync(`DELETE FROM items WHERE trip_id = ? AND status = 'pending'`, [tripId]);

    // No-stock items go to To buy too, but stay in the journey (same as finishTrip).
    db.runSync(
      `INSERT INTO to_buy (name, store_name, from_trip_id)
       SELECT i.name, s.name, i.trip_id
       FROM items i LEFT JOIN stores s ON s.id = i.store_id
       WHERE i.trip_id = ? AND i.status = 'no_stock'`,
      [tripId]
    );

    db.runSync(`UPDATE stores SET status = 'done' WHERE trip_id = ?`, [tripId]);
    db.runSync(`UPDATE trips SET status = 'completed' WHERE id = ?`, [tripId]);
  });
}