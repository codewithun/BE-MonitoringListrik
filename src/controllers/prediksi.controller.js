const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const getPrediksiBulanan = asyncHandler(async (req, res) => {
  const { rumahId, bulan, tahun } = req.query;

  const params = [];
  const conditions = [];

  if (rumahId) {
    params.push(rumahId);
    conditions.push(`pb.rumah_id = $${params.length}`);
  }

  if (bulan) {
    params.push(Number(bulan));
    conditions.push(`pb.bulan = $${params.length}`);
  }

  if (tahun) {
    params.push(Number(tahun));
    conditions.push(`pb.tahun = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT
      pb.*,
      r.nama_rumah,
      rb.total_energi_kwh AS aktual_energi_kwh,
      rb.total_biaya AS aktual_biaya,
      CASE
        WHEN rb.total_energi_kwh IS NULL OR rb.total_energi_kwh = 0 THEN NULL
        ELSE ROUND((ABS(rb.total_energi_kwh - pb.prediksi_energi_kwh) / rb.total_energi_kwh) * 100, 2)
      END AS error_persen
     FROM prediksi_bulanan pb
     LEFT JOIN rumah r ON r.id = pb.rumah_id
     LEFT JOIN ringkasan_bulanan rb
      ON rb.rumah_id = pb.rumah_id
      AND rb.bulan = pb.bulan
      AND rb.tahun = pb.tahun
     ${where}
     ORDER BY pb.tahun DESC, pb.bulan DESC`,
    params
  );

  res.json({ success: true, data: result.rows });
});

const createPrediksiBulanan = asyncHandler(async (req, res) => {
  const {
    rumah_id,
    bulan,
    tahun,
    prediksi_energi_kwh,
    prediksi_biaya,
    nama_model = 'LSTM',
    akurasi,
  } = req.body;

  if (!rumah_id || !bulan || !tahun) {
    res.status(400);
    throw new Error('rumah_id, bulan, dan tahun wajib diisi');
  }

  const result = await pool.query(
    `INSERT INTO prediksi_bulanan
      (rumah_id, bulan, tahun, prediksi_energi_kwh, prediksi_biaya, nama_model, akurasi)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (rumah_id, bulan, tahun)
     DO UPDATE SET
      prediksi_energi_kwh = EXCLUDED.prediksi_energi_kwh,
      prediksi_biaya = EXCLUDED.prediksi_biaya,
      nama_model = EXCLUDED.nama_model,
      akurasi = EXCLUDED.akurasi,
      created_at = NOW()
     RETURNING *`,
    [
      rumah_id,
      Number(bulan),
      Number(tahun),
      prediksi_energi_kwh ?? null,
      prediksi_biaya ?? null,
      nama_model,
      akurasi ?? null,
    ]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

module.exports = {
  getPrediksiBulanan,
  createPrediksiBulanan,
};
