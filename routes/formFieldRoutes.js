const express = require('express');
const router = express.Router();
const formFieldController = require('../controllers/formFieldController');

router.post('/create', formFieldController.createFormField);
router.get('/:form_id', formFieldController.getFormFields);
router.put('/:id', formFieldController.updateFormField);
router.delete('/:id', formFieldController.deleteFormField);

module.exports = router;
