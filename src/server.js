require('dotenv').config();
const app = require('./app');
const startCleanupDataListrikJob = require('./jobs/cleanupDataListrik');
const { startScheduler } = require('./jobs/scheduler');

const pool = require('./config/db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  
  // Buat tabel push_subscriptions jika belum ada
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES pengguna(id) ON DELETE CASCADE,
        endpoint TEXT UNIQUE NOT NULL,
        keys_p256dh TEXT,
        keys_auth TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabel push_subscriptions siap.');
  } catch (error) {
    console.error('Gagal membuat tabel push_subscriptions:', error.message);
  }

  startCleanupDataListrikJob();
  startScheduler();
});
