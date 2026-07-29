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
      p.nama_beban,
      p.status_relay,
      p.versi_firmware,
      p.status_online,
      p.terakhir_online,
      p.batas_daya,
      p.batas_daya_aktif,
      p.jadwal_aktif,
      p.jadwal_waktu,
      p.jadwal_tanggal,
      p.jadwal_aksi,
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
    nama_beban,
    versi_firmware,
  } = req.body;

  const finalDeviceId = deviceId || device_id;

  if (!finalDeviceId) {
    res.status(400);
    throw new Error('deviceId wajib diisi');
  }

  const existingDevice = await pool.query(
    `SELECT id, rumah_id, nama_perangkat
     FROM perangkat
     WHERE device_id = $1
     LIMIT 1`,
    [finalDeviceId]
  );

  if (existingDevice.rowCount > 0) {
    res.status(409);
    throw new Error('ID alat sudah dipakai');
  }

  const result = await pool.query(
    `INSERT INTO perangkat
      (device_id, rumah_id, nama_perangkat, nama_beban, versi_firmware, status_online, terakhir_online)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
     RETURNING *`,
    [
      finalDeviceId,
      rumah_id || null,
      nama_perangkat || `Perangkat ${finalDeviceId}`,
      nama_beban || null,
      versi_firmware || null,
    ]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

const updatePerangkat = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    rumah_id = null,
    nama_perangkat = null,
    nama_beban = null,
    status_relay = null,
    versi_firmware = null,
    status_online = null,
    batas_daya = null,
    batas_daya_aktif = null,
    jadwal_aktif = null,
    jadwal_waktu = null,
    jadwal_tanggal = null,
    jadwal_aksi = null,
  } = req.body;

  const result = await pool.query(
    `UPDATE perangkat
     SET
      rumah_id = COALESCE($1, rumah_id),
      nama_perangkat = COALESCE($2, nama_perangkat),
      nama_beban = COALESCE($3, nama_beban),
      status_relay = COALESCE($4, status_relay),
      versi_firmware = COALESCE($5, versi_firmware),
      status_online = COALESCE($6, status_online),
      batas_daya = COALESCE($7, batas_daya),
      batas_daya_aktif = COALESCE($8, batas_daya_aktif),
      jadwal_aktif = COALESCE($9, jadwal_aktif),
      jadwal_waktu = COALESCE($10, jadwal_waktu),
      jadwal_tanggal = COALESCE($11, jadwal_tanggal),
      jadwal_aksi = COALESCE($12, jadwal_aksi),
      updated_at = NOW()
     WHERE id = $13
     RETURNING *`,
    [
      rumah_id,
      nama_perangkat,
      nama_beban,
      status_relay,
      versi_firmware,
      status_online,
      batas_daya,
      batas_daya_aktif,
      jadwal_aktif,
      jadwal_waktu,
      jadwal_tanggal,
      jadwal_aksi,
      id,
    ]
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
