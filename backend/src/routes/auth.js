import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { registerRules, loginRules } from '../middlewares/authValidator.js';

const router = Router();

router.post('/register', registerRules, register);
router.post('/login',    loginRules,    login);

export default router;
