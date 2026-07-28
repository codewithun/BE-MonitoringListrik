const express = require('express');
const { subscribe, debugPushData, testPush } = require('../controllers/notification.controller');

const router = express.Router();

router.post('/subscribe', subscribe);
router.get('/debug', debugPushData);
router.get('/test', testPush);

module.exports = router;
