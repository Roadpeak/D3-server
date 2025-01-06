const express = require('express');
const {
    register,
    login,
    requestPasswordReset,
    resetPassword,
    getMerchantProfile,
    createMerchant, 
    searchMerchants,
} = require('../controllers/merchantController');

const router = express.Router();

router.post('/merchants/register', register);
router.post('/merchants/login', login);
router.post('/merchants/request-password-reset', requestPasswordReset);
router.post('/merchants/reset-password', resetPassword);
router.get('/merchants/profile/:merchantId', getMerchantProfile);
router.post('/merchants/create', createMerchant);
router.get('/merchants/search', searchMerchants);

module.exports = router;
