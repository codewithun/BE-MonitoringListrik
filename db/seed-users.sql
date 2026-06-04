-- =====================================================
-- SEED DATA PENGGUNA
-- Akun awal untuk login dashboard
-- =====================================================
-- Jalankan setelah db/schema.sql.
-- Password awal:
--   admin@monitoring-listrik.local / Admin123!
--   user@monitoring-listrik.local  / User123!

INSERT INTO pengguna (username, email, password_hash, role, aktif)
VALUES
  (
    'admin',
    'admin@monitoring-listrik.local',
    crypt('Admin123!', gen_salt('bf')),
    'admin',
    TRUE
  ),
  (
    'user',
    'user@monitoring-listrik.local',
    crypt('User123!', gen_salt('bf')),
    'user',
    TRUE
  )
ON CONFLICT (email) DO UPDATE
SET
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  aktif = EXCLUDED.aktif,
  updated_at = NOW();
