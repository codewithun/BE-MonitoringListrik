# Backend Monitoring Listrik

Backend Express untuk sistem:

**Sistem Monitoring dan Prediksi Konsumsi Listrik Berbasis ESP32, PZEM, Voice AI, dan LSTM**

## Teknologi

- Node.js
- Express.js
- PostgreSQL
- pg
- node-cron

## Struktur Folder

```txt
backend-monitoring-listrik/
├── db/
│   └── schema.sql
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   └── jobs/
├── .env.example
├── package.json
└── README.md
```

## Cara Menjalankan

### 1. Install package

```bash
npm install
```

### 2. Buat database PostgreSQL

```sql
CREATE DATABASE monitoring_listrik;
```

### 3. Import schema

```bash
psql -U postgres -d monitoring_listrik -f db/schema.sql
```

Atau copy isi `db/schema.sql` ke query tool PostgreSQL.

### 4. Buat file `.env`

```bash
cp .env.example .env
```

Lalu sesuaikan konfigurasi database:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=monitoring_listrik
DB_USER=postgres
DB_PASSWORD=postgres
DATA_RETENTION_DAYS=30
```

### 5. Jalankan server

Mode development:

```bash
npm run dev
```

Mode production:

```bash
npm start
```

## Base URL Lokal

```txt
http://localhost:5000/api
```

## Endpoint ESP32

### Register Device

```http
POST /api/device/register
```

Body:

```json
{
  "deviceId": "9454C5A93644",
  "nama_perangkat": "Pompa Air",
  "versi_firmware": "1.0.0"
}
```

### Kirim Data Listrik

```http
POST /api/data-listrik
```

Body:

```json
{
  "deviceId": "9454C5A93644",
  "tegangan": 220.5,
  "arus": 0.15,
  "daya": 33.1,
  "energi": 1.45,
  "frekuensi": 50.0,
  "faktor_daya": 0.82,
  "status_relay": true
}
```

### Ambil Status Relay untuk Polling ESP32

```http
GET /api/relay-state?deviceId=9454C5A93644
```

Response:

```json
{
  "success": true,
  "relay": true,
  "data": {
    "device_id": "9454C5A93644",
    "nama_perangkat": "Pompa Air",
    "relay": true,
    "status_online": true,
    "terakhir_online": "2026-06-03T12:00:00.000Z"
  }
}
```

### Update Relay dari ESP32 / Voice AI

```http
POST /api/relay-status
```

Body:

```json
{
  "deviceId": "9454C5A93644",
  "relay": true,
  "source": "voice"
}
```

## Endpoint Website

### Rumah

```http
GET    /api/rumah
POST   /api/rumah
PUT    /api/rumah/:id
DELETE /api/rumah/:id
```

### Perangkat

```http
GET    /api/perangkat
POST   /api/perangkat
PUT    /api/perangkat/:id
DELETE /api/perangkat/:id
```

### Monitoring

```http
GET /api/data-listrik/latest
GET /api/data-listrik/history
```

Query contoh:

```txt
/api/data-listrik/latest?deviceId=9454C5A93644
/api/data-listrik/history?deviceId=9454C5A93644&limit=100
/api/data-listrik/history?rumahId=UUID_RUMAH&start=2026-06-01&end=2026-06-30
```

### Relay dari Website

```http
POST /api/relay-control
```

Body:

```json
{
  "deviceId": "9454C5A93644",
  "relay": true
}
```

### Prediksi Bulanan

```http
GET  /api/prediksi-bulanan
POST /api/prediksi-bulanan
```

Body POST:

```json
{
  "rumah_id": "UUID_RUMAH",
  "bulan": 7,
  "tahun": 2026,
  "prediksi_energi_kwh": 220,
  "prediksi_biaya": 316800,
  "nama_model": "LSTM",
  "akurasi": 92.5
}
```

### Ringkasan Bulanan

```http
GET  /api/ringkasan-bulanan
POST /api/ringkasan-bulanan
```

## Catatan

- Data realtime `data_listrik` otomatis dibersihkan setiap hari.
- Default retensi data mentah adalah 30 hari.
- Jika ESP32 mengirim data dengan `deviceId` yang belum ada, backend otomatis membuat data perangkat baru dengan nama default.
# BE-MonitoringListrik
