const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

async function ensureDeviceExists(deviceId, statusRelay = false) {
  await pool.query(
    `INSERT INTO perangkat (device_id, nama_perangkat, status_relay, status_online, terakhir_online)
     VALUES ($1, $2, $3, TRUE, NOW())
     ON CONFLICT (device_id)
     DO UPDATE SET
      status_online = TRUE,
      terakhir_online = NOW(),
      updated_at = NOW()`,
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
      status_relay ?? null,
    ]
  );

  if (typeof status_relay === 'boolean') {
    await pool.query(
      `UPDATE perangkat
       SET status_relay = $1, status_online = TRUE, terakhir_online = NOW(), updated_at = NOW()
       WHERE device_id = $2`,
      [status_relay, finalDeviceId]
    );
  }

  res.status(201).json({ success: true, data: result.rows[0] });
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
  } = req.query;

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

  if (start) {
    params.push(start);
    conditions.push(`dl.waktu_baca >= $${params.length}`);
  }

  if (end) {
    params.push(end);
    conditions.push(`dl.waktu_baca <= $${params.length}`);
  }

  const safeLimit = Math.min(Number(limit) || 200, 2000);
  params.push(safeLimit);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

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
     LIMIT $${params.length}`,
    params
  );

  res.json({ success: true, data: result.rows });
});

module.exports = {
  createDataListrik,
  getLatestDataListrik,
  getHistoryDataListrik,
};
