-- =====================================================
-- DATABASE SCHEMA
-- Sistem Monitoring dan Prediksi Konsumsi Listrik
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- PENGGUNA
-- =====================================================
CREATE TABLE IF NOT EXISTS pengguna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','user')),
  aktif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- RUMAH
-- =====================================================
CREATE TABLE IF NOT EXISTS rumah (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_rumah VARCHAR(150) NOT NULL,
  alamat TEXT,
  deskripsi TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- AKSES RUMAH MANY TO MANY
-- =====================================================
CREATE TABLE IF NOT EXISTS akses_rumah (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pengguna_id UUID NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  rumah_id UUID NOT NULL REFERENCES rumah(id) ON DELETE CASCADE,
  UNIQUE(pengguna_id, rumah_id)
);

-- =====================================================
-- TARIF LISTRIK
-- =====================================================
CREATE TABLE IF NOT EXISTS tarif_listrik (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rumah_id UUID NOT NULL REFERENCES rumah(id) ON DELETE CASCADE,
  nama_tarif VARCHAR(100),
  tegangan INTEGER,
  harga_per_kwh NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'Aktif',
  catatan TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE tarif_listrik
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Aktif';

ALTER TABLE tarif_listrik
ADD COLUMN IF NOT EXISTS catatan TEXT;

ALTER TABLE tarif_listrik
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tarif_listrik_rumah ON tarif_listrik(rumah_id);

-- =====================================================
-- PERANGKAT
-- DEVICE_ID = MAC ADDRESS ESP32
-- =====================================================
CREATE TABLE IF NOT EXISTS perangkat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(50) UNIQUE NOT NULL,
  rumah_id UUID REFERENCES rumah(id) ON DELETE SET NULL,
  nama_perangkat VARCHAR(150) NOT NULL,
  nama_beban VARCHAR(150),
  status_relay BOOLEAN DEFAULT FALSE,
  versi_firmware VARCHAR(50),
  status_online BOOLEAN DEFAULT FALSE,
  terakhir_online TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE perangkat
ADD COLUMN IF NOT EXISTS nama_beban VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_perangkat_device_id ON perangkat(device_id);
CREATE INDEX IF NOT EXISTS idx_perangkat_rumah ON perangkat(rumah_id);

-- =====================================================
-- DATA LISTRIK REALTIME RAW PZEM
-- RETENSI 30 HARI
-- =====================================================
CREATE TABLE IF NOT EXISTS data_listrik (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(50) REFERENCES perangkat(device_id) ON DELETE CASCADE,
  tegangan NUMERIC(10,2),
  arus NUMERIC(10,3),
  daya NUMERIC(10,2),
  energi NUMERIC(12,4),
  frekuensi NUMERIC(6,2),
  faktor_daya NUMERIC(6,3),
  status_relay BOOLEAN,
  waktu_baca TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_listrik_device ON data_listrik(device_id);
CREATE INDEX IF NOT EXISTS idx_data_listrik_waktu ON data_listrik(waktu_baca);

-- =====================================================
-- LOG RELAY
-- =====================================================
CREATE TABLE IF NOT EXISTS log_relay (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(50) REFERENCES perangkat(device_id) ON DELETE CASCADE,
  status_relay BOOLEAN NOT NULL,
  sumber VARCHAR(20) CHECK (sumber IN ('voice','web','api')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_relay_device ON log_relay(device_id);

-- =====================================================
-- RINGKASAN BULANAN DATA AKTUAL
-- =====================================================
CREATE TABLE IF NOT EXISTS ringkasan_bulanan (
  id BIGSERIAL PRIMARY KEY,
  rumah_id UUID REFERENCES rumah(id) ON DELETE CASCADE,
  bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun INTEGER NOT NULL,
  total_energi_kwh NUMERIC(12,4),
  total_biaya NUMERIC(12,2),
  rata_tegangan NUMERIC(10,2),
  rata_arus NUMERIC(10,3),
  rata_daya NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(rumah_id, bulan, tahun)
);

-- =====================================================
-- HASIL PREDIKSI LSTM
-- =====================================================
CREATE TABLE IF NOT EXISTS prediksi_bulanan (
  id BIGSERIAL PRIMARY KEY,
  rumah_id UUID REFERENCES rumah(id) ON DELETE CASCADE,
  bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun INTEGER NOT NULL,
  prediksi_energi_kwh NUMERIC(12,4),
  prediksi_biaya NUMERIC(12,2),
  nama_model VARCHAR(100),
  akurasi NUMERIC(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(rumah_id, bulan, tahun)
);

-- =====================================================
-- VIEW DASHBOARD TERBARU
-- =====================================================
CREATE OR REPLACE VIEW v_dashboard_perangkat AS
SELECT
  p.id,
  p.device_id,
  p.nama_perangkat,
  p.status_online,
  p.status_relay,
  p.terakhir_online,
  r.nama_rumah
FROM perangkat p
LEFT JOIN rumah r ON p.rumah_id = r.id;
