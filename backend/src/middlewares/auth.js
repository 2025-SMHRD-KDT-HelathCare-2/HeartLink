// [미들웨어] JWT 토큰 검증 — 로그인 여부 확인 (모든 인증 필요 라우터에 적용)
import jwt from 'jsonwebtoken';

export default (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '로그인이 필요한 서비스입니다. 로그인 후 이용해 주세요.' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '로그인이 필요한 서비스입니다. 로그인 후 이용해 주세요.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 'TOKEN_EXPIRED', message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' });
    }
    return res.status(401).json({ message: '로그인 정보가 올바르지 않습니다. 다시 로그인해 주세요.' });
  }
};
