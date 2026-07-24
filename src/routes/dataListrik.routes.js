const express = require('express');
const {
  createDataListrik,
  getLatestDataListrik,
  getHistoryDataListrik,
  getMonthlyHistoryDataListrik,
} = require('../controllers/dataListrik.controller');
const router = express.Router();

router.post('/', createDataListrik); 
router.get('/latest', getLatestDataListrik);
router.get('/history', getHistoryDataListrik);
router.get('/history-monthly', getMonthlyHistoryDataListrik);

module.exports = router;
