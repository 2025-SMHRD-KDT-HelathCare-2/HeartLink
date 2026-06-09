const router = require('express').Router();
const auth = require('../middlewares/auth');
const { addGuardian, getGuardians, updateRelation, deleteGuardian } = require('../controllers/guardianController');

router.get('/', auth, getGuardians);
router.post('/', auth, addGuardian);
router.patch('/:id', auth, updateRelation);
router.delete('/:id', auth, deleteGuardian);

module.exports = router;
