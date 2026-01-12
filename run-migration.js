const { execSync } = require('child_process');

const dbUrl = process.argv[2];
if (!dbUrl) {
  console.error('Usage: node run-migration.js "your-database-url"');
  process.exit(1);
}

console.log('Running migration with provided URL...');
try {
  execSync(`npx drizzle-kit push --force`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit'
  });
  console.log('Migration complete!');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
