const express = require('express');
const {
  getRelayState,
  relayControlFromWeb,
  relayStatusFromDevice,
} = require('../controllers/relay.controller');

const router = express.Router();

router.get('/relay-state', getRelayState);
router.post('/relay-control', relayControlFromWeb);
router.post('/relay-status', relayStatusFromDevice);

module.exports = router;
