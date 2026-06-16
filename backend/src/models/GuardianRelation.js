import mongoose from 'mongoose';
const { Schema } = mongoose;

const guardianRelationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    guardianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    guardianName: { type: String, required: true, maxlength: 50 },
    guardianContact: { type: String, required: true, maxlength: 20 },
    guardianEmail: { type: String, maxlength: 100 },
    notifyPermission: { type: Boolean, required: true, default: true },
    relationStatus: {
      type: String,
      enum: ['pending', 'accepted'],
      required: true,
      default: 'pending',
    },
  },
  { timestamps: true }
);

guardianRelationSchema.index({ userId: 1 });
guardianRelationSchema.index({ guardianId: 1 });

export default mongoose.model('GuardianRelation', guardianRelationSchema);
