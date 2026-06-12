import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email:            { type: String, required: true, unique: true, maxlength: 100 },
    password:         { type: String, required: true, maxlength: 255 },
    nickname:         { type: String, required: true, maxlength: 50 },
    role:             { type: String, required: true, enum: ['user', 'guardian'] },
    age:              { type: Number },
    gender:           { type: String, enum: ['M', 'F'] },
    medical_history:  { type: [String], default: [] },
    medications:      { type: [String], default: [] },
    device_token:     { type: String, maxlength: 255 },
    refresh_token:    { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'users',
  }
);

userSchema.index({ role: 1 });

export default mongoose.model('User', userSchema);
