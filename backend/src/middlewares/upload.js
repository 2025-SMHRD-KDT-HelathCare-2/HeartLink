// [미들웨어] ECG 파일 업로드 처리 — multer 설정 (CSV/EDF/DAT 등, 최대 100MB)
import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['.wfdb', '.edf', '.csv', '.dat', '.hea'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('지원하지 않는 파일 형식입니다.'), false);
};

export default multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } });
