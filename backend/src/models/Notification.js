const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  analysis_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AnalysisResult' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guardian_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  risk_level: { type: String, enum: ['high', 'mid', 'low'] },
  channel: { type: String, enum: ['push', 'sms'] },
  message: String,
  send_status: { type: String, enum: ['success', 'fail'] },
  is_read: { type: Boolean, default: false },
  sent_at: Date,
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
