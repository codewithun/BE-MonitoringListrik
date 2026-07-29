const cron = require('node-cron');
const pool = require('../config/db');

// Helper: kirim push ke semua anggota rumah dari daftar device
async function sendPushToAllUsers(userIds, payload) {
  const webpush = require('../config/webpush');
  for (const userId of userIds) {
    try {
      const subs = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
      for (const sub of subs.rows) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
        };
        try {
          await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
          }
        }
      }
    } catch (e) {
      console.error('[SCHEDULER] Push error for user', userId, e.message);
    }
  }
}

// Map cooldown agar peringatan 10 menit tidak dikirim ulang terus menerus
const warningCooldownMap = new Map();

function startScheduler() {
  console.log('Scheduler (Penjadwalan) started. Running every minute...');

  // =====================================================
  // CRON 1: Eksekusi jadwal yang tepat waktunya
  // =====================================================
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const optionsDate = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
      const optionsTime = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
      const currentDate = new Intl.DateTimeFormat('en-CA', optionsDate).format(now);
      const currentTime = new Intl.DateTimeFormat('en-GB', optionsTime).format(now);

      const result = await pool.query(
        `SELECT p.id, p.device_id, p.nama_perangkat, p.jadwal_aksi, p.rumah_id
         FROM perangkat p
         WHERE p.jadwal_aktif = TRUE
           AND p.jadwal_tanggal = $1
           AND p.jadwal_waktu = $2`,
        [currentDate, currentTime]
      );

      for (const device of result.rows) {
        const turnOn = device.jadwal_aksi === 'ON';
        const deviceLabel = device.nama_perangkat || device.device_id;

        console.log(`[SCHEDULER] Triggering ${turnOn ? 'ON' : 'OFF'} for ${deviceLabel}`);

        // Update relay dan nonaktifkan jadwal
        await pool.query(
          `UPDATE perangkat SET status_relay = $1, jadwal_aktif = FALSE, updated_at = NOW() WHERE id = $2`,
          [turnOn, device.id]
        );

        // Log relay
        await pool.query(
          `INSERT INTO log_relay (device_id, status_relay, sumber) VALUES ($1, $2, $3)`,
          [device.device_id, turnOn, 'api']
        );

        // Ambil SEMUA pengguna yang berhak (semua anggota rumah)
        const usersResult = await pool.query(
          `SELECT DISTINCT pengguna_id FROM akses_rumah WHERE rumah_id = $1`,
          [device.rumah_id]
        );
        const userIds = usersResult.rows.map(r => r.pengguna_id);

        // Hapus cooldown warning setelah jadwal dieksekusi
        warningCooldownMap.delete(device.id);

        await sendPushToAllUsers(userIds, {
          title: 'Jadwal Dijalankan!',
          body: `${deviceLabel} otomatis diubah menjadi ${turnOn ? 'MENYALA (ON)' : 'MATI (OFF)'}.`,
          type: 'schedule'
        });
      }
    } catch (err) {
      console.error('[SCHEDULER] Error running jobs:', err.message);
    }
  });

  // =====================================================
  // CRON 2: Peringatan 10 menit sebelum jadwal berjalan
  // =====================================================
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Waktu 10 menit ke depan
      const tenMinLater = new Date(now.getTime() + 10 * 60 * 1000);

      const optionsDate = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
      const optionsTime = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };

      const targetDate = new Intl.DateTimeFormat('en-CA', optionsDate).format(tenMinLater);
      const targetTime = new Intl.DateTimeFormat('en-GB', optionsTime).format(tenMinLater);

      const result = await pool.query(
        `SELECT p.id, p.device_id, p.nama_perangkat, p.jadwal_aksi, p.rumah_id, p.jadwal_waktu
         FROM perangkat p
         WHERE p.jadwal_aktif = TRUE
           AND p.jadwal_tanggal = $1
           AND p.jadwal_waktu = $2`,
        [targetDate, targetTime]
      );

      for (const device of result.rows) {
        // Cek cooldown agar hanya 1x kirim per jadwal
        if (warningCooldownMap.has(device.id)) continue;
        warningCooldownMap.set(device.id, Date.now());

        const turnOn = device.jadwal_aksi === 'ON';
        const deviceLabel = device.nama_perangkat || device.device_id;

        console.log(`[SCHEDULER] Warning 10min sebelum jadwal: ${deviceLabel} → ${turnOn ? 'ON' : 'OFF'} jam ${device.jadwal_waktu}`);

        const usersResult = await pool.query(
          `SELECT DISTINCT pengguna_id FROM akses_rumah WHERE rumah_id = $1`,
          [device.rumah_id]
        );
        const userIds = usersResult.rows.map(r => r.pengguna_id);

        await sendPushToAllUsers(userIds, {
          title: 'Jadwal Akan Berjalan!',
          body: `${deviceLabel} akan otomatis ${turnOn ? 'MENYALA (ON)' : 'MATI (OFF)'} dalam 10 menit (jam ${device.jadwal_waktu}).`,
          type: 'schedule_warning'
        });
      }
    } catch (err) {
      console.error('[SCHEDULER] Error warning jobs:', err.message);
    }
  });
}

module.exports = { startScheduler };
