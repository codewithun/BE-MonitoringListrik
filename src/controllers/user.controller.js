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
      p.avatar,
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

const createUser = asyncHandler(async (req, res) => {
  const {
    username,
    name,
    email,
    password,
    role = 'user',
    aktif = true,
    avatar,
    rumah_id,
  } = req.body;

  const finalUsername = String(username || name || '').trim();
  const finalEmail = String(email || '').trim().toLowerCase();
  const finalPassword = String(password || '');
  const finalRole = role === 'admin' ? 'admin' : 'user';

  if (!finalUsername || !finalEmail || !finalPassword) {
    res.status(400);
    throw new Error('username, email, dan password wajib diisi');
  }

  if (finalPassword.length < 8) {
    res.status(400);
    throw new Error('password minimal 8 karakter');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO pengguna (username, email, password_hash, role, aktif, avatar)
       VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, $5, $6)
       RETURNING id, username, email, role, aktif, avatar, created_at, updated_at`,
      [finalUsername, finalEmail, finalPassword, finalRole, Boolean(aktif), avatar]
    );

    if (rumah_id) {
      await client.query(
        `INSERT INTO akses_rumah (pengguna_id, rumah_id)
         VALUES ($1, $2)
         ON CONFLICT (pengguna_id, rumah_id) DO NOTHING`,
        [result.rows[0].id, rumah_id]
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

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    username,
    name,
    email,
    password,
    role,
    aktif,
    avatar,
    rumah_id,
  } = req.body;

  const finalUsername =
    username === undefined && name === undefined
      ? undefined
      : String(username || name || '').trim();
  const finalEmail =
    email === undefined ? undefined : String(email || '').trim().toLowerCase();
  const finalRole =
    role === undefined ? undefined : role === 'admin' ? 'admin' : 'user';
  const finalPassword =
    password === undefined || password === '' ? undefined : String(password);

  if (finalPassword !== undefined && finalPassword.length < 8) {
    res.status(400);
    throw new Error('password minimal 8 karakter');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE pengguna
       SET
        username = COALESCE($1, username),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        aktif = COALESCE($4, aktif),
        password_hash = CASE
          WHEN $5::text IS NULL THEN password_hash
          ELSE crypt($5, gen_salt('bf'))
        END,
        avatar = COALESCE($6, avatar),
        updated_at = NOW()
       WHERE id = $7
       RETURNING id, username, email, role, aktif, avatar, created_at, updated_at`,
      [finalUsername, finalEmail, finalRole, aktif, finalPassword, avatar, id]
    );

    if (result.rowCount === 0) {
      res.status(404);
      throw new Error('User tidak ditemukan');
    }

    if (rumah_id !== undefined) {
      await client.query('DELETE FROM akses_rumah WHERE pengguna_id = $1', [id]);

      if (rumah_id) {
        await client.query(
          `INSERT INTO akses_rumah (pengguna_id, rumah_id)
           VALUES ($1, $2)
           ON CONFLICT (pengguna_id, rumah_id) DO NOTHING`,
          [id, rumah_id]
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

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `DELETE FROM pengguna WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    res.status(404);
    throw new Error('User tidak ditemukan');
  }

  res.json({ success: true, message: 'User berhasil dihapus' });
});

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
};
