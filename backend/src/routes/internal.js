import { Router } from 'express';
import internalAuth from '../middlewares/internalAuth.js';
import { notify } from '../controllers/internalController.js';

const router = Router();

router.post('/notify', internalAuth, notify);

export default router;
