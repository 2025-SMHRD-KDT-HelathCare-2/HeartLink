import GuardianRelation from '../models/GuardianRelation.js';
import User from '../models/User.js';

export const getGuardians = async (req, res, next) => {
  try {
    const relations = await GuardianRelation.find({ user_id: req.user.id });
    res.json(relations);
  } catch (err) {
    next(err);
  }
};

export const addGuardian = async (req, res, next) => {
  try {
    const count = await GuardianRelation.countDocuments({ user_id: req.user.id });
    if (count >= 3) return res.status(400).json({ message: '보호자는 최대 3인까지 등록 가능합니다.' });

    const { guardian_email } = req.body;
    if (!guardian_email) return res.status(400).json({ message: '보호자 이메일을 입력해 주세요.' });

    const guardianUser = await User.findOne({ email: guardian_email, role: 'guardian' });
    if (!guardianUser) return res.status(404).json({ message: '해당 이메일의 보호자 계정을 찾을 수 없습니다.' });

    if (guardianUser._id.toString() === req.user.id) {
      return res.status(400).json({ message: '자기 자신을 보호자로 등록할 수 없습니다.' });
    }

    const existing = await GuardianRelation.findOne({ user_id: req.user.id, guardian_id: guardianUser._id });
    if (existing) return res.status(409).json({ message: '이미 등록 요청을 보낸 보호자입니다.' });

    const relation = await GuardianRelation.create({
      user_id: req.user.id,
      guardian_id: guardianUser._id,
      guardian_name: guardianUser.nickname,
      guardian_contact: guardianUser.email,
      guardian_email: guardianUser.email,
      notify_permission: false,
      relation_status: 'pending',
    });
    res.status(201).json(relation);
  } catch (err) {
    next(err);
  }
};

export const acceptRelation = async (req, res, next) => {
  try {
    const relation = await GuardianRelation.findOneAndUpdate(
      { _id: req.params.id, guardian_id: req.user.id, relation_status: 'pending' },
      { relation_status: 'accepted', notify_permission: true },
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
      $or: [{ user_id: req.user.id }, { guardian_id: req.user.id }],
    });
    if (!relation) return res.status(404).json({ message: '없는 보호자 관계입니다.' });
    res.json({ message: '보호자 관계가 해제되었습니다.' });
  } catch (err) {
    next(err);
  }
};

export const getPendingRequests = async (req, res, next) => {
  try {
    const requests = await GuardianRelation.find({
      guardian_id: req.user.id,
      relation_status: 'pending',
    }).populate('user_id', 'nickname email');
    res.json(requests);
  } catch (err) {
    next(err);
  }
};
