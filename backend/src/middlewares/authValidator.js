// src/middlewares/authValidator.js
const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array({ onlyFirstError: true })[0];
    return res.status(400).json({ message: firstError.msg });
  }
  next();
};

const registerRules = [
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

  body('age')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0, max: 150 }).withMessage('올바른 나이를 입력해 주세요.'),

  body('gender')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['M', 'F']).withMessage('성별을 올바르게 선택해 주세요.'),

  body('medical_history')
    .optional()
    .isArray().withMessage('기저질환 형식이 올바르지 않습니다.'),

  body('medications')
    .optional()
    .isArray().withMessage('복용약은 쉼표(,)로 구분해서 입력해 주세요.'),

  handleValidationErrors,
];

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('이메일 주소를 입력해 주세요.')
    .isEmail().withMessage('이메일 주소 형식이 올바르지 않습니다.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('비밀번호를 입력해 주세요.'),

  handleValidationErrors,
];

module.exports = { registerRules, loginRules };