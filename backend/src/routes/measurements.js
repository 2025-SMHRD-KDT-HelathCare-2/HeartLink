import { Router } from 'express';
import auth from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import {
  uploadECG,
  getMeasurements,
  getMeasurement,
  getPatientMeasurements,
  getPatientMeasurement,
} from '../controllers/measurementController.js';

const router = Router();

router.post('/', auth, upload.single('ecg_file'), uploadECG);
router.get('/', auth, getMeasurements);
router.get('/patient/:userId', auth, getPatientMeasurements);
router.get('/patient/:userId/:id', auth, getPatientMeasurement);
router.get('/:id', auth, getMeasurement);

export default router;
