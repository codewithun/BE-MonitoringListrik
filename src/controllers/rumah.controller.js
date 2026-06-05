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
      COUNT(DISTINCT p.id)::int AS jumlah_perangkat,
      COALESCE(
        json_agg(
          json_build_object(
            'id', pg.id,
            'username', pg.username,
            'email', pg.email
          )
        ) FILTER (WHERE pg.id IS NOT NULL),
        '[]'
      ) AS pemilik
    FROM rumah r
    LEFT JOIN perangkat p ON p.rumah_id = r.id
    LEFT JOIN akses_rumah ar ON ar.rumah_id = r.id
    LEFT JOIN pengguna pg ON pg.id = ar.pengguna_id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `);

  res.json({ success: true, data: result.rows });
});

const createRumah = asyncHandler(async (req, res) => {
  const { nama_rumah, alamat, deskripsi, pengguna_id } = req.body;

  if (!nama_rumah) {
    res.status(400);
    throw new Error('nama_rumah wajib diisi');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO rumah (nama_rumah, alamat, deskripsi)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [nama_rumah, alamat || null, deskripsi || null]
    );

    if (pengguna_id) {
      await client.query(
        `INSERT INTO akses_rumah (pengguna_id, rumah_id)
         VALUES ($1, $2)
         ON CONFLICT (pengguna_id, rumah_id) DO NOTHING`,
        [pengguna_id, result.rows[0].id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

const updateRumah = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nama_rumah, alamat, deskripsi, pengguna_id } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
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

    if (pengguna_id !== undefined) {
      await client.query('DELETE FROM akses_rumah WHERE rumah_id = $1', [id]);

      if (pengguna_id) {
        await client.query(
          `INSERT INTO akses_rumah (pengguna_id, rumah_id)
           VALUES ($1, $2)
           ON CONFLICT (pengguna_id, rumah_id) DO NOTHING`,
          [pengguna_id, id]
        );
      }
    }

    await client.query('COMMIT');

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
