require('dotenv').config();
const app = require('./app');
const startCleanupDataListrikJob = require('./jobs/cleanupDataListrik');

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  startCleanupDataListrikJob();
});
