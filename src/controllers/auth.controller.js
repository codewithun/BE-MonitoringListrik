const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const publicUserColumns = `
  id,
  username,
  email,
  role,
  aktif,
  avatar,
  created_at,
  updated_at
`;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const register = asyncHandler(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!username || !email || !password) {
    res.status(400);
    throw new Error('username, email, dan password wajib diisi');
  }

  if (password.length < 8) {
    res.status(400);
    throw new Error('password minimal 8 karakter');
  }

  const existingUser = await pool.query(
    'SELECT id FROM pengguna WHERE username = $1 OR email = $2 LIMIT 1',
    [username, email]
  );

  if (existingUser.rowCount > 0) {
    res.status(409);
    throw new Error('Username atau email sudah digunakan');
  }

  const result = await pool.query(
    `INSERT INTO pengguna (username, email, password_hash, role, aktif)
     VALUES ($1, $2, crypt($3, gen_salt('bf')), 'user', TRUE)
     RETURNING ${publicUserColumns}`,
    [username, email, password]
  );

  res.status(201).json({
    success: true,
    message: 'Registrasi berhasil',
    data: result.rows[0],
  });
});

const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!email || !password) {
    res.status(400);
    throw new Error('email dan password wajib diisi');
  }

  const result = await pool.query(
    `SELECT ${publicUserColumns}
     FROM pengguna
     WHERE email = $1
       AND aktif = TRUE
       AND password_hash = crypt($2, password_hash)
     LIMIT 1`,
    [email, password]
  );

  if (result.rowCount === 0) {
    res.status(401);
    throw new Error('Email atau password salah');
  }

  res.json({
    success: true,
    message: 'Login berhasil',
    data: result.rows[0],
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const username = String(req.body.username || '').trim();
  const newPassword = String(req.body.newPassword || '');

  if (!email || !username || !newPassword) {
    res.status(400);
    throw new Error('email, username, dan password baru wajib diisi');
  }

  if (newPassword.length < 8) {
    res.status(400);
    throw new Error('password baru minimal 8 karakter');
  }

  const result = await pool.query(
    `UPDATE pengguna 
     SET password_hash = crypt($1, gen_salt('bf')),
         updated_at = CURRENT_TIMESTAMP
     WHERE email = $2 AND username = $3 AND aktif = TRUE
     RETURNING id`,
    [newPassword, email, username]
  );

  if (result.rowCount === 0) {
    res.status(404);
    throw new Error('Data email atau username salah, atau akun tidak aktif');
  }

  res.json({
    success: true,
    message: 'Password berhasil diubah, silakan login dengan password baru',
  });
});

module.exports = {
  login,
  register,
  resetPassword,
};
