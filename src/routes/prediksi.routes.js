const express = require('express');
const {
  getPrediksiBulanan,
  createPrediksiBulanan,
} = require('../controllers/prediksi.controller');

const router = express.Router();

router.get('/', getPrediksiBulanan);
router.post('/', createPrediksiBulanan);

module.exports = router;
