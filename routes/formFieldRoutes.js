const express = require('express');
const router = express.Router();
const { createFormField, getFormFields, updateFormField, deleteFormField } = require('../controllers/formFieldController');

router.post('/create', createFormField);
router.get('/:form_id', getFormFields);
router.put('/:id', updateFormField);
router.delete('/:id', deleteFormField);

module.exports = router;
