const express = require('express');
const { registerDevice } = require('../controllers/device.controller');

const router = express.Router();

router.post('/register', registerDevice);

module.exports = router;
