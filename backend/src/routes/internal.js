// [라우터] /api/internal — AI 서버 전용 내부 콜백 엔드포인트 (외부 접근 불가)
import { Router } from 'express';
import internalAuth from '../middlewares/internalAuth.js';
import { notify } from '../controllers/internalController.js';

const router = Router();

router.post('/notify', internalAuth, notify);

export default router;
