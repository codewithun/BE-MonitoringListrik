const express = require('express');
const { subscribe } = require('../controllers/notification.controller');

const router = express.Router();

router.post('/subscribe', subscribe);

module.exports = router;
