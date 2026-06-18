import { Router } from 'express';
import {
  register, login, refreshToken, getToken, logout, getMe, updateMe, deleteMe,
  sendVerificationCode, verifyPhoneCode,
  sendFindEmailCode, verifyFindEmailCode, findEmailByPhone,
  sendPasswordResetCode, verifyPasswordResetCode, resetPassword,
} from '../controllers/authController.js';
import { redirectToProvider, handleCallback, socialComplete } from '../controllers/socialController.js';
import { registerRules, loginRules } from '../middlewares/authValidator.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.post('/phone/send',              sendVerificationCode);
router.post('/phone/verify',            verifyPhoneCode);
router.post('/find-email/send',         sendFindEmailCode);
router.post('/find-email/verify',       verifyFindEmailCode);
router.post('/find-email',              findEmailByPhone);       // FindIdPage 전용
router.post('/password/reset-request',  sendPasswordResetCode);
router.post('/password/reset-verify',   verifyPasswordResetCode);
router.post('/password/verify-code',    verifyPasswordResetCode); // ForgotPasswordPage 전용
router.post('/password/reset',          resetPassword);
router.post('/register',           registerRules, register);
router.post('/login',              loginRules,    login);
router.post('/token',                             getToken);
router.post('/refresh',                           refreshToken);
router.post('/logout',                            logout);
router.get('/me',                  auth,          getMe);
router.patch('/me',                auth,          updateMe);
router.delete('/me',               auth,          deleteMe);

// 소셜 로그인
router.post('/social/complete',                   socialComplete);
router.get('/:provider',                          redirectToProvider);
router.get('/:provider/callback',                 handleCallback);

export default router;
