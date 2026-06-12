import mongoose from 'mongoose';

const guardianRelationSchema = new mongoose.Schema(
  {
    user_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    guardian_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    guardian_name:    { type: String, required: true, maxlength: 50 },
    guardian_contact: { type: String, required: true, maxlength: 20 },
    guardian_email:   { type: String, maxlength: 100 },
    notify_permission: { type: Boolean, required: true, default: false },
    relation_status:  { type: String, required: true, enum: ['pending', 'accepted'], default: 'pending' },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'guardian_relations',
  }
);

guardianRelationSchema.index({ user_id: 1 });
guardianRelationSchema.index({ guardian_id: 1 });

export default mongoose.model('GuardianRelation', guardianRelationSchema);
