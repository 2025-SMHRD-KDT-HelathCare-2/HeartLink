// [미들웨어] 회원가입·로그인 입력값 유효성 검사 규칙 (express-validator)
import { body, validationResult } from 'express-validator';

// 검증(유효성 검사) 결과를 확인해서, 문제가 있으면 첫 번째 오류 메시지를 응답으로 돌려줍니다.
//  - 여러 오류가 있어도 사용자가 헷갈리지 않게 "맨 처음 걸린 오류" 하나만 보여줍니다.
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array({ onlyFirstError: true })[0];
    return res.status(400).json({ message: firstError.msg });
  }
  next();
};

// 회원가입 요청을 검사하는 규칙 모음입니다.
//  - 아래 규칙들을 순서대로 통과해야 register 컨트롤러가 실행됩니다.
export const registerRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('이메일 주소를 입력해 주세요.')
    .isEmail().withMessage('이메일 주소 형식이 올바르지 않습니다. 예) heartlink@email.com')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('비밀번호를 입력해 주세요.')
    .isLength({ min: 8 }).withMessage('비밀번호는 8자리 이상이어야 합니다.')
    .matches(/[A-Za-z]/).withMessage('비밀번호에 영문자를 최소 1개 포함해 주세요.')
    .matches(/[0-9]/).withMessage('비밀번호에 숫자를 최소 1개 포함해 주세요.'),

  body('nickname')
    .trim()
    .notEmpty().withMessage('닉네임을 입력해 주세요.')
    .isLength({ min: 2 }).withMessage('닉네임은 2자 이상 입력해 주세요.')
    .matches(/^[가-힣a-zA-Z0-9 ]+$/).withMessage('닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.'),

  body('role')
    .notEmpty().withMessage('회원 유형을 선택해 주세요.')
    .isIn(['user', 'guardian']).withMessage('회원 유형을 올바르게 선택해 주세요.'),

  // [변경] 예전 'age'(나이) 검증을 'birthDate'(생년월일) 검증으로 교체했습니다.
  //   - optional: 생년월일은 '선택' 항목이라 안 보내도 통과합니다.
  //     (checkFalsy: 빈 문자열 ""도 "없는 값"으로 취급해 통과시킵니다.)
  //   - isISO8601: "YYYY-MM-DD" 같은 표준 날짜 형식인지 검사합니다.
  //   - toDate: 통과하면 문자열을 실제 Date 객체로 변환해 줍니다.
  //   * 만 나이는 서버(User 모델)에서 birthDate로 자동 계산하므로
  //     나이를 직접 받지 않습니다.
  body('birthDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('생년월일 형식이 올바르지 않습니다.')
    .toDate(),

  body('gender')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['M', 'F']).withMessage('성별을 올바르게 선택해 주세요.'),

  body('medical_history')
    .optional()
    .isArray().withMessage('기저질환 형식이 올바르지 않습니다.'),

  // [삭제] medications(복용 약) 검증 규칙은 기능이 사라져 제거했습니다.

  handleValidationErrors,
];

// 로그인 요청을 검사하는 규칙 모음입니다. (이번 변경과 무관 — 그대로 유지)
export const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('이메일 주소를 입력해 주세요.')
    .isEmail().withMessage('이메일 주소 형식이 올바르지 않습니다.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('비밀번호를 입력해 주세요.'),

  handleValidationErrors,
];
