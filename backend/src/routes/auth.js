const router = require('express').Router();
const { register, login } = require('../controllers/authController');
const { registerRules, loginRules } = require('../middlewares/authValidator');

// validator 미들웨어가 먼저 검증하고, 통과하면 controller로 넘어갑니다.
router.post('/register', registerRules, register);
router.post('/login',    loginRules,    login);

module.exports = router;