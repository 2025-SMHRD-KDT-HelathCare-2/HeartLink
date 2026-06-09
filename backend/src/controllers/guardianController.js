const GuardianRelation = require('../models/GuardianRelation');

exports.getGuardians = async (req, res, next) => {
  try {
    const relations = await GuardianRelation.find({ user_id: req.user.id });
    res.json(relations);
  } catch (err) {
    next(err);
  }
};

exports.addGuardian = async (req, res, next) => {
  try {
    const count = await GuardianRelation.countDocuments({ user_id: req.user.id });
    if (count >= 3) return res.status(400).json({ message: '보호자는 최대 3인까지 등록 가능합니다.' });

    const relation = await GuardianRelation.create({ user_id: req.user.id, ...req.body });
    res.status(201).json(relation);
  } catch (err) {
    next(err);
  }
};

exports.updateRelation = async (req, res, next) => {
  try {
    const relation = await GuardianRelation.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      req.body,
      { new: true }
    );
    if (!relation) return res.status(404).json({ message: '없는 보호자 관계입니다.' });
    res.json(relation);
  } catch (err) {
    next(err);
  }
};

exports.deleteGuardian = async (req, res, next) => {
  try {
    await GuardianRelation.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    res.json({ message: '보호자 삭제 완료' });
  } catch (err) {
    next(err);
  }
};
