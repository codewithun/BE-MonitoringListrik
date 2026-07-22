const express = require('express');
const { login, register, requestResetOtp, resetPasswordWithOtp } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/request-reset-otp', requestResetOtp);
router.post('/reset-password-otp', resetPasswordWithOtp);

module.exports = router;
