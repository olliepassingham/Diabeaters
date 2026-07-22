/**
 * Direct messages: dm_threads, dm_thread_members, dm_messages (Supabase + RLS).
 * Optional images use bucket `community_post_images` (paths `{uid}/dm/{thread_id}/…`).
 */
import { buildPublicAppUrl } from "@/lib/auth-app-url";
import { logEdgeInvokeFailure } from "@/lib/dev-log";
import { notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import { markDmInAppNotificationsReadForThread } from "@/lib/in-app-notifications-supabase";
import { getSupabase } from "@/lib/supabase";
import { getBlockStatus } from "./blocks-supabase";
import { COMMUNITY_POST_IMAGES_BUCKET } from "./posts-supabase";
import type { DmMessageRow, DmThreadMemberRow, DmThreadRow } from "./types";

export function dmMessagingBlockedError(): Error {
  return new Error("Messaging is not available (blocked).");
}

function isDmBlockedErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("dm_not_allowed") || m.includes("blocked") || m.includes("row-level security");
}

const MAX_DM_IMAGE_BYTES = 5 * 1024 * 1024;

export type DmThreadUserSettingsRow = {
  thread_id: string;
  muted: boolean;
  hidden: boolean;
};

function extFromFile(f: File): string {
  const name = f.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".gif")) return "gif";
  if (name.endsWith(".heic")) return "heic";
  return "jpg";
}

function validateDmImageFile(f: File): Error | null {
  if (f.size > MAX_DM_IMAGE_BYTES) return new Error("Image must be 5MB or smaller.");
  if (!f.type.startsWith("image/")) return new Error("Only image files are allowed.");
  return null;
}

async function signedUrlForStoragePath(path: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function mapThread(r: Record<string, unknown>): DmThreadRow {
  return {
    id: String(r.id),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

function mapMember(r: Record<string, unknown>): DmThreadMemberRow {
  return {
    thread_id: String(r.thread_id),
    user_id: String(r.user_id),
    joined_at: String(r.joined_at ?? ""),
  };
}

function mapMessage(r: Record<string, unknown>): DmMessageRow {
  const img = r.image_storage_path;
  return {
    id: String(r.id),
    thread_id: String(r.thread_id),
    sender_id: String(r.sender_id),
    body: String(r.body ?? ""),
    image_storage_path: typeof img === "string" && img.trim() ? img : null,
    created_at: String(r.created_at ?? ""),
    read_at: r.read_at == null ? null : String(r.read_at),
    deleted_at: r.deleted_at == null ? null : String(r.deleted_at),
    edited_at: r.edited_at == null ? null : String(r.edited_at),
  };
}

async function enrichDmMessagesWithLikesAndImages(messages: DmMessageRow[]): Promise<DmMessageRow[]> {
  if (messages.length === 0) return [];
  const supabase = getSupabase();
  if (!supabase) return messages;

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id ?? null;
  const ids = messages.map((m) => m.id);

  const uniquePaths = [...new Set(messages.map((m) => m.image_storage_path).filter(Boolean))] as string[];

  const [likesRes, pathTuples] = await Promise.all([
    supabase.from("dm_message_likes").select("message_id, user_id").in("message_id", ids),
    Promise.all(
      uniquePaths.map(async (p) => [p, await signedUrlForStoragePath(p)] as const),
    ),
  ]);

  if (likesRes.error && import.meta.env.DEV) {
    console.warn("[dm] likes fetch", likesRes.error.message);
  }

  const likeRows = likesRes.error ? [] : (likesRes.data ?? []);

  const countMap = new Map<string, number>();
  const myLikes = new Set<string>();
  for (const row of likeRows) {
    const rec = row as { message_id: string; user_id: string };
    const mid = String(rec.message_id);
    countMap.set(mid, (countMap.get(mid) ?? 0) + 1);
    if (uid && String(rec.user_id) === uid) myLikes.add(mid);
  }

  const urlByPath = new Map<string, string>();
  for (const [p, url] of pathTuples) {
    if (url) urlByPath.set(p, url);
  }

  return messages.map((m) => ({
    ...m,
    like_count: countMap.get(m.id) ?? 0,
    liked_by_me: myLikes.has(m.id),
    image_signed_url: m.image_storage_path ? urlByPath.get(m.image_storage_path) ?? null : null,
  }));
}

export async function getOrCreateDmThread(otherUserId: string): Promise<{
  data: string | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data, error } = await supabase.rpc("get_or_create_dm_thread", {
    p_other_user: otherUserId,
  });

  if (error) {
    if (isDmBlockedErrorMessage(error.message)) return { data: null, error: dmMessagingBlockedError() };
    return { data: null, error: new Error(error.message) };
  }
  if (data == null) return { data: null, error: new Error("No thread id returned") };
  return { data: String(data), error: null };
}

export async function isDmThreadBlockedForCurrentUser(threadId: string): Promise<{
  blocked: boolean;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { blocked: false, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { blocked: false, error: new Error("Not signed in") };

  const memRes = await fetchDmThreadMembers(threadId);
  if (memRes.error) return { blocked: false, error: memRes.error };

  const other = otherMemberUserId(memRes.data ?? [], uid);
  if (!other) return { blocked: false, error: null };

  const { status, error } = await getBlockStatus(other);
  if (error) return { blocked: false, error };
  return { blocked: status.iBlockedThem || status.theyBlockedMe, error: null };
}

export type ThreadWithMembers = DmThreadRow & { members: DmThreadMemberRow[] };

export async function fetchDmThreadsForCurrentUser(): Promise<{
  data: ThreadWithMembers[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const { data: myMemberships, error: mErr } = await supabase
    .from("dm_thread_members")
    .select("thread_id")
    .eq("user_id", uid);

  if (mErr) return { data: null, error: new Error(mErr.message) };

  const threadIds = [...new Set((myMemberships ?? []).map((r) => String((r as { thread_id: string }).thread_id)))];
  if (threadIds.length === 0) return { data: [], error: null };

  const { data: threads, error: tErr } = await supabase
    .from("dm_threads")
    .select("*")
    .in("id", threadIds)
    .order("updated_at", { ascending: false });

  if (tErr) return { data: null, error: new Error(tErr.message) };

  const { data: allMembers, error: memErr } = await supabase
    .from("dm_thread_members")
    .select("*")
    .in("thread_id", threadIds);

  if (memErr) return { data: null, error: new Error(memErr.message) };

  const membersByThread = new Map<string, DmThreadMemberRow[]>();
  for (const row of allMembers ?? []) {
    const m = mapMember(row as Record<string, unknown>);
    const list = membersByThread.get(m.thread_id) ?? [];
    list.push(m);
    membersByThread.set(m.thread_id, list);
  }

  const withMembers: ThreadWithMembers[] = (threads ?? []).map((t) => {
    const tr = mapThread(t as Record<string, unknown>);
    return { ...tr, members: membersByThread.get(tr.id) ?? [] };
  });

  return { data: withMembers, error: null };
}

/** Members for a single thread (peer resolution without loading every thread). */
export async function fetchDmThreadMembers(threadId: string): Promise<{
  data: DmThreadMemberRow[];
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };

  const { data, error } = await supabase.from("dm_thread_members").select("*").eq("thread_id", threadId);
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []).map((r) => mapMember(r as Record<string, unknown>)), error: null };
}

export async function fetchDmThreadUserSettings(threadIds: string[]): Promise<{
  data: Map<string, DmThreadUserSettingsRow>;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: new Map(), error: new Error("Supabase not configured") };
  if (threadIds.length === 0) return { data: new Map(), error: null };

  const { data, error } = await supabase
    .from("dm_thread_user_settings")
    .select("thread_id, muted, hidden")
    .in("thread_id", threadIds);

  if (error) return { data: new Map(), error: new Error(error.message) };
  const map = new Map<string, DmThreadUserSettingsRow>();
  for (const row of data ?? []) {
    const r = row as { thread_id: string; muted: boolean; hidden: boolean };
    map.set(String(r.thread_id), { thread_id: String(r.thread_id), muted: Boolean(r.muted), hidden: Boolean(r.hidden) });
  }
  return { data: map, error: null };
}

export async function upsertDmThreadUserSettings(
  threadId: string,
  updates: { muted?: boolean; hidden?: boolean },
): Promise<{ data: DmThreadUserSettingsRow | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };
  const { data, error } = await supabase.rpc("upsert_dm_thread_user_settings", {
    p_thread_id: threadId,
    p_muted: updates.muted ?? null,
    p_hidden: updates.hidden ?? null,
  });
  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: new Error("No row returned") };
  const r = data as { thread_id: string; muted: boolean; hidden: boolean };
  return { data: { thread_id: String(r.thread_id), muted: Boolean(r.muted), hidden: Boolean(r.hidden) }, error: null };
}

export async function fetchDmMessages(threadId: string): Promise<{
  data: DmMessageRow[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("dm_messages")
    .select("*")
    .eq("thread_id", threadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) return { data: null, error: new Error(error.message) };
  const mapped = (data ?? []).map((r) => mapMessage(r as Record<string, unknown>));
  return { data: await enrichDmMessagesWithLikesAndImages(mapped), error: null };
}

/**
 * Marks every message from other participants in this thread as read for the current user.
 * Used when opening the chat so the inbox unread badge matches `read_at` on `dm_messages`.
 */
export async function markIncomingDmMessagesAsReadInThread(threadId: string): Promise<{
  readAt: string | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { readAt: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { readAt: null, error: null };

  const readAt = new Date().toISOString();
  const { error } = await supabase
    .from("dm_messages")
    .update({ read_at: readAt })
    .eq("thread_id", threadId)
    .neq("sender_id", uid)
    .is("read_at", null)
    .is("deleted_at", null);

  if (error) return { readAt: null, error: new Error(error.message) };

  void markDmInAppNotificationsReadForThread(threadId)
    .then((res) => {
      if (res.error) return;
      notifyInAppNotificationsChanged({ skipPageRefresh: true });
    })
    .catch(() => {
      // Non-fatal; badge sync will still use dm_messages read_at.
    });

  return { readAt, error: null };
}

/** Latest message per thread — prefers single RPC round-trip when deployed. */
export async function fetchLatestDmMessageForThreads(threadIds: string[]): Promise<{
  data: Map<string, DmMessageRow | null>;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { data: new Map(), error: new Error("Supabase not configured") };
  }
  if (threadIds.length === 0) return { data: new Map(), error: null };

  const rpcRes = await supabase.rpc("latest_dm_messages_for_threads", {
    p_thread_ids: threadIds,
  });

  if (!rpcRes.error) {
    const map = new Map<string, DmMessageRow | null>();
    for (const tid of threadIds) {
      map.set(tid, null);
    }
    for (const row of (rpcRes.data ?? []) as Record<string, unknown>[]) {
      const m = mapMessage(row);
      map.set(m.thread_id, m);
    }
    return { data: map, error: null };
  }

  const errMsg = rpcRes.error.message.toLowerCase();
  if (
    !errMsg.includes("could not find") &&
    !errMsg.includes("function") &&
    !errMsg.includes("schema cache")
  ) {
    return { data: new Map(), error: new Error(rpcRes.error.message) };
  }

  if (import.meta.env.DEV) {
    console.warn("[dm] latest_dm_messages_for_threads unavailable; using per-thread fallback.", rpcRes.error.message);
  }

  const results = await Promise.all(
    threadIds.map(async (tid) => {
      const { data, error } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("thread_id", tid)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return { tid, err: new Error(error.message), row: null as DmMessageRow | null };
      if (!data) return { tid, err: null, row: null };
      return { tid, err: null, row: mapMessage(data as Record<string, unknown>) };
    }),
  );

  const failed = results.find((r) => r.err);
  if (failed?.err) return { data: new Map(), error: failed.err };

  const map = new Map<string, DmMessageRow | null>();
  for (const r of results) {
    map.set(r.tid, r.row);
  }
  return { data: map, error: null };
}

export async function insertDmMessage(
  threadId: string,
  body: string,
  options?: { imageFile?: File | null },
): Promise<{
  data: DmMessageRow | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const trimmed = body.trim();
  const file = options?.imageFile ?? null;
  if (file) {
    const v = validateDmImageFile(file);
    if (v) return { data: null, error: v };
  }
  if (!trimmed && !file) return { data: null, error: new Error("Add a message or a photo.") };

  const blockRes = await isDmThreadBlockedForCurrentUser(threadId);
  if (blockRes.error) return { data: null, error: blockRes.error };
  if (blockRes.blocked) return { data: null, error: dmMessagingBlockedError() };

  let imagePath: string | null = null;
  if (file) {
    const ext = extFromFile(file);
    const path = `${uid}/dm/${threadId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (upErr) return { data: null, error: new Error(upErr.message) };
    imagePath = path;
  }

  const insertPayload: Record<string, unknown> = {
    thread_id: threadId,
    sender_id: uid,
    body: trimmed || "",
  };
  if (imagePath) insertPayload.image_storage_path = imagePath;

  const { data, error } = await supabase.from("dm_messages").insert(insertPayload).select("*").single();

  if (error) {
    if (imagePath) {
      await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).remove([imagePath]);
    }
    if (isDmBlockedErrorMessage(error.message)) return { data: null, error: dmMessagingBlockedError() };
    return { data: null, error: new Error(error.message) };
  }
  if (!data) return { data: null, error: new Error("No row returned") };
  const row = mapMessage(data as Record<string, unknown>);
  const enriched = await enrichDmMessagesWithLikesAndImages([row]);
  const out = enriched[0] ?? row;

  void supabase.functions
    .invoke("notify_dm_push", { body: { thread_id: threadId, message_id: out.id } })
    .then(({ error: fnErr }) => {
      if (fnErr) logEdgeInvokeFailure("notify_dm_push", fnErr.message);
    });

  return { data: out, error: null };
}

/**
 * Unsend your own message while the recipient has not read it yet.
 * Server-enforced via `delete_unread_dm_message` (sender + unread only).
 */
export async function deleteUnreadDmMessage(messageId: string): Promise<{
  deleted: boolean;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { deleted: false, error: new Error("Supabase not configured") };

  const id = messageId.trim();
  if (!id) return { deleted: false, error: new Error("Missing message") };

  const { data, error } = await supabase.rpc("delete_unread_dm_message", { p_message_id: id });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("could not find") || msg.includes("schema cache") || msg.includes("function")) {
      return {
        deleted: false,
        error: new Error("Delete isn’t available yet — the database update still needs applying."),
      };
    }
    return { deleted: false, error: new Error(error.message) };
  }
  if (data !== true) {
    return {
      deleted: false,
      error: new Error("This message can’t be deleted — it may already have been read."),
    };
  }
  return { deleted: true, error: null };
}

/**
 * Edit your own message body while the recipient has not read it yet.
 * Server-enforced via `edit_unread_dm_message` (sender + unread only).
 */
export async function editUnreadDmMessage(
  messageId: string,
  body: string,
): Promise<{
  edited: boolean;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { edited: false, error: new Error("Supabase not configured") };

  const id = messageId.trim();
  const trimmed = body.trim();
  if (!id) return { edited: false, error: new Error("Missing message") };
  if (trimmed.length > 8000) return { edited: false, error: new Error("Message is too long.") };

  const { data, error } = await supabase.rpc("edit_unread_dm_message", {
    p_message_id: id,
    p_body: trimmed,
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("body_empty")) {
      return { edited: false, error: new Error("Message can’t be empty.") };
    }
    if (msg.includes("body_too_long")) {
      return { edited: false, error: new Error("Message is too long.") };
    }
    if (msg.includes("could not find") || msg.includes("schema cache") || msg.includes("function")) {
      return {
        edited: false,
        error: new Error("Edit isn’t available yet — the database update still needs applying."),
      };
    }
    return { edited: false, error: new Error(error.message) };
  }
  if (data !== true) {
    return {
      edited: false,
      error: new Error("This message can’t be edited — it may already have been read."),
    };
  }
  return { edited: true, error: null };
}

/** Toggle like for the current user (not allowed on own messages). */
export async function toggleDmMessageLike(messageId: string): Promise<{
  liked: boolean;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { liked: false, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { liked: false, error: new Error("Not signed in") };

  const { data: msg, error: msgErr } = await supabase
    .from("dm_messages")
    .select("sender_id")
    .eq("id", messageId)
    .maybeSingle();

  if (msgErr) return { liked: false, error: new Error(msgErr.message) };
  if (!msg) return { liked: false, error: new Error("Message not found") };
  if (String((msg as { sender_id: string }).sender_id) === uid) {
    return { liked: false, error: new Error("You can't like your own message") };
  }

  const { data: existing, error: exErr } = await supabase
    .from("dm_message_likes")
    .select("message_id")
    .eq("message_id", messageId)
    .eq("user_id", uid)
    .maybeSingle();

  if (exErr) return { liked: false, error: new Error(exErr.message) };

  if (existing) {
    const { error: delErr } = await supabase
      .from("dm_message_likes")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", uid);
    if (delErr) return { liked: false, error: new Error(delErr.message) };
    return { liked: false, error: null };
  }

  const { error: insErr } = await supabase.from("dm_message_likes").insert({ message_id: messageId, user_id: uid });
  if (insErr) return { liked: false, error: new Error(insErr.message) };
  return { liked: true, error: null };
}

/** Other participant in a 1:1 thread (for display). */
export function otherMemberUserId(members: DmThreadMemberRow[], currentUserId: string): string | null {
  const other = members.find((m) => m.user_id !== currentUserId);
  return other?.user_id ?? null;
}

/** Mirrors `messages.tsx` hidden-list localStorage key. */
const DM_HIDDEN_LOCAL_KEY = "diabeater_dm_hidden_v1";

function readLocalHiddenDmThreadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DM_HIDDEN_LOCAL_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Threads where the latest message is from someone else and still unread (`read_at` unset),
 * excluding conversations hidden locally or in `dm_thread_user_settings`.
 * Same notion as the unread dot on the messages list (hidden threads excluded from the default inbox).
 */
export async function countUnreadDmThreadsForCurrentUser(): Promise<{
  count: number;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { count: 0, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { count: 0, error: null };

  const { data: rpcData, error: rpcErr } = await supabase.rpc("count_unread_dm_threads_for_user", {
    p_user_id: uid,
  });
  if (!rpcErr) {
    const n = typeof rpcData === "number" ? rpcData : Number(rpcData ?? 0);
    return { count: Number.isFinite(n) ? Math.max(0, n) : 0, error: null };
  }

  const threadsRes = await fetchDmThreadsForCurrentUser();
  if (threadsRes.error) return { count: 0, error: threadsRes.error };

  const list = threadsRes.data ?? [];
  if (list.length === 0) return { count: 0, error: null };

  const threadIds = list.map((t) => t.id);
  const hiddenLocal = readLocalHiddenDmThreadIds();
  const [lastRes, settingsRes] = await Promise.all([
    fetchLatestDmMessageForThreads(threadIds),
    fetchDmThreadUserSettings(threadIds),
  ]);

  if (lastRes.error) return { count: 0, error: lastRes.error };
  const settings = settingsRes.data;

  let count = 0;
  for (const t of list) {
    if (hiddenLocal.has(t.id)) continue;
    if (settings.get(t.id)?.hidden) continue;

    const last = lastRes.data.get(t.id) ?? null;
    if (last && last.sender_id !== uid && last.read_at == null) {
      count += 1;
    }
  }

  return { count, error: null };
}

/** Absolute URL when running in the browser so the link opens from notifications / copy-paste. */
export function buildShareFeedPostMessageBody(postId: string): string {
  return `Shared from the feed:\n${buildPublicAppUrl(`/community/post/${postId}`)}`;
}

const FEED_POST_PATH =
  /\/community\/post\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function postIdFromShareLine(line: string): string | null {
  const m = line.match(FEED_POST_PATH);
  return m?.[1] ?? null;
}

/**
 * Inverse of {@link buildShareFeedPostMessageBody} + optional note from {@link sendFeedPostToDmThread}.
 * Used to render an inline post preview in DM instead of raw link text.
 */
export function parseSharedFeedPostMessage(body: string): { note: string | null; postId: string } | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const withNoteSep = "\n\nShared from the feed:\n";
  let note: string | null = null;
  let linkTail: string;

  const sepIdx = trimmed.indexOf(withNoteSep);
  if (sepIdx !== -1) {
    note = trimmed.slice(0, sepIdx).trim() || null;
    linkTail = trimmed.slice(sepIdx + withNoteSep.length);
  } else if (trimmed.startsWith("Shared from the feed:\n")) {
    linkTail = trimmed.slice("Shared from the feed:\n".length);
  } else {
    return null;
  }

  const lines = linkTail
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (const line of lines) {
    const postId = postIdFromShareLine(line);
    if (postId) return { note, postId };
  }
  return null;
}

const STORY_PATH =
  /\/community\?story=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function storyIdFromShareLine(line: string): string | null {
  const m = line.match(STORY_PATH);
  if (m?.[1]) return m[1];
  try {
    const url = new URL(line.trim());
    const id = url.searchParams.get("story");
    return id?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Inverse of {@link buildShareStoryMessageBody} + optional note from {@link sendStoryReplyToDmThread}.
 */
export function parseSharedStoryMessage(body: string): { note: string | null; storyId: string } | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const withNoteSep = "\n\nReplied to your story:\n";
  let note: string | null = null;
  let linkTail: string;

  const sepIdx = trimmed.indexOf(withNoteSep);
  if (sepIdx !== -1) {
    note = trimmed.slice(0, sepIdx).trim() || null;
    linkTail = trimmed.slice(sepIdx + withNoteSep.length);
  } else if (trimmed.startsWith("Replied to your story:\n")) {
    linkTail = trimmed.slice("Replied to your story:\n".length);
  } else {
    return null;
  }

  const lines = linkTail
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (const line of lines) {
    const storyId = storyIdFromShareLine(line);
    if (storyId) return { note, storyId };
  }
  return null;
}

/**
 * Open or create a 1:1 thread and send a feed post link (optional note above the link).
 */
export async function sendFeedPostToDmThread(
  otherUserId: string,
  postId: string,
  optionalNote?: string,
): Promise<{ data: { threadId: string } | null; error: Error | null }> {
  const threadRes = await getOrCreateDmThread(otherUserId);
  if (threadRes.error || !threadRes.data) {
    return { data: null, error: threadRes.error ?? new Error("Could not open chat") };
  }
  const linkBlock = buildShareFeedPostMessageBody(postId);
  const note = optionalNote?.trim();
  const body = note ? `${note}\n\n${linkBlock}` : linkBlock;
  if (body.length > 8000) {
    return { data: null, error: new Error("Message is too long (max 8000 characters).") };
  }
  const msgRes = await insertDmMessage(threadRes.data, body);
  if (msgRes.error) return { data: null, error: msgRes.error };
  return { data: { threadId: threadRes.data }, error: null };
}

/** Absolute URL when running in the browser so the link opens from notifications / copy-paste. */
export function buildShareStoryMessageBody(storyId: string): string {
  return `Replied to your story:\n${buildPublicAppUrl(`/community?story=${storyId}`)}`;
}

/**
 * Open or create a 1:1 thread and send a story reply (optional note above the link).
 */
export async function sendStoryReplyToDmThread(
  otherUserId: string,
  storyId: string,
  optionalNote?: string,
): Promise<{ data: { threadId: string } | null; error: Error | null }> {
  const threadRes = await getOrCreateDmThread(otherUserId);
  if (threadRes.error || !threadRes.data) {
    return { data: null, error: threadRes.error ?? new Error("Could not open chat") };
  }
  const linkBlock = buildShareStoryMessageBody(storyId);
  const note = optionalNote?.trim();
  const body = note ? `${note}\n\n${linkBlock}` : linkBlock;
  if (body.length > 8000) {
    return { data: null, error: new Error("Message is too long (max 8000 characters).") };
  }
  const msgRes = await insertDmMessage(threadRes.data, body);
  if (msgRes.error) return { data: null, error: msgRes.error };
  return { data: { threadId: threadRes.data }, error: null };
}

export { mapMessage as mapDmMessageRow };

export async function enrichDmMessages(messages: DmMessageRow[]): Promise<DmMessageRow[]> {
  return enrichDmMessagesWithLikesAndImages(messages);
}
