const express = require('express');
const router = express.Router();
const promoController = require('../../controllers/admin/promoController');
const authMiddleware = require('../../middleware/admin/authMiddleware');

router.get('/', authMiddleware, promoController.getAllPromos);
router.get('/search', authMiddleware, promoController.searchPromos);
router.get('/:id', authMiddleware, promoController.getPromoById);
router.post('/', authMiddleware, promoController.createPromo);
router.put('/:id', authMiddleware, promoController.updatePromo);
router.put('/:id/activate', authMiddleware, promoController.activatePromo);
router.put('/:id/deactivate', authMiddleware, promoController.deactivatePromo);
router.delete('/:id', authMiddleware, promoController.deletePromo);

module.exports = router;