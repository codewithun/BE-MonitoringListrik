const express = require('express');
const { login, register, requestResetOtp, verifyResetOtp, resetPasswordWithOtp } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/request-reset-otp', requestResetOtp);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password-otp', resetPasswordWithOtp);

module.exports = router;
