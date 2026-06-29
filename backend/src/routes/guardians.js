import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
  addGuardian,
  getGuardians,
  acceptRelation,
  rejectRelation,
  deleteGuardian,
  getPendingRequests,
  getSentRequests,
  getPatients,
  lookupUserByEmail,
} from '../controllers/guardianController.js';

const router = Router();

// 사용자(환자) 전용
router.get('/',              auth, getGuardians);       // 내 보호자 목록 (수락된 관계)
router.get('/requests',      auth, getPendingRequests); // 나에게 온 pending 요청 목록
router.patch('/:id/accept',  auth, acceptRelation);     // 요청 수락
router.patch('/:id/reject',  auth, rejectRelation);     // 요청 거절

// 보호자 전용
router.post('/',                           auth, addGuardian);           // 사용자에게 요청 보내기
router.get('/patients',                    auth, getPatients);           // 내 환자 목록 (수락된 관계)
router.get('/sent',                        auth, getSentRequests);       // 내가 보낸 요청 목록 (전체 상태)
router.get('/lookup',                      auth, lookupUserByEmail);     // 연동 전 이메일로 닉네임 확인

// 공통
router.delete('/:id',        auth, deleteGuardian);     // 관계 해제 (양쪽 FCM 알림)

export default router;
