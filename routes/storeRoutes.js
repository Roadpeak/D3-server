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
router.post('/', verifyToken, createStore);
router.get('/', verifyToken, getStores);
router.get('/:id', verifyToken, getStoreById);
router.put('/:id', verifyToken, updateStore);

module.exports = router;
