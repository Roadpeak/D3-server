const express = require('express');
const router = express.Router();
const storeController = require('../../controllers/admin/storeController');
const authMiddleware = require('../../middleware/admin/authMiddleware');

router.get('/', authMiddleware, storeController.getAllStores);
router.get('/search', authMiddleware, storeController.searchStores);
router.get('/merchant/:id', authMiddleware, storeController.getStoresByMerchant);
router.get('/:id', authMiddleware, storeController.getStoreById);
router.post('/', authMiddleware, storeController.createStore);
router.put('/:id', authMiddleware, storeController.updateStore);
router.delete('/:id', authMiddleware, storeController.deleteStore);

module.exports = router;