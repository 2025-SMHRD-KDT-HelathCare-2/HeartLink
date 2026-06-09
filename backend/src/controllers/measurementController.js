const Measurement = require('../models/Measurement');
const aiService = require('../services/aiService');

exports.uploadECG = async (req, res, next) => {
  try {
    const { measured_at } = req.body;
    const file = req.file;

    const aiResult = await aiService.analyze({
      fileBuffer: file.buffer,
      fileName: file.originalname,
      userId: req.user.id,
    });

    const measurement = await Measurement.create({
      user_id: req.user.id,
      file_name: file.originalname,
      file_ext: file.originalname.split('.').pop(),
      file_size: file.size,
      lead_type: aiResult.lead_type,
      sampling_rate: aiResult.sampling_rate,
      ecg_waveform_lite: aiResult.ecg_waveform_lite,
      r_peaks: aiResult.r_peaks,
      measured_at: measured_at || new Date(),
    });

    res.status(201).json({ measurementId: measurement._id, waveform: aiResult.ecg_waveform_lite, r_peaks: aiResult.r_peaks });
  } catch (err) {
    next(err);
  }
};

exports.getMeasurements = async (req, res, next) => {
  try {
    const measurements = await Measurement.find({ user_id: req.user.id }).sort({ measured_at: -1 });
    res.json(measurements);
  } catch (err) {
    next(err);
  }
};

exports.getMeasurement = async (req, res, next) => {
  try {
    const measurement = await Measurement.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!measurement) return res.status(404).json({ message: '없는 측정 데이터입니다.' });
    res.json(measurement);
  } catch (err) {
    next(err);
  }
};
