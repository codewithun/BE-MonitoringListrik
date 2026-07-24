const express = require('express');
const {
  createDataListrik,
  getLatestDataListrik,
  getHistoryDataListrik,
  getMonthlyHistoryDataListrik,
} = require('../controllers/dataListrik.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', createDataListrik); // IoT endpoint without standard user auth
router.get('/latest', protect, getLatestDataListrik);
router.get('/history', protect, getHistoryDataListrik);
router.get('/history-monthly', protect, getMonthlyHistoryDataListrik);

module.exports = router;
