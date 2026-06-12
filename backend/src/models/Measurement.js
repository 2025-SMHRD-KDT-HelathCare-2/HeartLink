import mongoose from 'mongoose';

const measurementSchema = new mongoose.Schema(
  {
    user_id:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    file_name:         { type: String, required: true, maxlength: 255 },
    file_ext:          { type: String, required: true, enum: ['WFDB', 'EDF', 'CSV'] },
    file_size:         { type: Number, required: true },
    lead_type:         { type: String, maxlength: 10 },
    sampling_rate:     { type: Number },
    ecg_waveform_lite: { type: [Number], default: [] },
    r_peaks:           { type: [Number], default: [] },
    measured_at:       { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'measurements',
  }
);

measurementSchema.index({ user_id: 1, measured_at: -1 });

export default mongoose.model('Measurement', measurementSchema);
