require('dotenv').config();
const pool = require('../src/config/db');

async function migrate() {
  try {
    console.log('Running migration: add avatar to pengguna...');
    await pool.query('ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);');
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrate();
