const express = require('express');
const path = require('path');

const router = express.Router();
const roomsControler = require('../controllers/roomsController');

router.route('/')
.get(roomsControler.getRoomsbyFloor);

router.route('/orders/:room_id')
.get(roomsControler.getOrderedRooms)

router.route('/:room_id')
.get(roomsControler.getRoomBooked);



module.exports = router;