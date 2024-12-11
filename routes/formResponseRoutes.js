const express = require('express');
const router = express.Router();
const formResponseController = require('../controllers/formResponseController');

router.post('/create', formResponseController.createFormResponse);
router.get('/:form_id', formResponseController.getFormResponses);

module.exports = router;
