import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { getMyNotifications, getGuardianNotifications, markAsRead } from '../controllers/notificationController.js';

const router = Router();

router.get('/', auth, getMyNotifications);
router.get('/guardian', auth, getGuardianNotifications);
router.patch('/:id/read', auth, markAsRead);

export default router;
