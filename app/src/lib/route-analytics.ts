/**
 * Privacy-first route analytics: records which screens signed-in users visit
 * (normalised paths only — no query strings, no clinical data) into the
 * `app_route_views` Supabase table. The owner reads results in the SQL Editor;
 * the client is write-only and fire-and-forget.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const QUEUE_KEY = "diabeater_route_view_queue_v1";
const MAX_QUEUE = 200;
const FLUSH_INTERVAL_MS = 15_000;

/** Never captured (defensive — the tracker only mounts in the signed-in shell). */
const BLOCKED_PREFIXES = [
  "/login",
  "/signup",
  "/auth-callback",
  "/auth-confirm",
  "/reset-password",
  "/reset-request",
  "/check-email",
  "/email-verify",
  "/verified-return",
  "/verified-success",
];

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Long opaque ids (hex/base62) used in post/thread/message style routes. */
const OPAQUE_ID_SEGMENT = /^(?=.*[0-9])[0-9a-zA-Z_-]{16,}$/;

/**
 * Normalise a raw location into an aggregatable route pattern:
 * strips query/hash and collapses dynamic segments, e.g.
 * `/community/profile/3f2a…-uuid` → `/community/profile/:id`,
 * `/community/u/ollie` → `/community/u/:handle`.
 * Returns null for anything that should not be recorded.
 */
export function normaliseRoute(rawPath: string | null | undefined): string | null {
  if (!rawPath) return null;
  const pathOnly = rawPath.split(/[?#]/)[0]?.trim() ?? "";
  if (!pathOnly.startsWith("/")) return null;
  if (BLOCKED_PREFIXES.some((p) => pathOnly === p || pathOnly.startsWith(`${p}/`))) return null;

  const segments = pathOnly.split("/").filter(Boolean);
  if (segments.length === 0) return "/";

  const normalised = segments.map((segment, index) => {
    const prev = segments[index - 1];
    const prev2 = segments[index - 2];
    // /community/u/<handle>
    if (prev === "u" && prev2 === "community") return ":handle";
    // /community/profile/<id>, /community/post/<id>, etc.
    if (UUID_SEGMENT.test(segment) || OPAQUE_ID_SEGMENT.test(segment)) return ":id";
    return segment;
  });

  return `/${normalised.join("/")}`;
}

type QueuedRouteView = { route: string; at: string };

function readQueue(): QueuedRouteView[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is QueuedRouteView =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as QueuedRouteView).route === "string" &&
          typeof (item as QueuedRouteView).at === "string",
      )
      .slice(-MAX_QUEUE);
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedRouteView[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    /* storage unavailable — analytics must never break the app */
  }
}

let lastRecordedRoute: string | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;

/** Queue one screen view. Consecutive duplicates (re-renders) are ignored. */
export function recordRouteView(rawPath: string | null | undefined): void {
  const route = normaliseRoute(rawPath);
  if (!route) return;
  if (route === lastRecordedRoute) return;
  lastRecordedRoute = route;

  const queue = readQueue();
  queue.push({ route, at: new Date().toISOString() });
  writeQueue(queue);
  void flushRouteViews();
}

/** Send queued views to Supabase in one batch. Safe to call often; never throws. */
export async function flushRouteViews(): Promise<void> {
  if (flushing) return;
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabase();
  if (!supabase) return;

  const queue = readQueue();
  if (queue.length === 0) return;

  flushing = true;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return; // signed out — keep the queue capped for a later session

    const batch = queue.slice(0, MAX_QUEUE);
    const { error } = await supabase.from("app_route_views").insert(
      batch.map((item) => ({ user_id: userId, route: item.route, created_at: item.at })),
    );
    if (error) return; // table may not exist yet — retry on the next flush

    const remaining = readQueue().slice(batch.length);
    writeQueue(remaining);
  } catch {
    /* fire-and-forget */
  } finally {
    flushing = false;
  }
}

/** Start periodic + on-background flushing. Idempotent. */
export function initRouteAnalytics(): void {
  if (flushTimer != null) return;
  flushTimer = setInterval(() => {
    void flushRouteViews();
  }, FLUSH_INTERVAL_MS);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flushRouteViews();
    });
  }
}

/** Test hook: reset module-level dedupe/flush state. */
export function resetRouteAnalyticsForTests(): void {
  lastRecordedRoute = null;
  flushing = false;
  if (flushTimer != null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
