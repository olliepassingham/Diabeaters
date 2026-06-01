#!/usr/bin/env node
/**
 * Verify Supabase push pipeline from your machine.
 *
 * End-to-end (APNs + DB token lookup inside Edge):
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_ANON_KEY=eyJ... \
 *   SUPABASE_USER_JWT=eyJ... \   # access_token from a signed-in app session (see below)
 *   node scripts/verify-push-notifications.mjs
 *
 * Database only (tables reachable with service role — does not send APNs):
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/verify-push-notifications.mjs --db-only
 *
 * Get SUPABASE_USER_JWT: sign in to the app in the browser → DevTools → Application →
 * Local Storage → find the Supabase auth key for your project → `access_token` value.
 * Or Safari Web Inspector on device for the Capacitor WebView.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Load repo root `.env` / `.env.local` / `app/.env.local` so `npm run verify:push` works without manual `export`. */
function loadRepoEnv() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const paths = [join(root, ".env.local"), join(root, ".env"), join(root, "app", ".env.local")];
  for (const filePath of paths) {
    if (!existsSync(filePath)) continue;
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
  }
}

loadRepoEnv();

function arg(name) {
  const p = process.argv.find((a) => a === name || a.startsWith(`${name}=`));
  if (!p) return null;
  if (p.includes("=")) return p.split("=").slice(1).join("=");
  const i = process.argv.indexOf(p);
  return process.argv[i + 1] ?? null;
}

const dbOnly = process.argv.includes("--db-only");
const showHelp = process.argv.includes("--help") || process.argv.includes("-h");

if (showHelp) {
  console.log(`Usage:
  End-to-end (Edge notify_push_test → APNs):
    SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_USER_JWT=... node scripts/verify-push-notifications.mjs

  Database tables only (service role — add once to **.env.local**, never commit):
    SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Dashboard → Settings → API → service_role
    npm run verify:push -- --db-only

  Repo root = folder containing this repo's package.json. From anywhere:
    cd /path/to/Diabeaters && npm run verify:push -- --db-only
`);
  process.exit(0);
}

const supabaseUrl = (process.env.SUPABASE_URL || arg("--url") || "").replace(/\/$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY || arg("--anon-key") || "";
const userJwt = process.env.SUPABASE_USER_JWT || arg("--jwt") || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || arg("--service-role") || "";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function dbProbe() {
  if (!supabaseUrl) fail("Missing SUPABASE_URL");
  if (!serviceKey) fail("Missing SUPABASE_SERVICE_ROLE_KEY (required for --db-only)");

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: "application/json",
  };

  for (const table of ["push_tokens", "notification_preferences"]) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=user_id&limit=1`, { headers });
    const ok = res.ok;
    const snippet = (await res.text()).slice(0, 200);
    console.log(`[db] ${table}: HTTP ${res.status} ${ok ? "OK" : "FAIL"} ${snippet ? `body: ${snippet}` : ""}`);
    if (!ok && res.status === 404) {
      console.error(`  → Table "${table}" may be missing. Apply docs/sql/notifications.sql or migrations.`);
    }
  }
}

async function edgePushTest() {
  if (!supabaseUrl) fail("Missing SUPABASE_URL");
  if (!anonKey) fail("Missing SUPABASE_ANON_KEY");
  if (!userJwt) fail("Missing SUPABASE_USER_JWT (user access_token, not service role)");

  const res = await fetch(`${supabaseUrl}/functions/v1/notify_push_test`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${userJwt}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("[edge] Non-JSON response", res.status, text.slice(0, 500));
    process.exit(1);
  }

  console.log("[edge] notify_push_test HTTP", res.status);
  console.log(JSON.stringify(json, null, 2));

  if (json.error === "push_not_configured") {
    console.error("\n→ Set APNS_* secrets for iOS and/or FCM_SERVICE_ACCOUNT_JSON for Android on Edge Functions (or PUSH_NOTIFICATION_API_URL).");
  }
  if (json.error === "no_push_token") {
    console.error("\n→ Open the native app on a device, enable Push in Settings → Notifications, then retry.");
  }
  if (json.success === true && json.delivered_push === 0 && (json.tokens ?? 0) > 0) {
    console.error("\n→ Push provider rejected the token (iOS: check APNS_USE_SANDBOX vs TestFlight/App Store, bundle id; Android: check FCM_SERVICE_ACCOUNT_JSON and google-services.json). See Edge logs.");
  }
}

if (dbOnly) {
  await dbProbe();
} else {
  await edgePushTest();
}
