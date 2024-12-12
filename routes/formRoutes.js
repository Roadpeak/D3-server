const express = require('express');
const { createForm, getForms, getFormById, updateForm, deleteForm, getFormsByServiceId } = require('../controllers/formController');
const router = express.Router();

router.post('/create', createForm);
router.get('/', getForms);
router.get('/service/:serviceId', getFormsByServiceId);
router.get('/:id', getFormById);
router.put('/:id', updateForm);
router.delete('/:id', deleteForm);

module.exports = router;
