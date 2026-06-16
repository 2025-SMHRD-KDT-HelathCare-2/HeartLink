import GuardianRelation from '../models/GuardianRelation.js';
import User from '../models/User.js';
import Measurement from '../models/Measurement.js';
import AnalysisResult from '../models/AnalysisResult.js';

export const getGuardians = async (req, res, next) => {
  try {
    const relations = await GuardianRelation.find({ userId: req.user.id });
    res.json(relations);
  } catch (err) {
    next(err);
  }
};

// 보호자가 사용자(환자)에게 요청을 보냄
export const addGuardian = async (req, res, next) => {
  try {
    const { user_email } = req.body;
    if (!user_email) return res.status(400).json({ message: '사용자 이메일을 입력해 주세요.' });

    const patientUser = await User.findOne({ email: user_email.toLowerCase().trim(), role: 'user' });
    if (!patientUser) return res.status(404).json({ message: '해당 이메일의 사용자 계정을 찾을 수 없습니다.' });

    if (patientUser._id.toString() === req.user.id) {
      return res.status(400).json({ message: '자기 자신에게 요청을 보낼 수 없습니다.' });
    }

    const count = await GuardianRelation.countDocuments({ userId: patientUser._id });
    if (count >= 3) return res.status(400).json({ message: '해당 사용자는 이미 보호자가 3인 등록되어 있습니다.' });

    const existing = await GuardianRelation.findOne({ userId: patientUser._id, guardianId: req.user.id });
    if (existing) return res.status(409).json({ message: '이미 등록 요청을 보낸 사용자입니다.' });

    const guardian = await User.findById(req.user.id).select('nickname email phone');

    const relation = await GuardianRelation.create({
      userId: patientUser._id,
      guardianId: req.user.id,
      guardianName: guardian.nickname,
      guardianContact: guardian.phone,
      guardianEmail: guardian.email,
      notifyPermission: false,
      relationStatus: 'pending',
    });
    res.status(201).json(relation);
  } catch (err) {
    next(err);
  }
};

// 사용자(환자)가 보호자 요청을 수락
export const acceptRelation = async (req, res, next) => {
  try {
    const relation = await GuardianRelation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, relationStatus: 'pending' },
      { relationStatus: 'accepted', notifyPermission: true },
      { new: true }
    );
    if (!relation) return res.status(404).json({ message: '수락할 보호자 요청이 없습니다.' });
    res.json(relation);
  } catch (err) {
    next(err);
  }
};

export const deleteGuardian = async (req, res, next) => {
  try {
    const relation = await GuardianRelation.findOneAndDelete({
      _id: req.params.id,
      $or: [{ userId: req.user.id }, { guardianId: req.user.id }],
    });
    if (!relation) return res.status(404).json({ message: '없는 보호자 관계입니다.' });
    res.json({ message: '보호자 관계가 해제되었습니다.' });
  } catch (err) {
    next(err);
  }
};

// 보호자 입장에서 수락된 환자 목록 + 최신 측정/위험도 조회
export const getPatients = async (req, res, next) => {
  try {
    const relations = await GuardianRelation.find({
      guardianId: req.user.id,
      relationStatus: 'accepted',
    }).populate('userId', 'nickname age gender');

    const patients = await Promise.all(
      relations.map(async rel => {
        const user = rel.userId;
        const latest = await Measurement.findOne({ userId: user._id, status: 'completed' })
          .sort({ measuredAt: -1 });

        let analysis = null;
        if (latest) {
          analysis = await AnalysisResult.findOne({ measurementId: latest._id });
        }

        return {
          relation_id: rel._id,
          user_id: user._id,
          nickname: user.nickname,
          age: user.age,
          gender: user.gender,
          latest_measured_at: latest?.measuredAt ?? null,
          risk_score: analysis?.riskScore ?? null,
          risk_level: analysis?.riskLevel ?? null,
        };
      })
    );

    res.json(patients);
  } catch (err) {
    next(err);
  }
};

// 사용자(환자)가 자신에게 온 보호자 요청 목록 조회
export const getPendingRequests = async (req, res, next) => {
  try {
    const requests = await GuardianRelation.find({
      userId: req.user.id,
      relationStatus: 'pending',
    }).populate('guardianId', 'nickname email');
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

// 사용자(환자)가 보호자 요청을 거절
export const rejectRelation = async (req, res, next) => {
  try {
    const relation = await GuardianRelation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, relationStatus: 'pending' },
      { relationStatus: 'rejected' },
      { new: true }
    );
    if (!relation) return res.status(404).json({ message: '거절할 보호자 요청이 없습니다.' });
    res.json(relation);
  } catch (err) {
    next(err);
  }
};

// 보호자가 자신이 보낸 요청 목록 조회 (전체 상태)
export const getSentRequests = async (req, res, next) => {
  try {
    const requests = await GuardianRelation.find({ guardianId: req.user.id })
      .populate('userId', 'nickname email');
    res.json(requests);
  } catch (err) {
    next(err);
  }
};
