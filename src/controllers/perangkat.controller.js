const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const getPerangkat = asyncHandler(async (req, res) => {
  const { rumahId } = req.query;

  const params = [];
  let where = '';

  if (rumahId) {
    params.push(rumahId);
    where = 'WHERE p.rumah_id = $1';
  }

  const result = await pool.query(
    `SELECT
      p.id,
      p.device_id,
      p.rumah_id,
      r.nama_rumah,
      p.nama_perangkat,
      p.status_relay,
      p.versi_firmware,
      p.status_online,
      p.terakhir_online,
      p.created_at,
      p.updated_at
    FROM perangkat p
    LEFT JOIN rumah r ON r.id = p.rumah_id
    ${where}
    ORDER BY p.created_at DESC`,
    params
  );

  res.json({ success: true, data: result.rows });
});

const createPerangkat = asyncHandler(async (req, res) => {
  const {
    deviceId,
    device_id,
    rumah_id,
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
      (device_id, rumah_id, nama_perangkat, versi_firmware, status_online, terakhir_online)
     VALUES ($1, $2, $3, $4, TRUE, NOW())
     ON CONFLICT (device_id)
     DO UPDATE SET
      rumah_id = COALESCE(EXCLUDED.rumah_id, perangkat.rumah_id),
      nama_perangkat = COALESCE(EXCLUDED.nama_perangkat, perangkat.nama_perangkat),
      versi_firmware = COALESCE(EXCLUDED.versi_firmware, perangkat.versi_firmware),
      status_online = TRUE,
      terakhir_online = NOW(),
      updated_at = NOW()
     RETURNING *`,
    [
      finalDeviceId,
      rumah_id || null,
      nama_perangkat || `Perangkat ${finalDeviceId}`,
      versi_firmware || null,
    ]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

const updatePerangkat = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    rumah_id,
    nama_perangkat,
    status_relay,
    versi_firmware,
    status_online,
  } = req.body;

  const result = await pool.query(
    `UPDATE perangkat
     SET
      rumah_id = COALESCE($1, rumah_id),
      nama_perangkat = COALESCE($2, nama_perangkat),
      status_relay = COALESCE($3, status_relay),
      versi_firmware = COALESCE($4, versi_firmware),
      status_online = COALESCE($5, status_online),
      updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [rumah_id, nama_perangkat, status_relay, versi_firmware, status_online, id]
  );

  if (result.rowCount === 0) {
    res.status(404);
    throw new Error('Perangkat tidak ditemukan');
  }

  res.json({ success: true, data: result.rows[0] });
});

const deletePerangkat = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `DELETE FROM perangkat WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    res.status(404);
    throw new Error('Perangkat tidak ditemukan');
  }

  res.json({ success: true, message: 'Perangkat berhasil dihapus' });
});

module.exports = {
  getPerangkat,
  createPerangkat,
  updatePerangkat,
  deletePerangkat,
};
