const express = require('express');
const router = express.Router();
const { createFormResponse, getFormResponses, updateFormResponse, deleteFormResponse } = require('../controllers/formResponseController');

router.post('/', createFormResponse);
router.get('/', getFormResponses);
// router.get('/:id', getFormResponseById);
router.put('/:id', updateFormResponse);
router.delete('/:id', deleteFormResponse);

module.exports = router;
