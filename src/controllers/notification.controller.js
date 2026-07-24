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

module.exports = { subscribe };
