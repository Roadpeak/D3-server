const express = require('express');
const router = express.Router();
const socialsController = require('../controllers/socialsController');
const { authenticateMerchant } = require('../middleware/Merchantauth');
const { optionalAuth } = require('../middleware/auth');

// Merchant routes (protected) - for managing social links
router.post('/socials', authenticateMerchant, socialsController.createSocial);
router.put('/socials/:id', authenticateMerchant, socialsController.updateSocial);
router.delete('/socials/:id', authenticateMerchant, socialsController.deleteSocial);

// Public route (with optional auth) - for viewing social links on store page
router.get('/socials/store/:storeId', optionalAuth, socialsController.getSocialsByStore);

// Alternative merchant route for getting their own store's socials
router.get('/merchant/socials/:storeId', authenticateMerchant, socialsController.getSocialsByStore);

module.exports = router;