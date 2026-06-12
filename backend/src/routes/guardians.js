import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
  addGuardian,
  getGuardians,
  acceptRelation,
  deleteGuardian,
  getPendingRequests,
} from '../controllers/guardianController.js';

const router = Router();

router.get('/', auth, getGuardians);
router.get('/requests', auth, getPendingRequests);
router.post('/', auth, addGuardian);
router.patch('/:id/accept', auth, acceptRelation);
router.delete('/:id', auth, deleteGuardian);

export default router;
