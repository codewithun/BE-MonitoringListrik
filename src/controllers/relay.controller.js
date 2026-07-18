const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

async function updateRelay(deviceId, relay, sumber) {
  // Hanya bypass Debounce jika sumbernya adalah 'web' (User klik di UI)
  if (sumber !== 'web') {
    const check = await pool.query(
      `SELECT updated_at FROM perangkat WHERE device_id = $1 OR id::text = $1`,
      [deviceId]
    );

    if (check.rowCount > 0) {
      const lastUpdate = new Date(check.rows[0].updated_at).getTime();
      const now = new Date().getTime();
      
      // Jika web baru saja mengubahnya dalam 4 detik terakhir, abaikan request dari ESP32
      if (now - lastUpdate < 4000) {
        const result = await pool.query(
          `UPDATE perangkat
           SET status_online = TRUE, terakhir_online = NOW()
           WHERE device_id = $1 OR id::text = $1
           RETURNING device_id, nama_perangkat, status_relay, status_online, terakhir_online`,
          [deviceId]
        );
        return result.rows[0];
      }
    }
  }

  const result = await pool.query(
    `UPDATE perangkat
     SET status_relay = $1, status_online = TRUE, terakhir_online = NOW(), updated_at = NOW()
     WHERE device_id = $2 OR id::text = $2
     RETURNING device_id, nama_perangkat, status_relay, status_online, terakhir_online`,
    [relay, deviceId]
  );

  if (result.rowCount === 0) {
    const error = new Error('Device ID tidak ditemukan');
    error.statusCode = 404;
    throw error;
  }

  await pool.query(
    `INSERT INTO log_relay (device_id, status_relay, sumber)
     VALUES ($1, $2, $3)`,
    [deviceId, relay, sumber]
  );

  return result.rows[0];
}

const getRelayState = asyncHandler(async (req, res) => {
  const { deviceId, device_id } = req.query;
  const finalDeviceId = deviceId || device_id;

  if (!finalDeviceId) {
    const result = await pool.query(
      `SELECT device_id, nama_perangkat, status_relay AS relay, status_online, terakhir_online
       FROM perangkat
       ORDER BY created_at DESC`
    );

    return res.json({ success: true, data: result.rows });
  }

  const result = await pool.query(
    `SELECT device_id, nama_perangkat, status_relay AS relay, status_online, terakhir_online
     FROM perangkat
     WHERE device_id = $1 OR id::text = $1`,
    [finalDeviceId]
  );

  if (result.rowCount === 0) {
    res.status(404);
    throw new Error('Device ID tidak ditemukan');
  }

  res.json({ success: true, data: result.rows[0], relay: result.rows[0].relay });
});

const relayControlFromWeb = asyncHandler(async (req, res) => {
  const { deviceId, device_id, relay } = req.body;
  const finalDeviceId = deviceId || device_id;

  if (!finalDeviceId) {
    res.status(400);
    throw new Error('deviceId wajib diisi');
  }

  if (typeof relay !== 'boolean') {
    res.status(400);
    throw new Error('relay wajib boolean: true atau false');
  }

  const data = await updateRelay(finalDeviceId, relay, 'web');

  res.json({
    success: true,
    message: `Relay berhasil diubah menjadi ${relay ? 'ON' : 'OFF'}`,
    data,
  });
});

const relayStatusFromDevice = asyncHandler(async (req, res) => {
  const { deviceId, device_id, relay, source } = req.body;
  const finalDeviceId = deviceId || device_id;

  if (!finalDeviceId) {
    res.status(400);
    throw new Error('deviceId wajib diisi');
  }

  if (typeof relay !== 'boolean') {
    res.status(400);
    throw new Error('relay wajib boolean: true atau false');
  }

  const allowedSource = ['voice', 'api'].includes(source) ? source : 'voice';
  const data = await updateRelay(finalDeviceId, relay, allowedSource);

  res.json({
    success: true,
    message: `Status relay dari ESP berhasil disimpan`,
    data,
  });
});

module.exports = {
  getRelayState,
  relayControlFromWeb,
  relayStatusFromDevice,
};
