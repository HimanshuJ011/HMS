const express = require('express');
const path = require('path');

const router = express.Router();
const adminControler = require('../controllers/admin');

router.route('/home')
.get(adminControler.getHome);

module.exports = router;