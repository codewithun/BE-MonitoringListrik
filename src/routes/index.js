const express = require('express');
const rumahRoutes = require('./rumah.routes');
const perangkatRoutes = require('./perangkat.routes');
const dataListrikRoutes = require('./dataListrik.routes');
const relayRoutes = require('./relay.routes');
const prediksiRoutes = require('./prediksi.routes');
const ringkasanRoutes = require('./ringkasan.routes');
const deviceRoutes = require('./device.routes');

const router = express.Router();

router.use('/rumah', rumahRoutes);
router.use('/perangkat', perangkatRoutes);
router.use('/data-listrik', dataListrikRoutes);
router.use('/', relayRoutes);
router.use('/prediksi-bulanan', prediksiRoutes);
router.use('/ringkasan-bulanan', ringkasanRoutes);
router.use('/device', deviceRoutes);

module.exports = router;
