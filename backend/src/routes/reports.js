import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
  getReportList,
  getReport,
  generateReport,
  getPatientReportList,
  getPatientReport,
} from '../controllers/reportController.js';

const router = Router();

router.get('/', auth, getReportList);
router.get('/patient/:userId', auth, getPatientReportList);
router.get('/patient/:userId/:analysisId', auth, getPatientReport);
router.get('/:analysisId', auth, getReport);
router.post('/:analysisId/generate', auth, generateReport);

export default router;
