const router = require('express').Router();
const auth = require('../middlewares/auth');
const { getReport, generateReport, getReportList } = require('../controllers/reportController');

router.get('/', auth, getReportList);
router.get('/:analysisId', auth, getReport);
router.post('/:analysisId/generate', auth, generateReport);

module.exports = router;
