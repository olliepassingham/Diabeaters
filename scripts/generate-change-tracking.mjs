#!/usr/bin/env node
/**
 * Builds docs/operations/change-tracking.xlsx from git history on main.
 * Usage: node scripts/generate-change-tracking.mjs
 * Requires: exceljs (npm install --no-save exceljs)
 */
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "docs/operations/change-tracking.xlsx");
const SINCE = process.env.CHANGE_TRACKING_SINCE ?? "2026-07-01";

function classifyArea(subject) {
  const s = subject.toLowerCase();
  if (
    /exercise|workout|fuel & insulin|fuel and insulin|guided coach|carb rounding|exercise mode|recent workout|quick-exercise|status strip|recovery panel|readiness/.test(
      s,
    )
  ) {
    return "Exercise";
  }
  if (/pattern/.test(s)) return "Patterns";
  if (/beatie|feed|community|open graph|og image|whatsapp/.test(s)) return "Feed / Beatie";
  if (/supporter|carer|hypo check-in|check-in respond/.test(s)) return "Supporter";
  if (/meal|ratio/.test(s)) return "Meal";
  if (/bedtime|overnight|last night|alcohol|sleep/.test(s)) return "Bedtime / Overnight";
  if (
    /cgm|dexcom|health connect|live bg|blood glucose|glucose unit|unit converter|possible-low|possible low|glucose chart|glucose overlay/.test(
      s,
    )
  ) {
    return "CGM / Glucose";
  }
  if (/home|hub|guides and tools|de-boxify|finish your setup/.test(s)) return "Home / Hubs";
  if (/direct message|\bdm\b|unread/.test(s)) return "Messaging";
  if (
    /android|ios|play store|version|viewport|scrolling|universal|app links|remote-shell|vercel|native shell|capacitor/.test(
      s,
    )
  ) {
    return "Platform";
  }
  if (
    /appointment|notification|push|haptic|font|dark-mode|dialog|bottom sheet|profile photo|startup|followers|mobile feel|visual pass|tap\//.test(
      s,
    )
  ) {
    return "App UX / Notifications";
  }
  return "Other";
}

function classifyType(subject) {
  const s = subject.toLowerCase();

  // Substantial features / redesigns
  if (
    /\boverhaul\b/.test(s) ||
    /\bredesign\b/.test(s) ||
    /\bfull-screen\b/.test(s) ||
    /\bpause and resume\b/.test(s) ||
    /unify calculations/.test(s) ||
    /respond continuously/.test(s) ||
    /dedicated patterns page/.test(s) ||
    /overlapping-days glucose pattern/.test(s) ||
    /one coherent, calculated recommendation/.test(s) ||
    /auto-fill live cgm across/.test(s) ||
    /prefill bg fields from session cgm/.test(s) ||
    /universal\/app links/.test(s) ||
    /notification action buttons/.test(s) ||
    /bottom sheets on phones/.test(s) ||
    /allow editing and deleting/.test(s) ||
    /allow adjusting recent/.test(s) ||
    /add adjust-before-start/.test(s) ||
    /sync patterns filters/.test(s) ||
    /^add /.test(s) ||
    /^introduce /.test(s)
  ) {
    return "Big change";
  }

  // Polish, fixes, bumps, small UX
  if (
    /^(fix|polish|tighten|simplify|bump|prefer|stop|close|scale|calm|grow|slow|narrow|dedupe|use |make |refresh |restyle|suggest |load |route |resolve |highlight |improve |open shared|render |visual |de-boxify)/.test(
      s,
    )
  ) {
    return "Tweak";
  }

  return "Tweak";
}

function loadCommits() {
  const raw = execSync(
    `git log --since=${SINCE} --pretty=format:%h%x09%ad%x09%s --date=short`,
    { cwd: root, encoding: "utf8" },
  );
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [commit, date, ...rest] = line.split("\t");
      const summary = rest.join("\t").trim();
      return { commit, date, summary };
    })
    .filter((row) => {
      // Drop empty merge noise only
      const s = row.summary.toLowerCase();
      if (s === "merge branch 'main'" || /^merge remote-tracking/.test(s)) return false;
      return true;
    });
}

async function main() {
  const commits = loadCommits();
  const rows = commits.map((c) => ({
    date: c.date,
    commit: c.commit,
    area: classifyArea(c.summary),
    type: classifyType(c.summary),
    summary: c.summary,
    notes: "",
  }));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Diabeaters";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Change tracking", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Commit", key: "commit", width: 10 },
    { header: "Area", key: "area", width: 22 },
    { header: "Type", key: "type", width: 12 },
    { header: "Summary", key: "summary", width: 78 },
    { header: "Notes", key: "notes", width: 36 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EEF5" },
  };

  for (const row of rows) {
    const excelRow = sheet.addRow(row);
    if (row.type === "Big change") {
      excelRow.getCell("type").font = { bold: true, color: { argb: "FF1D4ED8" } };
    } else {
      excelRow.getCell("type").font = { color: { argb: "FF64748B" } };
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: 6 },
  };

  const meta = workbook.addWorksheet("About");
  meta.getCell("A1").value = "Diabeaters change tracking";
  meta.getCell("A1").font = { bold: true, size: 14 };
  meta.getCell("A3").value = "Source";
  meta.getCell("B3").value = `git log on main since ${SINCE}`;
  meta.getCell("A4").value = "Generated";
  meta.getCell("B4").value = new Date().toISOString();
  meta.getCell("A5").value = "Rows";
  meta.getCell("B5").value = rows.length;
  meta.getCell("A7").value = "Type legend";
  meta.getCell("A7").font = { bold: true };
  meta.getCell("A8").value = "Big change";
  meta.getCell("B8").value = "New capability or substantial redesign";
  meta.getCell("A9").value = "Tweak";
  meta.getCell("B9").value = "Polish, bug fix, copy, layout, or version bump";
  meta.getCell("A11").value = "Regenerate";
  meta.getCell("B11").value = "npm install --no-save exceljs && node scripts/generate-change-tracking.mjs";
  meta.columns = [{ width: 16 }, { width: 72 }];

  mkdirSync(dirname(outPath), { recursive: true });
  await workbook.xlsx.writeFile(outPath);

  const big = rows.filter((r) => r.type === "Big change").length;
  const tweak = rows.filter((r) => r.type === "Tweak").length;
  console.log(`Wrote ${outPath}`);
  console.log(`${rows.length} rows (${big} Big change, ${tweak} Tweak) since ${SINCE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
