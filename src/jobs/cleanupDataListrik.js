const cron = require('node-cron');
const pool = require('../config/db');

function startCleanupDataListrikJob() {
  // Jalan setiap hari jam 00:10 server time.
  cron.schedule('10 0 * * *', async () => {
    const retentionDays = Number(process.env.DATA_RETENTION_DAYS || 30);

    try {
      const result = await pool.query(
        `DELETE FROM data_listrik
         WHERE waktu_baca < NOW() - ($1 || ' days')::interval`,
        [retentionDays]
      );

      console.log(`Cleanup data_listrik selesai. Terhapus: ${result.rowCount} row`);
    } catch (error) {
      console.error('Cleanup data_listrik gagal:', error.message);
    }
  });
}

module.exports = startCleanupDataListrikJob;
