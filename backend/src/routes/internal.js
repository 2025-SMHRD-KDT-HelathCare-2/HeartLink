const router = require('express').Router();
const internalAuth = require('../middlewares/internalAuth');
const { notify } = require('../controllers/internalController');

router.post('/notify', internalAuth, notify);

module.exports = router;
