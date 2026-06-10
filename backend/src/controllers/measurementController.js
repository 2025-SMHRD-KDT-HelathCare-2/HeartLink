const Measurement = require('../models/Measurement');
const aiService = require('../services/aiService');

exports.uploadECG = async (req, res, next) => {
  try {
    const { measured_at } = req.body;
    const file = req.file;

    const measurement = await Measurement.create({
      user_id: req.user.id,
      file_name: file.originalname,
      file_ext: file.originalname.split('.').pop().toUpperCase(),
      file_size: file.size,
      status: 'processing',
      measured_at: measured_at || new Date(),
    });

    // Fire-and-forget: FastAPI에 전송 후 응답 안 기다림
    aiService.analyze({
      fileBuffer: file.buffer,
      fileName: file.originalname,
      measurementId: measurement._id,
      userId: req.user.id,
    }).catch(err => {
      console.error('FastAPI 전송 실패:', err.message);
      Measurement.findByIdAndUpdate(measurement._id, { status: 'failed' }).catch(() => {});
    });

    res.status(201).json({ measurementId: measurement._id, status: 'processing' });
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
