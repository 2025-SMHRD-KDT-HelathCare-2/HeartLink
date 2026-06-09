const mongoose = require('mongoose');

const guardianRelationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  guardian_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guardian_name: String,
  guardian_contact: String,
  guardian_email: String,
  notify_permission: { type: Boolean, default: true },
  relation_status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('GuardianRelation', guardianRelationSchema);
