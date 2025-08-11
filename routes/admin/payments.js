const express = require('express');
const router = express.Router();
const billingPaymentController = require('../../controllers/admin/billingPaymentController');
const offerPaymentController = require('../../controllers/admin/offerPaymentController');
const authMiddleware = require('../../middleware/admin/authMiddleware');

router.get('/billing', authMiddleware, billingPaymentController.getAllBillingPayments);
router.get('/billing/search', authMiddleware, billingPaymentController.searchBillingPayments);
router.get('/billing/:id', authMiddleware, billingPaymentController.getBillingPaymentById);
router.post('/billing', authMiddleware, billingPaymentController.createBillingPayment);
router.put('/billing/:id', authMiddleware, billingPaymentController.updateBillingPayment);
router.post('/billing/:id/process', authMiddleware, billingPaymentController.processBillingPayment);
router.post('/billing/:id/refund', authMiddleware, billingPaymentController.refundBillingPayment);

router.get('/offers', authMiddleware, offerPaymentController.getAllOfferPayments);
router.get('/offers/search', authMiddleware, offerPaymentController.searchOfferPayments);
router.get('/offers/:id', authMiddleware, offerPaymentController.getOfferPaymentById);
router.post('/offers', authMiddleware, offerPaymentController.createOfferPayment);
router.put('/offers/:id', authMiddleware, offerPaymentController.updateOfferPayment);
router.post('/offers/:id/process', authMiddleware, offerPaymentController.processOfferPayment);
router.post('/offers/:id/refund', authMiddleware, offerPaymentController.refundOfferPayment);

module.exports = router;