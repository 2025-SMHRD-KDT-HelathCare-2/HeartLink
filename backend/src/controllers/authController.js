const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 로그인 실패 횟수 추적
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000; // 10분

function getAttemptInfo(key) {
  return loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
}

exports.register = async (req, res, next) => {
  try {
    const { email, password, nickname, role, age, gender, medical_history, medications } = req.body;
    // 입력값 검증은 authValidator 미들웨어에서 이미 처리됨

    const hashed = await bcrypt.hash(password, 12);

    await User.create({
      email,
      password: hashed,
      nickname,
      role,
      ...(age    !== undefined && { age }),
      ...(gender !== undefined && { gender }),
      medical_history: medical_history ?? [],
      medications:     medications     ?? [],
    });

    return res.status(201).json({
      message: '회원가입이 완료되었습니다! 로그인 화면에서 로그인해 주세요.',
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: '이미 가입된 이메일 주소입니다. 다른 이메일을 사용해 주세요.',
      });
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    // authValidator의 normalizeEmail()이 적용된 email 사용
    const clientKey = email;

    // 1) 잠금 여부 확인
    const attemptInfo = getAttemptInfo(clientKey);
    if (attemptInfo.lockedUntil > Date.now()) {
      const remainMin = Math.ceil((attemptInfo.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        message: `로그인 시도 횟수를 초과했습니다. ${remainMin}분 후에 다시 시도해 주세요.`,
      });
    }

    // 2) 사용자 조회 + 비밀번호 확인
    const user = await User.findOne({ email: clientKey });
    const isMatch = user && (await bcrypt.compare(password, user.password));

    if (!isMatch) {
      attemptInfo.count += 1;

      if (attemptInfo.count >= MAX_ATTEMPTS) {
        attemptInfo.lockedUntil = Date.now() + LOCK_DURATION_MS;
        attemptInfo.count = 0;
        loginAttempts.set(clientKey, attemptInfo);
        return res.status(429).json({
          message: `로그인을 ${MAX_ATTEMPTS}회 실패하였습니다. 보안을 위해 10분 후에 다시 시도해 주세요.`,
        });
      }

      loginAttempts.set(clientKey, attemptInfo);
      const remaining = MAX_ATTEMPTS - attemptInfo.count;

      // 보안 원칙: 이메일/비밀번호 중 어느 쪽이 틀렸는지 구분하지 않습니다.
      return res.status(401).json({
        message: `이메일 또는 비밀번호가 올바르지 않습니다. (남은 시도: ${remaining}회)`,
      });
    }

    // 3) 성공 → 실패 기록 초기화
    loginAttempts.delete(clientKey);

    // 4) JWT 발급
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
    );

    return res.json({
      message: `${user.nickname}님, 환영합니다!`,
      token,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
};