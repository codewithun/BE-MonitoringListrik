const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const getRumah = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      r.id,
      r.nama_rumah,
      r.alamat,
      r.deskripsi,
      r.created_at,
      r.updated_at,
      COUNT(p.id)::int AS jumlah_perangkat
    FROM rumah r
    LEFT JOIN perangkat p ON p.rumah_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `);

  res.json({ success: true, data: result.rows });
});

const createRumah = asyncHandler(async (req, res) => {
  const { nama_rumah, alamat, deskripsi } = req.body;

  if (!nama_rumah) {
    res.status(400);
    throw new Error('nama_rumah wajib diisi');
  }

  const result = await pool.query(
    `INSERT INTO rumah (nama_rumah, alamat, deskripsi)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [nama_rumah, alamat || null, deskripsi || null]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

const updateRumah = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nama_rumah, alamat, deskripsi } = req.body;

  const result = await pool.query(
    `UPDATE rumah
     SET
      nama_rumah = COALESCE($1, nama_rumah),
      alamat = COALESCE($2, alamat),
      deskripsi = COALESCE($3, deskripsi),
      updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [nama_rumah, alamat, deskripsi, id]
  );

  if (result.rowCount === 0) {
    res.status(404);
    throw new Error('Rumah tidak ditemukan');
  }

  res.json({ success: true, data: result.rows[0] });
});

const deleteRumah = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `DELETE FROM rumah WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    res.status(404);
    throw new Error('Rumah tidak ditemukan');
  }

  res.json({ success: true, message: 'Rumah berhasil dihapus' });
});

module.exports = {
  getRumah,
  createRumah,
  updateRumah,
  deleteRumah,
};
