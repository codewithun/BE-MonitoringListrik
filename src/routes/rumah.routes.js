const express = require('express');
const {
  getRumah,
  createRumah,
  updateRumah,
  deleteRumah,
} = require('../controllers/rumah.controller');

const router = express.Router();

router.get('/', getRumah);
router.post('/', createRumah);
router.put('/:id', updateRumah);
router.delete('/:id', deleteRumah);

module.exports = router;
