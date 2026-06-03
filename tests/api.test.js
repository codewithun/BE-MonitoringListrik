const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');

const unique = Date.now();
const deviceId = `TEST_${unique}`;

let rumahId;
let perangkatId;

afterAll(async () => {
  try {
    if (deviceId) {
      await pool.query('DELETE FROM perangkat WHERE device_id = $1', [deviceId]);
    }

    if (rumahId) {
      await pool.query('DELETE FROM rumah WHERE id = $1', [rumahId]);
    }
  } finally {
    await pool.end();
  }
});

describe('API Monitoring Listrik', () => {
  test('GET /api/health harus aktif', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/rumah harus membuat rumah baru', async () => {
    const res = await request(app)
      .post('/api/rumah')
      .send({
        nama_rumah: `Rumah Test ${unique}`,
        alamat: 'Alamat Test',
        deskripsi: 'Data rumah dari automated test',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.nama_rumah).toContain('Rumah Test');

    rumahId = res.body.data.id;
  });

  test('GET /api/rumah harus mengembalikan array data rumah', async () => {
    const res = await request(app).get('/api/rumah');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('PUT /api/rumah/:id harus mengubah data rumah', async () => {
    const res = await request(app)
      .put(`/api/rumah/${rumahId}`)
      .send({
        nama_rumah: `Rumah Test Update ${unique}`,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nama_rumah).toBe(`Rumah Test Update ${unique}`);
  });

  test('POST /api/perangkat harus membuat perangkat baru', async () => {
    const res = await request(app)
      .post('/api/perangkat')
      .send({
        deviceId,
        rumah_id: rumahId,
        nama_perangkat: 'Perangkat Test',
        versi_firmware: 'test-1.0.0',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.device_id).toBe(deviceId);

    perangkatId = res.body.data.id;
  });

  test('GET /api/perangkat harus mengembalikan daftar perangkat', async () => {
    const res = await request(app).get(`/api/perangkat?rumahId=${rumahId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((item) => item.device_id === deviceId)).toBe(true);
  });

  test('POST /api/device/register harus register/update perangkat ESP32', async () => {
    const res = await request(app)
      .post('/api/device/register')
      .send({
        deviceId,
        nama_perangkat: 'ESP32 Test Register',
        versi_firmware: 'test-1.0.1',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.device_id).toBe(deviceId);
  });

  test('POST /api/data-listrik harus menyimpan data monitoring PZEM', async () => {
    const res = await request(app)
      .post('/api/data-listrik')
      .send({
        deviceId,
        tegangan: 220.5,
        arus: 0.15,
        daya: 33.1,
        energi: 1.45,
        frekuensi: 50.0,
        faktor_daya: 0.82,
        status_relay: false,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.device_id).toBe(deviceId);
  });

  test('GET /api/data-listrik/latest harus mengambil data listrik terbaru', async () => {
    const res = await request(app).get(`/api/data-listrik/latest?deviceId=${deviceId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.device_id).toBe(deviceId);
  });

  test('GET /api/data-listrik/history harus mengambil riwayat data listrik', async () => {
    const res = await request(app).get(`/api/data-listrik/history?deviceId=${deviceId}&limit=10`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('POST /api/relay-control harus mengubah relay dari website', async () => {
    const res = await request(app)
      .post('/api/relay-control')
      .send({
        deviceId,
        relay: true,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status_relay).toBe(true);
  });

  test('GET /api/relay-state harus mengambil status relay untuk ESP32', async () => {
    const res = await request(app).get(`/api/relay-state?deviceId=${deviceId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.relay).toBe(true);
  });

  test('POST /api/relay-status harus menyimpan status relay dari ESP32/voice', async () => {
    const res = await request(app)
      .post('/api/relay-status')
      .send({
        deviceId,
        relay: false,
        source: 'voice',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status_relay).toBe(false);
  });

  test('POST /api/ringkasan-bulanan harus menyimpan ringkasan bulanan', async () => {
    const res = await request(app)
      .post('/api/ringkasan-bulanan')
      .send({
        rumah_id: rumahId,
        bulan: 7,
        tahun: 2026,
        total_energi_kwh: 210.5,
        total_biaya: 304172.5,
        rata_tegangan: 220.1,
        rata_arus: 0.95,
        rata_daya: 180.2,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.bulan)).toBe(7);
  });

  test('GET /api/ringkasan-bulanan harus mengambil ringkasan bulanan', async () => {
    const res = await request(app).get(`/api/ringkasan-bulanan?rumahId=${rumahId}&bulan=7&tahun=2026`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('POST /api/prediksi-bulanan harus menyimpan prediksi LSTM', async () => {
    const res = await request(app)
      .post('/api/prediksi-bulanan')
      .send({
        rumah_id: rumahId,
        bulan: 8,
        tahun: 2026,
        prediksi_energi_kwh: 220,
        prediksi_biaya: 317900,
        nama_model: 'LSTM Test',
        akurasi: 92.5,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.bulan)).toBe(8);
  });

  test('GET /api/prediksi-bulanan harus mengambil hasil prediksi', async () => {
    const res = await request(app).get(`/api/prediksi-bulanan?rumahId=${rumahId}&bulan=8&tahun=2026`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('DELETE /api/perangkat/:id harus menghapus perangkat', async () => {
    const res = await request(app).delete(`/api/perangkat/${perangkatId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    perangkatId = null;
  });

  test('DELETE /api/rumah/:id harus menghapus rumah', async () => {
    const res = await request(app).delete(`/api/rumah/${rumahId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    rumahId = null;
  });
});
