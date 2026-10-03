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