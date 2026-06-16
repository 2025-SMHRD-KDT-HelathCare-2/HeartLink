import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PhoneVerification from '../models/PhoneVerification.js';
import { sendSMS } from '../services/smsService.js';

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000;

function getAttemptInfo(key) {
  return loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
}

export const sendVerificationCode = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: '전화번호를 입력해 주세요.' });

    const exists = await User.findOne({ phone });
    if (exists) return res.status(409).json({ message: '이미 가입된 전화번호입니다.' });

    const recent = await PhoneVerification.findOne({
      phone,
      purpose: 'signup',
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });
    if (recent) return res.status(429).json({ message: '1분 후 다시 요청해 주세요.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const hashed = await bcrypt.hash(code, 10);

    await PhoneVerification.create({
      phone,
      code: hashed,
      purpose: 'signup',
      verified: false,
      attemptCount: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendSMS({ to: phone, message: `[HeartLink] 인증번호: ${code} (5분 이내 입력)` });

    res.json({ message: '인증번호가 발송되었습니다.' });
  } catch (err) {
    next(err);
  }
};

export const verifyPhoneCode = async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: '전화번호와 인증번호를 입력해 주세요.' });

    const record = await PhoneVerification.findOne({
      phone,
      purpose: 'signup',
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) return res.status(400).json({ message: '인증번호가 만료되었습니다. 다시 요청해 주세요.' });

    if (record.attemptCount >= 5) {
      return res.status(400).json({ message: '인증 시도 횟수를 초과했습니다. 다시 요청해 주세요.' });
    }

    const match = await bcrypt.compare(code, record.code);
    if (!match) {
      await PhoneVerification.findByIdAndUpdate(record._id, { $inc: { attemptCount: 1 } });
      return res.status(400).json({ message: '인증번호가 올바르지 않습니다.' });
    }

    // 인증 성공 — 15분 유효하게 연장 (회원가입 완료할 시간)
    await PhoneVerification.findByIdAndUpdate(record._id, {
      verified: true,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    res.json({ message: '인증이 완료되었습니다.' });
  } catch (err) {
    next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const { email, password, nickname, role, age, gender, medical_history, medications, phone } = req.body;

    if (!phone) return res.status(400).json({ message: '전화번호 인증이 필요합니다.' });

    const verifiedRecord = await PhoneVerification.findOne({
      phone,
      purpose: 'signup',
      verified: true,
      expiresAt: { $gt: new Date() },
    });
    if (!verifiedRecord) {
      return res.status(400).json({ message: '전화번호 인증을 먼저 완료해 주세요.' });
    }

    const hashed = await bcrypt.hash(password, 12);

    await User.create({
      email,
      password: hashed,
      nickname,
      role,
      phone,
      phoneVerified: true,
      ...(age    !== undefined && { age }),
      ...(gender !== undefined && { gender }),
      medicalHistory: medical_history ?? [],
      medications:    medications     ?? [],
    });

    // 사용한 인증 레코드 삭제
    await PhoneVerification.findByIdAndDelete(verifiedRecord._id);

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

    await User.findByIdAndUpdate(user._id, { refreshToken });

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
    if (!user || user.refreshToken !== incomingRT) {
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

    await User.findByIdAndUpdate(user._id, { refreshToken: newRefreshToken });

    return res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshToken');
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
    if (medical_history !== undefined) update.medicalHistory = medical_history;
    if (medications     !== undefined) update.medications    = medications;
    if (phone           !== undefined) update.phone          = phone;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true })
      .select('-password -refreshToken');
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
        await User.findByIdAndUpdate(decoded.id, { refreshToken: null });
      }
    }

    return res.json({ message: '로그아웃 되었습니다.' });
  } catch (err) {
    next(err);
  }
};
