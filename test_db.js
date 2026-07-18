require('dotenv').config();
const pool = require('./src/config/db');

async function test() {
  try {
    const res = await pool.query(`INSERT INTO log_relay (device_id, status_relay, sumber) VALUES ('test_device', false, 'api') RETURNING *`);
    console.log("Success:", res.rows[0]);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    process.exit(0);
  }
}
test();
