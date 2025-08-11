const express = require('express');
const router = express.Router();
const merchantController = require('../../controllers/admin/merchantController');
const authMiddleware = require('../../middleware/admin/authMiddleware');

router.get('/', authMiddleware, merchantController.getAllMerchants);
router.get('/search', authMiddleware, merchantController.searchMerchants);
router.get('/:id', authMiddleware, merchantController.getMerchantById);
router.get('/:id/stats', authMiddleware, merchantController.getMerchantStats);
router.post('/', authMiddleware, merchantController.createMerchant);
router.put('/:id', authMiddleware, merchantController.updateMerchant);
router.put('/:id/approve', authMiddleware, merchantController.approveMerchant);
router.delete('/:id', authMiddleware, merchantController.deleteMerchant);

module.exports = router;