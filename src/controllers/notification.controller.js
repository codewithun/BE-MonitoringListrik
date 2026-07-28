const pool = require('../config/db');

const subscribe = async (req, res) => {
  const { user_id, subscription } = req.body;

  if (!user_id || !subscription || !subscription.endpoint) {
    return res.status(400).json({ status: 'error', message: 'User ID dan subscription wajib diisi.' });
  }

  try {
    // Upsert subscription
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint)
       DO UPDATE SET user_id = EXCLUDED.user_id, keys_p256dh = EXCLUDED.keys_p256dh, keys_auth = EXCLUDED.keys_auth`,
      [
        user_id,
        subscription.endpoint,
        subscription.keys?.p256dh || '',
        subscription.keys?.auth || ''
      ]
    );

    res.status(201).json({ status: 'success', message: 'Subscription berhasil disimpan.' });
  } catch (error) {
    console.error('Gagal menyimpan subscription:', error.message);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
  }
};

const debugPushData = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, user_id, endpoint FROM push_subscriptions');
    res.json({
      success: true,
      total_subscriptions: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const webpush = require('../config/webpush');

const testPush = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ success: false, message: 'Tambahkan ?user_id=... di URL' });
  }

  try {
    const result = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = $1', [user_id]);

    if (result.rowCount === 0) {
      return res.json({ success: false, message: `Tidak ada subscription untuk user_id: ${user_id}. Pastikan HP sudah mengizinkan notifikasi di aplikasi.` });
    }

    const report = [];
    for (const sub of result.rows) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
      };
      try {
        await webpush.sendNotification(pushSubscription, JSON.stringify({
          title: '🔔 Tes Notifikasi WattWise',
          body: 'Jika Anda melihat ini, Push Notification berhasil bekerja!',
          type: 'info'
        }));
        report.push({ endpoint: sub.endpoint.substring(0, 60) + '...', status: '✅ BERHASIL' });
        console.log(`[TEST PUSH] ✅ Berhasil ke: ${sub.endpoint.substring(0, 60)}...`);
      } catch (err) {
        const msg = `❌ GAGAL (${err.statusCode}): ${err.message}`;
        report.push({ endpoint: sub.endpoint.substring(0, 60) + '...', status: msg });
        console.error(`[TEST PUSH] ${msg}`);
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        }
      }
    }

    res.json({ success: true, total: result.rowCount, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { subscribe, debugPushData, testPush };
