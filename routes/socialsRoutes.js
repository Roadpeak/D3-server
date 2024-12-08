const express = require('express');
const router = express.Router();
const authenticate = require('../milddlewares/authenticate'); // Import the authentication middleware
const socialsController = require('../controllers/socialsController');

// Create a new social media entry
router.post('/socials', socialsController.createSocial);

// Get all social media entries for a store
router.get('/socials/:storeId', socialsController.getSocialsByStore);

// Update a social media entry
router.put('/socials/:id', socialsController.updateSocial);

// Delete a social media entry
router.delete('/socials/:id', socialsController.deleteSocial);

module.exports = router;
