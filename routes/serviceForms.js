const express = require('express');
const router = express.Router();
const serviceFormController = require('../controllers/serviceFormController');

router.post('/', serviceFormController.createServiceForm);
router.get('/', serviceFormController.getServiceForms);
router.get('/:id', serviceFormController.getServiceFormById);
router.put('/:id', serviceFormController.updateServiceForm);
router.delete('/:id', serviceFormController.deleteServiceForm);

module.exports = router;
