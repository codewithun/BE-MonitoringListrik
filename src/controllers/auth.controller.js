const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

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

const requestResetOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    res.status(400);
    throw new Error('Email wajib diisi');
  }

  const result = await pool.query('SELECT id, username FROM pengguna WHERE email = $1 AND aktif = TRUE', [email]);
  if (result.rowCount === 0) {
    res.status(404);
    throw new Error('Akun dengan email tersebut tidak ditemukan atau tidak aktif');
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await pool.query(
    'UPDATE pengguna SET reset_otp = $1, reset_otp_expires_at = $2 WHERE email = $3',
    [otp, expiresAt, email]
  );

  const html = `
    <h2>Reset Password WattWise</h2>
    <p>Halo ${result.rows[0].username},</p>
    <p>Anda telah meminta untuk mereset password akun WattWise Anda.</p>
    <p>Berikut adalah kode OTP Anda:</p>
    <h3 style="background-color: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 5px;">${otp}</h3>
    <p>Kode ini hanya berlaku selama 5 menit.</p>
    <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
  `;

  console.log(`[DEV ONLY] OTP for ${email} is ${otp}`);

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    await sendEmail({
      email,
      subject: 'Kode OTP Reset Password WattWise',
      html,
    });
  }

  res.json({
    success: true,
    message: 'Kode OTP telah dikirim ke email Anda',
  });
});

const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();
  const newPassword = String(req.body.newPassword || '');

  if (!email || !otp || !newPassword) {
    res.status(400);
    throw new Error('Email, OTP, dan password baru wajib diisi');
  }

  if (newPassword.length < 8) {
    res.status(400);
    throw new Error('Password baru minimal 8 karakter');
  }

  const result = await pool.query(
    'SELECT id, reset_otp_expires_at FROM pengguna WHERE email = $1 AND reset_otp = $2 AND aktif = TRUE',
    [email, otp]
  );

  if (result.rowCount === 0) {
    res.status(400);
    throw new Error('Kode OTP salah atau akun tidak ditemukan');
  }

  if (new Date() > result.rows[0].reset_otp_expires_at) {
    res.status(400);
    throw new Error('Kode OTP sudah kedaluwarsa');
  }

  await pool.query(
    `UPDATE pengguna 
     SET password_hash = crypt($1, gen_salt('bf')),
         reset_otp = NULL,
         reset_otp_expires_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [newPassword, result.rows[0].id]
  );

  res.json({
    success: true,
    message: 'Password berhasil diubah, silakan login dengan password baru',
  });
});

module.exports = {
  login,
  register,
  requestResetOtp,
  resetPasswordWithOtp,
};
