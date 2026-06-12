export default (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    const firstPath = Object.values(err.errors)[0]?.path;
    const fieldName = mongoFieldToKorean(firstPath);
    return res.status(400).json({ message: `${fieldName} 입력값을 다시 확인해 주세요.` });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    if (field === 'email') {
      return res.status(409).json({ message: '이미 가입된 이메일 주소입니다. 다른 이메일을 사용해 주세요.' });
    }
    return res.status(409).json({ message: '이미 사용 중인 정보입니다. 다시 확인해 주세요.' });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: '잘못된 요청입니다. 처음 화면으로 돌아가 다시 시도해 주세요.' });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: '로그인 정보가 올바르지 않습니다. 다시 로그인해 주세요.' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: '요청 형식이 올바르지 않습니다. 다시 시도해 주세요.' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: '파일 크기가 너무 큽니다. 더 작은 파일을 업로드해 주세요.' });
  }

  if (err.status && err.status < 500) {
    return res.status(err.status).json({ message: err.message || '요청을 처리할 수 없습니다.' });
  }

  return res.status(500).json({ message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
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
