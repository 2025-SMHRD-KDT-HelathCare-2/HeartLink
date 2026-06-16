import Notification from '../models/Notification.js';

export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ guardianId: req.user.id }).sort({ sentAt: -1 });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, guardianId: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: '알림을 찾을 수 없습니다.' });
    res.json({ message: '읽음 처리 완료' });
  } catch (err) {
    next(err);
  }
};
