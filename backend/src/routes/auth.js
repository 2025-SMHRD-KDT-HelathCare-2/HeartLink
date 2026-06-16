import { Router } from 'express';
import {
  register, login, refreshToken, logout, getMe, updateMe,
  sendVerificationCode, verifyPhoneCode,
} from '../controllers/authController.js';
import { registerRules, loginRules } from '../middlewares/authValidator.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.post('/phone/send',   sendVerificationCode);
router.post('/phone/verify', verifyPhoneCode);
router.post('/register',     registerRules, register);
router.post('/login',        loginRules,    login);
router.post('/refresh',                     refreshToken);
router.post('/logout',                      logout);
router.get('/me',            auth,           getMe);
router.patch('/me',          auth,           updateMe);

export default router;
