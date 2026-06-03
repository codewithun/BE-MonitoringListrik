const express = require('express');
const {
  getPerangkat,
  createPerangkat,
  updatePerangkat,
  deletePerangkat,
} = require('../controllers/perangkat.controller');

const router = express.Router();

router.get('/', getPerangkat);
router.post('/', createPerangkat);
router.put('/:id', updatePerangkat);
router.delete('/:id', deletePerangkat);

module.exports = router;
