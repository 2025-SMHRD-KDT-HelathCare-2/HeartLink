import { Router } from 'express';
import {
  register, login, refreshToken, getToken, logout, getMe, updateMe,
  sendVerificationCode, verifyPhoneCode,
} from '../controllers/authController.js';
import { redirectToProvider, handleCallback } from '../controllers/socialController.js';
import { registerRules, loginRules } from '../middlewares/authValidator.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.post('/phone/send',         sendVerificationCode);
router.post('/phone/verify',       verifyPhoneCode);
router.post('/register',           registerRules, register);
router.post('/login',              loginRules,    login);
router.post('/token',                             getToken);
router.post('/refresh',                           refreshToken);
router.post('/logout',                            logout);
router.get('/me',                  auth,          getMe);
router.patch('/me',                auth,          updateMe);

// 소셜 로그인
router.get('/:provider',                          redirectToProvider);
router.get('/:provider/callback',                 handleCallback);

export default router;
