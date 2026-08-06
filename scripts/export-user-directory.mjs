#!/usr/bin/env node
/**
 * Export signed-up accounts from public.admin_user_directory to Excel.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm install --no-save exceljs && node scripts/export-user-directory.mjs
 *
 * Or put those keys in repo-root `.env.local` (never commit) and run:
 *   npm install --no-save exceljs && node scripts/export-user-directory.mjs
 *
 * Output (default): ~/Downloads/diabeaters-user-directory.xlsx
 * Override: USER_DIRECTORY_OUT=/path/to/file.xlsx or --out=/path/to/file.xlsx
 *
 * This is signups, not App Store / Play Store download lists.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PAGE_SIZE = 1000;

function arg(name) {
  const p = process.argv.find((a) => a === name || a.startsWith(`${name}=`));
  if (!p) return null;
  if (p.includes("=")) return p.split("=").slice(1).join("=");
  const i = process.argv.indexOf(p);
  return process.argv[i + 1] ?? null;
}

const outPath =
  process.env.USER_DIRECTORY_OUT ||
  arg("--out") ||
  join(homedir(), "Downloads", "diabeaters-user-directory.xlsx");

/** Load repo root `.env` / `.env.local` / `app/.env.local` without overriding existing env. */
function loadRepoEnv() {
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
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function isoOrEmpty(v) {
  if (v == null || v === "") return "";
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : String(v);
}

async function fetchAll(urlBase, headers, select, order) {
  const rows = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const qs = new URLSearchParams({ select });
    if (order) qs.set("order", order);
    const res = await fetch(`${urlBase}?${qs}`, {
      headers: {
        ...headers,
        Range: `${from}-${to}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 400);
      const err = new Error(`Fetch failed HTTP ${res.status}: ${body}`);
      err.status = res.status;
      throw err;
    }
    const batch = await res.json();
    if (!Array.isArray(batch)) fail("Unexpected response (expected JSON array)");
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

loadRepoEnv();

const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl) fail("Missing SUPABASE_URL (or VITE_SUPABASE_URL in .env.local)");
if (!serviceKey) {
  fail(
    "Missing SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API → service_role). Add to .env.local — never commit.",
  );
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  Accept: "application/json",
};

async function main() {
  const directoryUrl = `${supabaseUrl}/rest/v1/admin_user_directory`;
  let users;
  try {
    users = await fetchAll(
      directoryUrl,
      headers,
      [
        "id",
        "email",
        "phone",
        "auth_created_at",
        "last_sign_in_at",
        "email_confirmed_at",
        "full_name",
        "public_handle",
        "primary_app_role",
        "account_type",
        "is_public",
        "onboarding_complete",
        "diabetes_onset_date",
      ].join(","),
      "auth_created_at.asc",
    );
  } catch (err) {
    fail(err?.message ?? String(err));
  }

  /** @type {Map<string, Set<string>>} */
  const platformsByUser = new Map();
  try {
    const tokens = await fetchAll(`${supabaseUrl}/rest/v1/push_tokens`, headers, "user_id,platform", null);
    for (const t of tokens) {
      if (!t?.user_id || !t?.platform) continue;
      let set = platformsByUser.get(t.user_id);
      if (!set) {
        set = new Set();
        platformsByUser.set(t.user_id, set);
      }
      set.add(String(t.platform));
    }
  } catch (err) {
    console.warn(`Could not load push_tokens — continuing without platforms (${err?.message ?? err})`);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Diabeaters ops";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Users", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "id", key: "id", width: 38 },
    { header: "email", key: "email", width: 36 },
    { header: "phone", key: "phone", width: 16 },
    { header: "full_name", key: "full_name", width: 24 },
    { header: "public_handle", key: "public_handle", width: 18 },
    { header: "primary_app_role", key: "primary_app_role", width: 16 },
    { header: "account_type", key: "account_type", width: 14 },
    { header: "onboarding_complete", key: "onboarding_complete", width: 18 },
    { header: "is_public", key: "is_public", width: 10 },
    { header: "auth_created_at", key: "auth_created_at", width: 24 },
    { header: "last_sign_in_at", key: "last_sign_in_at", width: 24 },
    { header: "email_confirmed_at", key: "email_confirmed_at", width: 24 },
    { header: "diabetes_onset_date", key: "diabetes_onset_date", width: 18 },
    { header: "has_native_push_token", key: "has_native_push_token", width: 20 },
    { header: "push_platforms", key: "push_platforms", width: 16 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EEF5" },
  };

  for (const u of users) {
    const platforms = platformsByUser.get(u.id);
    sheet.addRow({
      id: u.id ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      full_name: u.full_name ?? "",
      public_handle: u.public_handle ?? "",
      primary_app_role: u.primary_app_role ?? "",
      account_type: u.account_type ?? "",
      onboarding_complete: u.onboarding_complete === true,
      is_public: u.is_public === true,
      auth_created_at: isoOrEmpty(u.auth_created_at),
      last_sign_in_at: isoOrEmpty(u.last_sign_in_at),
      email_confirmed_at: isoOrEmpty(u.email_confirmed_at),
      diabetes_onset_date: u.diabetes_onset_date ?? "",
      has_native_push_token: Boolean(platforms?.size),
      push_platforms: platforms ? [...platforms].sort().join(",") : "",
    });
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: users.length + 1, column: sheet.columns.length },
  };

  const meta = workbook.addWorksheet("Meta");
  meta.getCell("A1").value = "Diabeaters user directory export";
  meta.getCell("A1").font = { bold: true, size: 14 };
  meta.getCell("A3").value = "Source";
  meta.getCell("B3").value = "public.admin_user_directory (+ push_tokens platforms)";
  meta.getCell("A4").value = "Generated";
  meta.getCell("B4").value = new Date().toISOString();
  meta.getCell("A5").value = "Rows";
  meta.getCell("B5").value = users.length;
  meta.getCell("A6").value = "Project URL";
  meta.getCell("B6").value = supabaseUrl;
  meta.getCell("A8").value = "Caveat";
  meta.getCell("A8").font = { bold: true };
  meta.getCell("A9").value =
    "These are signed-up accounts only — not App Store / Play Store download or install lists.";
  meta.getCell("A10").value =
    "has_native_push_token / push_platforms are a weak native-use signal (users who registered push), not proof of store download.";
  meta.getCell("A12").value = "Regenerate";
  meta.getCell("B12").value =
    "npm install --no-save exceljs && node scripts/export-user-directory.mjs";
  meta.getCell("A13").value = "Output";
  meta.getCell("B13").value = outPath;
  meta.getCell("A14").value = "Privacy";
  meta.getCell("B14").value =
    "Contains PII. Default path is ~/Downloads — do not commit, push, or share casually.";
  meta.columns = [{ width: 14 }, { width: 96 }];

  mkdirSync(dirname(outPath), { recursive: true });
  await workbook.xlsx.writeFile(outPath);

  const withPush = users.filter((u) => platformsByUser.has(u.id)).length;
  console.log(`Wrote ${outPath}`);
  console.log(`${users.length} signed-up users (${withPush} with push token platform)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
