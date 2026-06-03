const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const getRingkasanBulanan = asyncHandler(async (req, res) => {
  const { rumahId, bulan, tahun } = req.query;

  const params = [];
  const conditions = [];

  if (rumahId) {
    params.push(rumahId);
    conditions.push(`rb.rumah_id = $${params.length}`);
  }

  if (bulan) {
    params.push(Number(bulan));
    conditions.push(`rb.bulan = $${params.length}`);
  }

  if (tahun) {
    params.push(Number(tahun));
    conditions.push(`rb.tahun = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT rb.*, r.nama_rumah
     FROM ringkasan_bulanan rb
     LEFT JOIN rumah r ON r.id = rb.rumah_id
     ${where}
     ORDER BY rb.tahun DESC, rb.bulan DESC`,
    params
  );

  res.json({ success: true, data: result.rows });
});

const createRingkasanBulanan = asyncHandler(async (req, res) => {
  const {
    rumah_id,
    bulan,
    tahun,
    total_energi_kwh,
    total_biaya,
    rata_tegangan,
    rata_arus,
    rata_daya,
  } = req.body;

  if (!rumah_id || !bulan || !tahun) {
    res.status(400);
    throw new Error('rumah_id, bulan, dan tahun wajib diisi');
  }

  const result = await pool.query(
    `INSERT INTO ringkasan_bulanan
      (rumah_id, bulan, tahun, total_energi_kwh, total_biaya, rata_tegangan, rata_arus, rata_daya)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (rumah_id, bulan, tahun)
     DO UPDATE SET
      total_energi_kwh = EXCLUDED.total_energi_kwh,
      total_biaya = EXCLUDED.total_biaya,
      rata_tegangan = EXCLUDED.rata_tegangan,
      rata_arus = EXCLUDED.rata_arus,
      rata_daya = EXCLUDED.rata_daya,
      created_at = NOW()
     RETURNING *`,
    [
      rumah_id,
      Number(bulan),
      Number(tahun),
      total_energi_kwh ?? null,
      total_biaya ?? null,
      rata_tegangan ?? null,
      rata_arus ?? null,
      rata_daya ?? null,
    ]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

module.exports = {
  getRingkasanBulanan,
  createRingkasanBulanan,
};
