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