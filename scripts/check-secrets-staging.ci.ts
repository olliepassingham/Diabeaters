/**
 * CI secrets checker for staging deploy. Fails if required staging secrets are missing.
 * Run in CI before build/deploy. No secrets are printed.
 */
const REQUIRED = [
  { key: "VERCEL_TOKEN", where: "Vercel → Account → Settings → Tokens" },
  { key: "VERCEL_ORG_ID", where: "Vercel → Account/Team → Settings → General" },
  { key: "VERCEL_PROJECT_ID", where: "Vercel → Project → Settings → General" },
  {
    key: "VITE_SUPABASE_URL_STAGING",
    where: "Supabase staging project → Project Settings → API → Project URL",
  },
  {
    key: "VITE_SUPABASE_ANON_KEY_STAGING",
    where: "Supabase staging project → Project Settings → API → anon public key",
  },
];

function main() {
  const missing: typeof REQUIRED = [];
  for (const { key, where } of REQUIRED) {
    const val = process.env[key];
    if (!val || String(val).trim() === "") {
      missing.push({ key, where });
    }
  }

  if (missing.length === 0) {
    console.log("✓ All required staging secrets are set.");
    return;
  }

  console.error(
    "\n❌ Missing required staging secrets. Add them in GitHub → Settings → Secrets and variables → Actions:\n",
  );
  for (const { key, where } of missing) {
    console.error(`  • ${key}`);
    console.error(`    Where to get: ${where}`);
  }
  console.error("\nSee docs/ci_secrets_staging.md for copy-paste instructions.\n");
  process.exit(1);
}

main();
