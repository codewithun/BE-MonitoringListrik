const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const getUsers = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      p.id,
      p.username,
      p.email,
      p.role,
      p.aktif,
      p.created_at,
      p.updated_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', r.id,
            'nama_rumah', r.nama_rumah
          )
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'
      ) AS rumah
    FROM pengguna p
    LEFT JOIN akses_rumah ar ON ar.pengguna_id = p.id
    LEFT JOIN rumah r ON r.id = ar.rumah_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);

  res.json({ success: true, data: result.rows });
});

module.exports = {
  getUsers,
};
