const express = require('express');
const {
  getRingkasanBulanan,
  createRingkasanBulanan,
} = require('../controllers/ringkasan.controller');

const router = express.Router();

router.get('/', getRingkasanBulanan);
router.post('/', createRingkasanBulanan);

module.exports = router;
