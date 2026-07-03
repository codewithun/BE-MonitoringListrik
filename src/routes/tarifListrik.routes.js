const express = require('express');
const {
  getTarifListrik,
  createTarifListrik,
  updateTarifListrik,
  deleteTarifListrik,
} = require('../controllers/tarifListrik.controller');

const router = express.Router();

router.get('/', getTarifListrik);
router.post('/', createTarifListrik);
router.put('/:id', updateTarifListrik);
router.delete('/:id', deleteTarifListrik);

module.exports = router;
