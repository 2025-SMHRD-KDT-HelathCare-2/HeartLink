import mongoose from 'mongoose';

const { Schema } = mongoose;

const guardianRelationSchema = new Schema(
  {
    userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    guardianId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    guardianName:     { type: String },
    guardianContact:  { type: String },
    guardianEmail:    { type: String },
    notifyPermission: { type: Boolean, default: false },
    relationStatus:   { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

guardianRelationSchema.index({ userId: 1 });
guardianRelationSchema.index({ guardianId: 1 });

export default mongoose.model('GuardianRelation', guardianRelationSchema);
