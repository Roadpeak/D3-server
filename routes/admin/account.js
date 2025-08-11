const express = require('express');
const router = express.Router();
const accountController = require('../../controllers/admin/accountController');
const authMiddleware = require('../../middleware/admin/authMiddleware');
const upload = require('multer')({ dest: 'uploads/' });

router.get('/profile', authMiddleware, accountController.getProfile);
router.put('/profile', authMiddleware, accountController.updateProfile);
router.put('/password', authMiddleware, accountController.changePassword);
router.post('/avatar', authMiddleware, upload.single('avatar'), accountController.uploadAvatar);
router.get('/settings', authMiddleware, accountController.getSettings);
router.put('/settings', authMiddleware, accountController.updateSettings);
router.delete('/', authMiddleware, accountController.deleteAccount);

module.exports = router;