// [라우터] /api/notifications — 알림 목록 조회 및 읽음 처리
import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { getMyNotifications, getGuardianNotifications, markAsRead } from '../controllers/notificationController.js';

const router = Router();

router.get('/', auth, getMyNotifications);
router.get('/guardian', auth, getGuardianNotifications);
router.patch('/:id/read', auth, markAsRead);

export default router;
