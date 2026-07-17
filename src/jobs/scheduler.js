const cron = require('node-cron');
const pool = require('../config/db');

function startScheduler() {
  console.log('Scheduler (Penjadwalan) started. Running every minute...');
  
  // Run every minute at second 0
  cron.schedule('* * * * *', async () => {
    try {
      // Get current time in local timezone (assuming server timezone is correct)
      // or we can format it manually if timezone is an issue.
      const now = new Date();
      // Format YYYY-MM-DD
      const currentDate = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      // Format HH:mm
      const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      
      const result = await pool.query(
        `SELECT id, device_id, jadwal_aksi 
         FROM perangkat 
         WHERE jadwal_aktif = TRUE 
           AND jadwal_tanggal = $1 
           AND jadwal_waktu = $2`,
        [currentDate, currentTime]
      );
      
      for (const device of result.rows) {
        const turnOn = device.jadwal_aksi === 'ON';
        
        console.log(`[SCHEDULER] Triggering ${turnOn ? 'ON' : 'OFF'} for device ${device.device_id}`);
        
        // Update relay and disable the schedule (one-time run)
        await pool.query(
          `UPDATE perangkat 
           SET status_relay = $1, jadwal_aktif = FALSE, updated_at = NOW() 
           WHERE id = $2`,
          [turnOn, device.id]
        );
        
        // Insert into log
        await pool.query(
          `INSERT INTO log_relay (device_id, status_relay, sumber) VALUES ($1, $2, $3)`,
          [device.device_id, turnOn, 'api'] // treated as system api action
        );
      }
    } catch (err) {
      console.error('[SCHEDULER] Error running jobs:', err.message);
    }
  });
}

module.exports = { startScheduler };
