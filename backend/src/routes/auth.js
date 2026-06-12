import { Router } from 'express';
import { register, login, refreshToken, logout } from '../controllers/authController.js';
import { registerRules, loginRules } from '../middlewares/authValidator.js';

const router = Router();

router.post('/register', registerRules, register);
router.post('/login',    loginRules,    login);
router.post('/refresh',                refreshToken);
router.post('/logout',                 logout);

export default router;
