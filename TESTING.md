# Automated Test Backend Monitoring Listrik

Backend ini bisa dites otomatis seperti PHPUnit, tetapi untuk Node.js + Express memakai Jest dan Supertest.

## 1. Install dependency test

```bash
npm install
npm install --save-dev jest supertest
```

## 2. Siapkan database

Pastikan database PostgreSQL sudah ada dan schema sudah di-import.

```bash
psql -U postgres -d monitoring_listrik -f db/schema.sql
```

Disarankan membuat database khusus test agar tidak mengganggu database utama.

```bash
createdb monitoring_listrik_test
psql -U postgres -d monitoring_listrik_test -f db/schema.sql
```

Lalu copy file env test:

```bash
cp .env.test.example .env.test
```

Isi password database sesuai PostgreSQL kamu.

## 3. Jalankan semua test

```bash
npm test
```

## 4. Jalankan mode watch

```bash
npm run test:watch
```

## Endpoint yang dites

- GET /api/health
- GET /api/rumah
- POST /api/rumah
- PUT /api/rumah/:id
- DELETE /api/rumah/:id
- GET /api/perangkat
- POST /api/perangkat
- DELETE /api/perangkat/:id
- POST /api/device/register
- POST /api/data-listrik
- GET /api/data-listrik/latest
- GET /api/data-listrik/history
- POST /api/relay-control
- GET /api/relay-state
- POST /api/relay-status
- POST /api/ringkasan-bulanan
- GET /api/ringkasan-bulanan
- POST /api/prediksi-bulanan
- GET /api/prediksi-bulanan

## Catatan

Test ini membuat data dengan prefix `TEST_` lalu menghapusnya lagi setelah test selesai.
Jangan pakai database production untuk automated test.
