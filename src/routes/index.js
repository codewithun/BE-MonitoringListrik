const express = require('express');
const rumahRoutes = require('./rumah.routes');
const perangkatRoutes = require('./perangkat.routes');
const dataListrikRoutes = require('./dataListrik.routes');
const relayRoutes = require('./relay.routes');
const prediksiRoutes = require('./prediksi.routes');
const ringkasanRoutes = require('./ringkasan.routes');
const deviceRoutes = require('./device.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const tarifListrikRoutes = require('./tarifListrik.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/rumah', rumahRoutes);
router.use('/perangkat', perangkatRoutes);
router.use('/data-listrik', dataListrikRoutes);
router.use('/', relayRoutes);
router.use('/prediksi-bulanan', prediksiRoutes);
router.use('/ringkasan-bulanan', ringkasanRoutes);
router.use('/device', deviceRoutes);
router.use('/tarif-listrik', tarifListrikRoutes);

module.exports = router;
