const router = require('express').Router();
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { uploadECG, getMeasurements, getMeasurement } = require('../controllers/measurementController');

router.post('/', auth, upload.single('ecg_file'), uploadECG);
router.get('/', auth, getMeasurements);
router.get('/:id', auth, getMeasurement);

module.exports = router;
