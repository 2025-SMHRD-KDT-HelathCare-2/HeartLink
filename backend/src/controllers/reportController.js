const Report = require('../models/Report');
const AnalysisResult = require('../models/AnalysisResult');

exports.getReportList = async (req, res, next) => {
  try {
    const reports = await Report.find({ user_id: req.user.id }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    next(err);
  }
};

exports.getReport = async (req, res, next) => {
  try {
    const report = await Report.findOne({ analysis_id: req.params.analysisId, user_id: req.user.id });
    if (!report) return res.status(404).json({ message: '리포트가 없습니다.' });
    res.json(report);
  } catch (err) {
    next(err);
  }
};

exports.generateReport = async (req, res, next) => {
  try {
    const existing = await Report.findOne({ analysis_id: req.params.analysisId, user_id: req.user.id });
    if (existing) return res.json(existing);

    // TODO: AI 서버 또는 Gemini MCP 연동으로 리포트 생성
    res.status(501).json({ message: '리포트 생성 미구현' });
  } catch (err) {
    next(err);
  }
};
