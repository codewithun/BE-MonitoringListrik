const express = require('express');
const {
  createDataListrik,
  getLatestDataListrik,
  getHistoryDataListrik,
} = require('../controllers/dataListrik.controller');

const router = express.Router();

router.post('/', createDataListrik);
router.get('/latest', getLatestDataListrik);
router.get('/history', getHistoryDataListrik);

module.exports = router;
