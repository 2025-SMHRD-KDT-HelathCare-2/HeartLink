// [컨트롤러] 알림 — 사용자/보호자 알림 목록 조회(최근 7일), 읽음 처리
import Notification from '../models/Notification.js';
import GuardianRelation from '../models/GuardianRelation.js';

const LEVEL_MAP = { high: '상', mid: '중', low: '하' };
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

// 사용자 본인 알림 (최근 7일)
export const getMyNotifications = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - SEVEN_DAYS);
    const notifications = await Notification.find({
      userId: req.user.id,
      sentAt: { $gte: since },
    }).sort({ sentAt: -1 });

    res.json(notifications.map(n => ({
      id:        n._id,
      level:     LEVEL_MAP[n.riskLevel] ?? '하',
      message:   n.message,
      createdAt: n.sentAt,
      isRead:    n.isRead,
    })));
  } catch (err) {
    next(err);
  }
};

// 보호자 알림 — 연동된 모든 사용자를 기준으로 조회 (알림 없어도 항상 포함)
export const getGuardianNotifications = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - SEVEN_DAYS);

    const relations = await GuardianRelation.find({
      guardianId: req.user.id,
      relationStatus: 'accepted',
    }).populate('userId', 'nickname');

    const result = await Promise.all(
      relations.map(async (rel) => {
        const user = rel.userId;
        const notifications = await Notification.find({
          guardianId: req.user.id,
          userId: user._id,
          sentAt: { $gte: since },
        }).sort({ sentAt: -1 });

        return {
          userId:        user._id,
          memberName:    user.nickname ?? '',
          notifications: notifications.map(n => ({
            id:        n._id,
            level:     LEVEL_MAP[n.riskLevel] ?? '하',
            message:   n.message,
            createdAt: n.sentAt,
            isRead:    n.isRead,
          })),
        };
      })
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [{ userId: req.user.id }, { guardianId: req.user.id }],
      },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: '알림을 찾을 수 없습니다.' });
    res.json({ message: '읽음 처리 완료' });
  } catch (err) {
    next(err);
  }
};
