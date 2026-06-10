// src/middlewares/errorHandler.js
module.exports = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(err.stack);

  // Mongoose: 필드 유효성 검사 오류
  if (err.name === 'ValidationError') {
    const firstPath = Object.values(err.errors)[0]?.path;
    const fieldName = mongoFieldToKorean(firstPath);
    return res.status(400).json({
      message: `${fieldName} 입력값을 다시 확인해 주세요.`,
    });
  }

  // MongoDB: 중복 키 오류
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    if (field === 'email') {
      return res.status(409).json({
        message: '이미 가입된 이메일 주소입니다. 다른 이메일을 사용해 주세요.',
      });
    }
    return res.status(409).json({
      message: '이미 사용 중인 정보입니다. 다시 확인해 주세요.',
    });
  }

  // Mongoose: ObjectId 형식 오류
  if (err.name === 'CastError') {
    return res.status(400).json({
      message: '잘못된 요청입니다. 처음 화면으로 돌아가 다시 시도해 주세요.',
    });
  }

  // JWT: 토큰 위조 또는 잘못된 서명
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: '로그인 정보가 올바르지 않습니다. 다시 로그인해 주세요.',
    });
  }

  // JWT: 토큰 만료
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
    });
  }

  // 요청 본문 JSON 파싱 오류
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      message: '요청 형식이 올바르지 않습니다. 다시 시도해 주세요.',
    });
  }

  // 파일 업로드 크기 초과 (multer)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: '파일 크기가 너무 큽니다. 더 작은 파일을 업로드해 주세요.',
    });
  }

  // 개발자가 직접 status를 설정한 에러
  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      message: err.message || '요청을 처리할 수 없습니다.',
    });
  }

  // 그 외 서버 내부 오류 — err.message 절대 노출 금지 (보안)
  return res.status(500).json({
    message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  });
};

function mongoFieldToKorean(field) {
  const map = {
    email:           '이메일 주소',
    password:        '비밀번호',
    nickname:        '닉네임',
    role:            '회원 유형',
    age:             '나이',
    gender:          '성별',
    medical_history: '기저질환',
    medications:     '복용약',
  };
  return map[field] || '입력 정보';
}