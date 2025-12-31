import { execSync } from 'child_process';

console.log('Running database migrations...');

try {
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not set, skipping migrations');
    process.exit(0);
  }

  execSync('npx drizzle-kit push --force', {
    stdio: 'inherit',
    env: process.env
  });

  console.log('Migrations completed successfully');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
