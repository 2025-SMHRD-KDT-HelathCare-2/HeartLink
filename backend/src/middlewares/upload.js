const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['.wfdb', '.edf', '.csv', '.dat', '.hea'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('지원하지 않는 파일 형식입니다.'), false);
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });
