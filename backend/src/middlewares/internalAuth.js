// [미들웨어] 내부 서버 전용 인증 — AI 서버 콜백 요청 시 x-internal-secret 헤더 검증
export default (req, res, next) => {
  if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SECRET) {
    return res.status(403).json({ message: '내부 인증 실패' });
  }
  next();
};
