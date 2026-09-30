/**
 * Simple migration runner — applies numbered .sql files in order.
 * Tracks applied migrations in a _migrations table.
 */
const { readFileSync, readdirSync } = require('fs');
const { join } = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function migrate() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Create migration tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get already-applied migrations
    const { rows: applied } = await pool.query(
      'SELECT name FROM _migrations ORDER BY id'
    );
    const appliedSet = new Set(applied.map((r) => r.name));

    // Read migration files
    const migrationsDir = join(__dirname, 'migrations');
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ✓ ${file} (already applied)`);
        continue;
      }

      console.log(`  → Applying ${file}...`);
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`  ✓ ${file} applied successfully`);
      appliedCount++;
    }

    console.log(
      appliedCount > 0
        ? `\nMigrations complete: ${appliedCount} applied.`
        : '\nAll migrations already applied.'
    );
  } catch (err) {
    console.error('Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
