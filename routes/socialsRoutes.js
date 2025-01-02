const express = require('express');
const router = express.Router();
const socialsController = require('../controllers/socialsController');

router.post('/socials', socialsController.createSocial);

router.get('/socials/:storeId', socialsController.getSocialsByStore);

router.put('/socials/:id', socialsController.updateSocial);

router.delete('/socials/:id', socialsController.deleteSocial);

module.exports = router;
