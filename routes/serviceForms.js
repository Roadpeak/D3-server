const express = require('express');
const router = express.Router();
const serviceFormController = require('../controllers/serviceFormController');

router.post('/service-form', serviceFormController.createServiceForm);
router.get('/service-form', serviceFormController.getServiceForms);
router.get('/service-form/:id', serviceFormController.getServiceFormById);
router.put('service-form/:id', serviceFormController.updateServiceForm);
router.delete('/service-form/:id', serviceFormController.deleteServiceForm);

module.exports = router;
