const express = require('express');
const router = express.Router();
const formResponseController = require('../controllers/formResponseController');

// Create a form response
router.post('/', formResponseController.createFormResponse);

// Get all form responses
router.get('/', formResponseController.getFormResponses);

// Get a form response by ID
router.get('/:id', formResponseController.getFormResponseById);

// Update a form response
router.put('/:id', formResponseController.updateFormResponse);

// Delete a form response
router.delete('/:id', formResponseController.deleteFormResponse);

module.exports = router;
