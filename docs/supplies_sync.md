# Supply Tracker ↔ Supabase sync

The Supply Tracker stores rows in **local storage**. When a user is signed in and Supabase is configured, each add, update, or delete is **mirrored** to `public.supplies` for that user (`user_id = auth.uid()` under RLS).

## `cloud_id` mapping

Each local supply may include optional **`cloud_id`**: the UUID primary key of the matching Supabase row. After a successful insert, the client writes this id back onto the local row so later updates target the correct cloud row.

## Reconciliation (last-write-wins)

On login and session restore (debounced), **`reconcileSupplies()`**:

1. Loads all cloud rows for the current user.
2. Matches local rows by **`cloud_id`**, then once by **`(name, category)`** (category is the local supply `type`).
3. For each matched pair, compares **`updated_at`** (ISO strings). The newer side wins: either the cloud row is updated from local data or the local row is updated from the cloud.
4. Cloud rows with no local match are **imported** as new local supplies (with `cloud_id` set).

Ties favour **pushing local** to the cloud to avoid unnecessary churn.

## Offline queue

When `navigator.onLine` is false:

- **`supplies:local-sync`** entries hold the latest payload per **`localId`** (rapid edits **coalesce** — only the newest enqueue remains).
- **`supplies:local-delete`** removes pending sync entries for that local id, then queues the cloud delete (by `cloud_id`).

When the app goes **online**, `flushSuppliesOfflineQueue()` runs (including on the `online` event) and replays queued operations.

Legacy queue kinds (`supplies:add` / `update` / `delete` by cloud id) are still flushed for older queued data.

## Toasts

- Offline enqueue: **“Change queued; will sync when you're back online.”**
- Online sync failure: **“Couldn't sync now; will retry automatically.”**

## RLS

Policies should restrict `SELECT` / `INSERT` / `UPDATE` / `DELETE` on `public.supplies` so each row’s `user_id` matches **`auth.uid()`**. JWT / RLS errors (e.g. **PGRST301**) should not corrupt the queue; failed items remain for a later retry after refresh or re-auth.

## Related SQL

See `docs/sql/supplies_sync.sql` for the expected table shape (do not run from this repo automatically).
