const pool = require('../config/db');
const webpush = require('../config/webpush');

// Helper untuk mengirim notifikasi push
async function sendPushNotification(userId, payload) {
  try {
    const result = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
    for (const sub of result.rows) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      };
      try {
        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or invalid, delete it
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        } else {
          console.error('Error sending push:', err.message);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendPushNotification:', error.message);
  }
}

const asyncHandler = require('../utils/asyncHandler');

async function ensureDeviceExists(deviceId, statusRelay = false) {
  await pool.query(
    `INSERT INTO perangkat (device_id, nama_perangkat, status_relay, status_online, terakhir_online)
     VALUES ($1, $2, $3, TRUE, NOW())
     ON CONFLICT (device_id)
     DO UPDATE SET
      status_online = TRUE,
      terakhir_online = NOW()`,
    [deviceId, `Perangkat ${deviceId}`, statusRelay]
  );
}

const createDataListrik = asyncHandler(async (req, res) => {
  const {
    deviceId,
    device_id,
    tegangan,
    arus,
    daya,
    energi,
    frekuensi,
    faktor_daya,
    status_relay,
  } = req.body;

  const finalDeviceId = deviceId || device_id;

  if (!finalDeviceId) {
    res.status(400);
    throw new Error('deviceId wajib diisi');
  }

  await ensureDeviceExists(finalDeviceId, Boolean(status_relay));
  let finalRelayStatus = status_relay;
  let deviceRecord = await pool.query(
    `SELECT p.batas_daya, p.batas_daya_aktif, p.status_relay, p.updated_at, a.pengguna_id 
     FROM perangkat p
     LEFT JOIN akses_rumah a ON p.rumah_id = a.rumah_id
     WHERE p.device_id = $1`,
    [finalDeviceId]
  );

  if (deviceRecord.rowCount > 0) {
    const { batas_daya, batas_daya_aktif, status_relay: dbRelay, updated_at, pengguna_id } = deviceRecord.rows[0];
    
    // SMART SHIELD (DEBOUNCE): 
    // Cek apakah Web baru saja mengubah status dalam 4 detik terakhir
    const lastUpdate = new Date(updated_at).getTime();
    const now = new Date().getTime();
    const isWebRecentlyUpdated = (now - lastUpdate) < 4000;

    if (isWebRecentlyUpdated) {
      // Jika web baru saja mengubahnya, ABAIKAN status_relay dari ESP32 untuk menghindari Race Condition
      finalRelayStatus = dbRelay;
    } else {
      // Jika sudah lebih dari 4 detik, berarti ESP32 mengirim status karena tombol fisiknya ditekan!
      // Biarkan finalRelayStatus mengikuti apa yang dikirim ESP32
      if (status_relay !== undefined && status_relay !== null) {
        finalRelayStatus = status_relay;
      } else {
        finalRelayStatus = dbRelay;
      }
    }

    // PROTEKSI BATAS DAYA
    if (daya !== undefined && daya !== null) {
      if (batas_daya_aktif && Number(daya) > Number(batas_daya) && finalRelayStatus !== false) {
        finalRelayStatus = false; 

        await pool.query(
          `INSERT INTO log_relay (device_id, status_relay, sumber) VALUES ($1, $2, $3)`,
          [finalDeviceId, false, 'alat']
        );

        if (pengguna_id) {
          await sendPushNotification(pengguna_id, {
            title: '⚠️ Batas Daya Terlampaui!',
            body: `Perangkat ${finalDeviceId} menggunakan ${daya}W (Batas: ${batas_daya}W). Relay otomatis dimatikan.`,
            type: 'power_limit'
          });
        }
      }
    }
  }

  const result = await pool.query(
    `INSERT INTO data_listrik
      (device_id, tegangan, arus, daya, energi, frekuensi, faktor_daya, status_relay)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      finalDeviceId,
      tegangan ?? null,
      arus ?? null,
      daya ?? null,
      energi ?? null,
      frekuensi ?? null,
      faktor_daya ?? null,
      finalRelayStatus ?? null,
    ]
  );

  if (typeof finalRelayStatus === 'boolean') {
    await pool.query(
      `UPDATE perangkat
       SET status_relay = $1, status_online = TRUE, terakhir_online = NOW()
       WHERE device_id = $2`,
      [finalRelayStatus, finalDeviceId]
    );
  }

  res.status(201).json({ 
    success: true, 
    data: result.rows[0]
  });
});

const getLatestDataListrik = asyncHandler(async (req, res) => {
  const { deviceId, rumahId } = req.query;

  if (deviceId) {
    const result = await pool.query(
      `SELECT dl.*, p.nama_perangkat, p.rumah_id, r.nama_rumah
       FROM data_listrik dl
       JOIN perangkat p ON p.device_id = dl.device_id
       LEFT JOIN rumah r ON r.id = p.rumah_id
       WHERE dl.device_id = $1
       ORDER BY dl.waktu_baca DESC
       LIMIT 1`,
      [deviceId]
    );

    return res.json({ success: true, data: result.rows[0] || null });
  }

  const params = [];
  let where = '';

  if (rumahId) {
    params.push(rumahId);
    where = 'WHERE p.rumah_id = $1';
  }

  const result = await pool.query(
    `SELECT DISTINCT ON (dl.device_id)
      dl.*,
      p.nama_perangkat,
      p.rumah_id,
      r.nama_rumah
     FROM data_listrik dl
     JOIN perangkat p ON p.device_id = dl.device_id
     LEFT JOIN rumah r ON r.id = p.rumah_id
     ${where}
     ORDER BY dl.device_id, dl.waktu_baca DESC`,
    params
  );

  res.json({ success: true, data: result.rows });
});

const getHistoryDataListrik = asyncHandler(async (req, res) => {
  const {
    deviceId,
    rumahId,
    start,
    end,
    limit = 200,
    page = 1,
  } = req.query;

  // Prevent data leak if deviceId is not provided and user has no devices
  if (!deviceId || deviceId === 'all') {
    return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: Number(limit) || 200, totalPages: 0 } });
  }

  const params = [];
  const conditions = [];

  if (deviceId && deviceId !== 'all') {
    params.push(deviceId);
    conditions.push(`dl.device_id = $${params.length}`);
  }

  if (rumahId) {
    params.push(rumahId);
    conditions.push(`p.rumah_id = $${params.length}`);
  }

  if (start) {
    params.push(start);
    conditions.push(`dl.waktu_baca >= $${params.length}`);
  }

  if (end) {
    params.push(end);
    conditions.push(`dl.waktu_baca <= $${params.length}`);
  }

  const safeLimit = Math.min(Number(limit) || 200, 2000);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*)
     FROM data_listrik dl
     JOIN perangkat p ON p.device_id = dl.device_id
     ${where}`,
    params
  );
  
  const total = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(total / safeLimit);

  // Get paginated data
  const dataParams = [...params, safeLimit, offset];
  const result = await pool.query(
    `SELECT
      dl.*,
      p.nama_perangkat,
      p.rumah_id,
      r.nama_rumah
     FROM data_listrik dl
     JOIN perangkat p ON p.device_id = dl.device_id
     LEFT JOIN rumah r ON r.id = p.rumah_id
     ${where}
     ORDER BY dl.waktu_baca DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  res.json({ 
    success: true, 
    data: result.rows,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages
    }
  });
});

const getMonthlyHistoryDataListrik = asyncHandler(async (req, res) => {
  const { deviceId, rumahId, months = 6 } = req.query;

  // Prevent data leak if deviceId is not provided
  if (!deviceId) {
    return res.json({ success: true, data: [] });
  }

  const params = [];
  const conditions = [];

  if (deviceId) {
    params.push(deviceId);
    conditions.push(`dl.device_id = $${params.length}`);
  }

  if (rumahId) {
    params.push(rumahId);
    conditions.push(`p.rumah_id = $${params.length}`);
  }

  // Define how many months back we want to go
  const safeMonths = parseInt(months, 10) || 6;
  conditions.push(`dl.waktu_baca >= NOW() - INTERVAL '${safeMonths} months'`);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT 
      to_char(date_trunc('month', dl.waktu_baca), 'Mon') as month,
      date_trunc('month', dl.waktu_baca) as month_date,
      MAX(dl.energi) - MIN(dl.energi) as energy
     FROM data_listrik dl
     JOIN perangkat p ON p.device_id = dl.device_id
     ${where}
     GROUP BY month_date, month
     ORDER BY month_date ASC`,
    params
  );

  res.json({ success: true, data: result.rows });
});

module.exports = {
  createDataListrik,
  getLatestDataListrik,
  getHistoryDataListrik,
  getMonthlyHistoryDataListrik,
};
