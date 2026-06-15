import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000;

function getAttemptInfo(key) {
  return loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
}

export const register = async (req, res, next) => {
  try {
    const { email, password, nickname, role, age, gender, medical_history, medications } = req.body;

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

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const clientKey = email;

    const attemptInfo = getAttemptInfo(clientKey);
    if (attemptInfo.lockedUntil > Date.now()) {
      const remainMin = Math.ceil((attemptInfo.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        message: `로그인 시도 횟수를 초과했습니다. ${remainMin}분 후에 다시 시도해 주세요.`,
      });
    }

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

      return res.status(401).json({
        message: `이메일 또는 비밀번호가 올바르지 않습니다. (남은 시도: ${remaining}회)`,
      });
    }

    loginAttempts.delete(clientKey);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30m' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '3d' }
    );

    await User.findByIdAndUpdate(user._id, { refresh_token: refreshToken });

    return res.json({
      message: `${user.nickname}님, 환영합니다!`,
      token,
      refreshToken,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
};

// Sliding window: 요청마다 새 AT + 새 RT 발급 (3일 창 갱신)
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: incomingRT } = req.body;

    if (!incomingRT) {
      return res.status(401).json({ message: '리프레시 토큰이 없습니다. 다시 로그인해 주세요.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(incomingRT, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.refresh_token !== incomingRT) {
      return res.status(401).json({ message: '유효하지 않은 세션입니다. 다시 로그인해 주세요.' });
    }

    const newToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30m' }
    );

    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '3d' }
    );

    await User.findByIdAndUpdate(user._id, { refresh_token: newRefreshToken });

    return res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refresh_token');
    if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const { medical_history, medications, phone } = req.body;
    const update = {};
    if (medical_history !== undefined) update.medical_history = medical_history;
    if (medications     !== undefined) update.medications     = medications;
    if (phone           !== undefined) update.phone           = phone;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true })
      .select('-password -refresh_token');
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const { refreshToken: incomingRT } = req.body;

    if (incomingRT) {
      const decoded = jwt.decode(incomingRT);
      if (decoded?.id) {
        await User.findByIdAndUpdate(decoded.id, { refresh_token: null });
      }
    }

    return res.json({ message: '로그아웃 되었습니다.' });
  } catch (err) {
    next(err);
  }
};
