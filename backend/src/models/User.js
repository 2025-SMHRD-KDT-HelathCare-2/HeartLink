const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  nickname: { type: String, required: true },
  role: { type: String, enum: ['user', 'guardian'], default: 'user' },
  age: Number,
  gender: String,
  medical_history: [String],
  medications: [String],
  device_token: String,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
