const express = require('express');
const { 
  createStore, 
  getStores, 
  getStoreById, 
  updateStore, 
  deleteStore 
} = require('../controllers/storeController');
const { verifyToken } = require('../milddlewares/auth');

const router = express.Router();

// Store routes
router.post('/stores/', verifyToken, createStore);
router.get('/stores/', verifyToken, getStores);
router.get('/stores/:id', verifyToken, getStoreById);
router.put('/stores/:id', verifyToken, updateStore);

module.exports = router;
