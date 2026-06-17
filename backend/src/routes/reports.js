import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
  getReportList,
  getReport,
  generateReport,
  getTTS,
  getPatientReportList,
  getPatientReport,
  getGuardianReport,
  getGuardianTTS,
} from '../controllers/reportController.js';

const router = Router();

router.get('/', auth, getReportList);
router.get('/patient/:userId', auth, getPatientReportList);
router.get('/patient/:userId/:analysisId', auth, getPatientReport);
router.get('/guardian/:userId', auth, getGuardianReport);
router.get('/guardian/:userId/tts', auth, getGuardianTTS);
router.get('/:analysisId', auth, getReport);
router.get('/:analysisId/tts', auth, getTTS);
router.post('/:analysisId/generate', auth, generateReport);

export default router;
