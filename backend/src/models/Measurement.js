import mongoose from 'mongoose';
const { Schema } = mongoose;

const measurementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true, maxlength: 255 },
    fileExt: { type: String, enum: ['WFDB', 'EDF', 'CSV'], required: true },
    fileSize: { type: Number, required: true },
    leadType: { type: String, maxlength: 20 },
    samplingRate: { type: Number },
    ecgWaveformLite: { type: [Number], default: [] },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    rPeaks: { type: [Number], default: [] },
    measuredAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

measurementSchema.index({ userId: 1, measuredAt: -1 });

export default mongoose.model('Measurement', measurementSchema);
