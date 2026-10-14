import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseUrlAndAnonKey } from "@/lib/supabase";

const COMMUNITY_POST_IMAGES_BUCKET = "community_post_images";

const RESUMABLE_MIN_BYTES = 6 * 1024 * 1024;
const RESUMABLE_CHUNK_BYTES = 5 * 1024 * 1024;
/** Copy camera-roll bytes into memory so clearing the file input cannot drop them on iOS. */
const IN_MEMORY_COPY_MAX_BYTES = 96 * 1024 * 1024;

export function feedVideoStorageExt(file: File): "mp4" | "webm" {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (type.includes("webm") || name.endsWith(".webm")) return "webm";
  return "mp4";
}

/**
 * iPhone library clips are usually `video/quicktime`. Storage buckets that only
 * list common video types reject that, so Apple clips go up as MP4 bytes with
 * an MP4 content type. WebM stays WebM.
 */
export function fileForFeedVideoUpload(file: File): File {
  const ext = feedVideoStorageExt(file);
  const type = ext === "webm" ? "video/webm" : "video/mp4";
  const base = (file.name.replace(/\.[^.]+$/, "") || "clip").replace(/[^\w.-]+/g, "-").slice(0, 80);
  const name = `${base || "clip"}.${ext}`;
  if (file.type === type && file.name === name) return file;
  return new File([file], name, { type, lastModified: file.lastModified || Date.now() });
}

async function readOwnedVideoBytes(file: File): Promise<ArrayBuffer | null> {
  const readers = [
    () => file.arrayBuffer(),
    () => file.slice(0, file.size || undefined).arrayBuffer(),
    () => new Response(file).arrayBuffer(),
  ];
  for (const read of readers) {
    try {
      const bytes = await read();
      if (bytes.byteLength === 0) continue;
      if (file.size > 0 && bytes.byteLength !== file.size) continue;
      return bytes;
    } catch {
      /* Try the next reader. iOS and some test environments only support one of these. */
    }
  }
  return null;
}

export async function copyVideoFileForUpload(file: File): Promise<{ file: File; ownsBytes: boolean }> {
  if (file.size <= IN_MEMORY_COPY_MAX_BYTES) {
    const bytes = await readOwnedVideoBytes(file);
    if (bytes) {
      const owned = new File([bytes], file.name || "clip.mp4", {
        type: file.type,
        lastModified: file.lastModified || Date.now(),
      });
      return { file: fileForFeedVideoUpload(owned), ownsBytes: true };
    }
  }
  return { file: fileForFeedVideoUpload(file), ownsBytes: false };
}

export function explainVideoUploadError(message: string): string {
  const raw = message.trim() || "Upload failed";
  const lower = raw.toLowerCase();
  if (
    lower.includes("maximum allowed size") ||
    lower.includes("entity too large") ||
    lower.includes("payload too large") ||
    lower.includes("exceeded the maximum")
  ) {
    return "That video is larger than the server will accept. Choose a shorter clip and try again.";
  }
  if (lower.includes("mime") || lower.includes("content type") || lower.includes("content-type") || lower.includes("not supported")) {
    return "The server rejected that video format. Try another clip from your camera roll.";
  }
  if (lower.includes("load failed") || lower.includes("failed to fetch") || lower.includes("network connection") || lower.includes("networkerror")) {
    return "The upload stopped before it finished. Check your connection and post the video again.";
  }
  if (lower.includes("jwt") || lower.includes("unauthorized") || lower.includes("invalid compact jws")) {
    return "You were signed out before the video finished uploading. Sign in and try again.";
  }
  return raw;
}

export function tusUploadMetadata(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([key, value]) => `${key} ${btoa(value)}`)
    .join(",");
}

function shouldRetryResumableWithStandardUpload(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("404") ||
    lower.includes("method not allowed") ||
    lower.includes("tus") ||
    lower.includes("resumable")
  );
}

async function readResponseMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string; msg?: string };
    return body.message || body.error || body.msg || res.statusText || `Upload failed (${res.status})`;
  } catch {
    return res.statusText || `Upload failed (${res.status})`;
  }
}

export async function resumableUploadFeedVideo(options: {
  endpoint: string;
  file: File;
  bucket: string;
  objectName: string;
  contentType: string;
  accessToken: string;
  anonKey: string;
  upsert: boolean;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const created = await fetchImpl(options.endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      apikey: options.anonKey,
      "x-upsert": String(options.upsert),
      "tus-resumable": "1.0.0",
      "upload-length": String(options.file.size),
      "upload-metadata": tusUploadMetadata({
        bucketName: options.bucket,
        objectName: options.objectName,
        contentType: options.contentType,
        cacheControl: "604800",
      }),
    },
  });
  if (!created.ok && created.status !== 201) {
    throw new Error(await readResponseMessage(created));
  }
  const locationHeader = created.headers.get("location");
  if (!locationHeader) {
    throw new Error("Resumable upload did not return a location.");
  }
  const location = new URL(locationHeader, options.endpoint).toString();

  let offset = 0;
  while (offset < options.file.size) {
    const end = Math.min(options.file.size, offset + RESUMABLE_CHUNK_BYTES);
    const chunk = options.file.slice(offset, end);
    let response: Response | null = null;
    let lastMessage = "Upload failed";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetchImpl(location, {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${options.accessToken}`,
            apikey: options.anonKey,
            "tus-resumable": "1.0.0",
            "upload-offset": String(offset),
            "content-type": "application/offset+octet-stream",
          },
          body: chunk,
        });
      } catch (error) {
        lastMessage = error instanceof Error ? error.message : "Upload failed";
        response = null;
        continue;
      }
      if (response.ok || response.status === 204) break;
      lastMessage = await readResponseMessage(response);
      if (response.status !== 409 && response.status < 500) {
        throw new Error(lastMessage);
      }
      response = null;
    }
    if (!response || (!response.ok && response.status !== 204)) {
      throw new Error(lastMessage);
    }
    const nextHeader = response.headers.get("upload-offset");
    const next = nextHeader != null && nextHeader !== "" ? Number(nextHeader) : end;
    offset = Number.isFinite(next) && next > offset ? next : end;
  }
}

export type VideoUploadResponse = {
  status: number;
  location: string | null;
  uploadOffset: string | null;
  text: string;
};

export function storageObjectUploadUrl(supabaseUrl: string, objectPath: string): string {
  const encoded = objectPath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${COMMUNITY_POST_IMAGES_BUCKET}/${encoded}`;
}

export function feedVideoContentType(file: File): string {
  return feedVideoStorageExt(file) === "webm" ? "video/webm" : "video/mp4";
}

function storageErrorText(status: number, text: string): string {
  try {
    const body = JSON.parse(text) as { message?: string; error?: string; msg?: string };
    return body.message || body.error || body.msg || `Upload failed (${status})`;
  } catch {
    return text.trim() || `Upload failed (${status})`;
  }
}

/** XMLHttpRequest streams a camera-roll file. fetch() on iPhone aborts that body with "Load failed". */
export function xhrUpload(options: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Blob | null;
}): Promise<VideoUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method, options.url);
    xhr.timeout = 0;
    for (const [key, value] of Object.entries(options.headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        location: xhr.getResponseHeader("location"),
        uploadOffset: xhr.getResponseHeader("upload-offset"),
        text: xhr.responseText || "",
      });
    };
    xhr.onerror = () => reject(new Error("Load failed"));
    xhr.ontimeout = () => reject(new Error("The upload timed out."));
    xhr.send(options.body ?? null);
  });
}

async function uploadOriginalVideo(options: {
  supabaseUrl: string;
  accessToken: string;
  anonKey: string;
  objectPath: string;
  file: File;
  upsert: boolean;
  send?: typeof xhrUpload;
}): Promise<void> {
  const send = options.send ?? xhrUpload;
  const contentType = feedVideoContentType(options.file);
  const response = await send({
    url: storageObjectUploadUrl(options.supabaseUrl, options.objectPath),
    method: "POST",
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      apikey: options.anonKey,
      "x-upsert": String(options.upsert),
      "cache-control": "max-age=604800",
      "content-type": contentType,
    },
    body: options.file,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(storageErrorText(response.status, response.text));
  }
}

async function resumableUploadWithXhr(options: {
  endpoint: string;
  file: File;
  objectName: string;
  contentType: string;
  accessToken: string;
  anonKey: string;
  upsert: boolean;
  send?: typeof xhrUpload;
}): Promise<void> {
  const send = options.send ?? xhrUpload;
  const created = await send({
    url: options.endpoint,
    method: "POST",
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      apikey: options.anonKey,
      "x-upsert": String(options.upsert),
      "tus-resumable": "1.0.0",
      "upload-length": String(options.file.size),
      "upload-metadata": tusUploadMetadata({
        bucketName: COMMUNITY_POST_IMAGES_BUCKET,
        objectName: options.objectName,
        contentType: options.contentType,
        cacheControl: "604800",
      }),
    },
    body: null,
  });
  if (created.status < 200 || created.status >= 300) {
    throw new Error(storageErrorText(created.status, created.text));
  }
  if (!created.location) throw new Error("Resumable upload did not return a location.");
  const location = new URL(created.location, options.endpoint).toString();

  let offset = 0;
  while (offset < options.file.size) {
    const end = Math.min(options.file.size, offset + RESUMABLE_CHUNK_BYTES);
    const response = await send({
      url: location,
      method: "PATCH",
      headers: {
        authorization: `Bearer ${options.accessToken}`,
        apikey: options.anonKey,
        "tus-resumable": "1.0.0",
        "upload-offset": String(offset),
        "content-type": "application/offset+octet-stream",
      },
      body: options.file.slice(offset, end),
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(storageErrorText(response.status, response.text));
    }
    const next = response.uploadOffset != null && response.uploadOffset !== "" ? Number(response.uploadOffset) : end;
    offset = Number.isFinite(next) && next > offset ? next : end;
  }
}

function isChunkUploadUnavailable(message: string): boolean {
  return shouldRetryResumableWithStandardUpload(message) || message.toLowerCase().includes("load failed");
}

/** Upload a feed video straight to its final storage path. */
export async function uploadFeedVideoFile(
  supabase: SupabaseClient,
  path: string,
  source: File,
): Promise<void> {
  const env = getSupabaseUrlAndAnonKey();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? "";

  const attempt = async (upsert: boolean) => {
    if (env && accessToken) {
      try {
        await uploadOriginalVideo({
          supabaseUrl: env.url,
          accessToken,
          anonKey: env.anonKey,
          objectPath: path,
          file: source,
          upsert,
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        const retryInChunks = source.size >= RESUMABLE_MIN_BYTES && isChunkUploadUnavailable(message);
        if (!retryInChunks) throw new Error(message);
      }
      await resumableUploadWithXhr({
        endpoint: `${env.url}/storage/v1/upload/resumable`,
        file: source,
        objectName: path,
        contentType: feedVideoContentType(source),
        accessToken,
        anonKey: env.anonKey,
        upsert,
      });
      return;
    }

    const prepared = fileForFeedVideoUpload(source);
    const { error } = await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).upload(path, prepared, {
      cacheControl: "604800",
      upsert,
      contentType: prepared.type || "video/mp4",
    });
    if (error) throw new Error(error.message);
  };

  try {
    await attempt(false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const lower = message.toLowerCase();
    if (lower.includes("already exists") || lower.includes("duplicate")) {
      await attempt(true);
      return;
    }
    throw new Error(explainVideoUploadError(message));
  }
}
