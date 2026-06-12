import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { getNotifications, markAsRead } from '../controllers/notificationController.js';

const router = Router();

router.get('/', auth, getNotifications);
router.patch('/:id/read', auth, markAsRead);

export default router;
