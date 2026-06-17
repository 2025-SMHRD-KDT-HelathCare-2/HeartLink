import Notification from '../models/Notification.js';

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

// 보호자 알림 (연결된 사용자들의 알림)
export const getGuardianNotifications = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - SEVEN_DAYS);
    const notifications = await Notification.find({
      guardianId: req.user.id,
      sentAt: { $gte: since },
    })
      .populate('userId', 'nickname')
      .sort({ sentAt: -1 });

    res.json(notifications.map(n => ({
      id:         n._id,
      level:      LEVEL_MAP[n.riskLevel] ?? '하',
      message:    n.message,
      createdAt:  n.sentAt,
      isRead:     n.isRead,
      memberName: n.userId?.nickname ?? '',
    })));
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: '알림을 찾을 수 없습니다.' });
    res.json({ message: '읽음 처리 완료' });
  } catch (err) {
    next(err);
  }
};
