import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { profileUpdateSchema } from '../validators/social.js';

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.patch('/me', authenticate, validate({ body: profileUpdateSchema }), userController.updateMe);
router.get('/me/stats', authenticate, userController.myStats);
router.get('/me/achievements', authenticate, userController.myAchievements);
router.get('/me/ratings', authenticate, userController.myRatings);
router.get('/me/attempts', authenticate, userController.myAttempts);
router.get('/me/sessions', authenticate, userController.mySessions);
router.get('/me/avatar-upload', authenticate, userController.avatarUploadParams);

router.get('/:id', optionalAuthenticate, userController.getPublicProfile);

export default router;
