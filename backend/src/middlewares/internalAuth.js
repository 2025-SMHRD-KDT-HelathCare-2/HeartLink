module.exports = (req, res, next) => {
  if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SECRET) {
    return res.status(403).json({ message: '내부 인증 실패' });
  }
  next();
};
