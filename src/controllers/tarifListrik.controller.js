const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

function mapTarifRow(row) {
  return {
    ...row,
    harga_per_kwh:
      row.harga_per_kwh === null || row.harga_per_kwh === undefined
        ? null
        : Number(row.harga_per_kwh),
    jumlah_perangkat: Number(row.jumlah_perangkat || 0),
    perangkat_online: Number(row.perangkat_online || 0),
    relay_on: Number(row.relay_on || 0),
  };
}

const getRumahOptions = async () => {
  const result = await pool.query(`
    SELECT
      r.id,
      r.nama_rumah,
      r.alamat,
      COUNT(DISTINCT p.id)::int AS jumlah_perangkat,
      COUNT(DISTINCT p.id) FILTER (WHERE p.status_online = TRUE)::int AS perangkat_online,
      COUNT(DISTINCT p.id) FILTER (WHERE p.status_relay = TRUE)::int AS relay_on
    FROM rumah r
    LEFT JOIN perangkat p ON p.rumah_id = r.id
    GROUP BY r.id
    ORDER BY r.nama_rumah ASC
  `);

  return result.rows.map(mapTarifRow);
};

const getTarifListrik = asyncHandler(async (req, res) => {
  const { rumahId } = req.query;
  const params = [];
  const conditions = [];

  if (rumahId) {
    params.push(rumahId);
    conditions.push(`tl.rumah_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [tarifResult, rumahRows] = await Promise.all([
    pool.query(
      `SELECT
        tl.id,
        tl.rumah_id,
        r.nama_rumah,
        r.alamat,
        tl.nama_tarif,
        tl.tegangan,
        tl.harga_per_kwh,
        COALESCE(tl.status, 'Aktif') AS status,
        tl.catatan,
        tl.created_at,
        tl.updated_at,
        COUNT(DISTINCT p.id)::int AS jumlah_perangkat,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status_online = TRUE)::int AS perangkat_online,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status_relay = TRUE)::int AS relay_on
       FROM tarif_listrik tl
       JOIN rumah r ON r.id = tl.rumah_id
       LEFT JOIN perangkat p ON p.rumah_id = r.id
       ${where}
       GROUP BY tl.id, r.id
       ORDER BY r.nama_rumah ASC, tl.created_at DESC`,
      params
    ),
    getRumahOptions(),
  ]);

  res.json({
    success: true,
    data: tarifResult.rows.map(mapTarifRow),
    rumah: rumahRows,
  });
});

const createTarifListrik = asyncHandler(async (req, res) => {
  const {
    rumah_id,
    nama_tarif,
    tegangan,
    harga_per_kwh,
    status = 'Aktif',
    catatan,
  } = req.body;

  if (!rumah_id) {
    res.status(400);
    throw new Error('rumah_id wajib diisi');
  }

  if (harga_per_kwh === undefined || harga_per_kwh === null || harga_per_kwh === '') {
    res.status(400);
    throw new Error('harga_per_kwh wajib diisi');
  }

  const result = await pool.query(
    `INSERT INTO tarif_listrik
      (rumah_id, nama_tarif, tegangan, harga_per_kwh, status, catatan)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      rumah_id,
      nama_tarif || 'Tarif Listrik',
      tegangan || null,
      Number(harga_per_kwh),
      status,
      catatan || null,
    ]
  );

  res.status(201).json({ success: true, data: mapTarifRow(result.rows[0]) });
});

const updateTarifListrik = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    rumah_id,
    nama_tarif,
    tegangan,
    harga_per_kwh,
    status,
    catatan,
  } = req.body;

  const result = await pool.query(
    `UPDATE tarif_listrik
     SET
      rumah_id = COALESCE($1, rumah_id),
      nama_tarif = COALESCE($2, nama_tarif),
      tegangan = COALESCE($3, tegangan),
      harga_per_kwh = COALESCE($4, harga_per_kwh),
      status = COALESCE($5, status),
      catatan = COALESCE($6, catatan),
      updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [
      rumah_id,
      nama_tarif,
      tegangan,
      harga_per_kwh === undefined || harga_per_kwh === null
        ? null
        : Number(harga_per_kwh),
      status,
      catatan,
      id,
    ]
  );

  if (result.rowCount === 0) {
    res.status(404);
    throw new Error('Tarif listrik tidak ditemukan');
  }

  res.json({ success: true, data: mapTarifRow(result.rows[0]) });
});

const deleteTarifListrik = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `DELETE FROM tarif_listrik WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    res.status(404);
    throw new Error('Tarif listrik tidak ditemukan');
  }

  res.json({ success: true, message: 'Tarif listrik berhasil dihapus' });
});

module.exports = {
  getTarifListrik,
  createTarifListrik,
  updateTarifListrik,
  deleteTarifListrik,
};
