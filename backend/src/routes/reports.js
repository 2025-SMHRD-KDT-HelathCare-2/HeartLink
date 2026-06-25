import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
  getReportList,
  getReport,
  generateReport,
  generateGuardianReport,
  getTTS,
  getPatientReportList,
  getPatientReport,
  getGuardianReport,
  getGuardianTTS,
} from '../controllers/reportController.js';

const router = Router();

router.get('/',                              auth, getReportList);
router.post('/generate',                     auth, generateReport);
router.post('/generate-for/:userId',         auth, generateGuardianReport);
router.get('/patient/:userId',               auth, getPatientReportList);
router.get('/patient/:userId/:reportId',     auth, getPatientReport);
router.get('/guardian/:userId',              auth, getGuardianReport);
router.get('/guardian/:userId/tts',          auth, getGuardianTTS);
router.get('/:reportId',                     auth, getReport);
router.get('/:reportId/tts',                 auth, getTTS);

export default router;
