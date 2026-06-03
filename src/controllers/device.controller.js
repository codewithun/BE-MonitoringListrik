const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const registerDevice = asyncHandler(async (req, res) => {
  const {
    deviceId,
    device_id,
    nama_perangkat,
    versi_firmware,
  } = req.body;

  const finalDeviceId = deviceId || device_id;

  if (!finalDeviceId) {
    res.status(400);
    throw new Error('deviceId wajib diisi');
  }

  const result = await pool.query(
    `INSERT INTO perangkat
      (device_id, nama_perangkat, versi_firmware, status_online, terakhir_online)
     VALUES ($1, $2, $3, TRUE, NOW())
     ON CONFLICT (device_id)
     DO UPDATE SET
      status_online = TRUE,
      terakhir_online = NOW(),
      versi_firmware = COALESCE(EXCLUDED.versi_firmware, perangkat.versi_firmware),
      updated_at = NOW()
     RETURNING *`,
    [
      finalDeviceId,
      nama_perangkat || `Perangkat ${finalDeviceId}`,
      versi_firmware || null,
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Device berhasil register/update last_seen',
    data: result.rows[0],
  });
});

module.exports = { registerDevice };
