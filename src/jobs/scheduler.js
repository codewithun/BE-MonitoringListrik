const cron = require('node-cron');
const pool = require('../config/db');

function startScheduler() {
  console.log('Scheduler (Penjadwalan) started. Running every minute...');
  
  // Run every minute at second 0
  cron.schedule('* * * * *', async () => {
    try {
      // Gunakan timezone Asia/Jakarta (WIB) agar sama dengan input pengguna di frontend
      const now = new Date();
      const optionsDate = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
      const optionsTime = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
      
      // en-CA menghasilkan format YYYY-MM-DD
      const currentDate = new Intl.DateTimeFormat('en-CA', optionsDate).format(now);
      // en-GB menghasilkan format HH:mm
      const currentTime = new Intl.DateTimeFormat('en-GB', optionsTime).format(now);
      
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

        // Fetch user for notification
        const deviceUser = await pool.query(
          `SELECT a.pengguna_id FROM perangkat p
           JOIN akses_rumah a ON p.rumah_id = a.rumah_id
           WHERE p.id = $1`,
          [device.id]
        );

        if (deviceUser.rowCount > 0 && deviceUser.rows[0].pengguna_id) {
          const webpush = require('../config/webpush');
          const userId = deviceUser.rows[0].pengguna_id;
          
          try {
            const subs = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
            for (const sub of subs.rows) {
              const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.keys_p256dh,
                  auth: sub.keys_auth
                }
              };
              try {
                await webpush.sendNotification(pushSubscription, JSON.stringify({
                  title: '⏰ Jadwal Berjalan!',
                  body: `Perangkat ${device.device_id} otomatis diubah menjadi ${turnOn ? 'ON' : 'OFF'}.`,
                  type: 'schedule'
                }));
              } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                  await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
                }
              }
            }
          } catch (e) {
            console.error('Push scheduling error:', e.message);
          }
        }
      }
    } catch (err) {
      console.error('[SCHEDULER] Error running jobs:', err.message);
    }
  });
}

module.exports = { startScheduler };
