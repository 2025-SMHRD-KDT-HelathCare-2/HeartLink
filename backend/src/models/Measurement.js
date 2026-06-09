const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  file_name: String,
  file_ext: { type: String, enum: ['wfdb', 'edf', 'csv'] },
  file_size: Number,
  lead_type: String,
  sampling_rate: Number,
  ecg_waveform_lite: [Number],
  r_peaks: [Number],
  measured_at: Date,
}, { timestamps: true });

module.exports = mongoose.model('Measurement', measurementSchema);
