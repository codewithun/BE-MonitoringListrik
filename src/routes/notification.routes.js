const express = require('express');
const { subscribe, debugPushData } = require('../controllers/notification.controller');

const router = express.Router();

router.post('/subscribe', subscribe);
router.get('/debug', debugPushData);

module.exports = router;
