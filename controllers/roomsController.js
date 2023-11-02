var mysql = require('mysql');


const db =  mysql.createConnection({
    host: 'hoteldb-1.cjhvgiah3e0n.us-east-1.rds.amazonaws.com',
    user: 'admin',
    password: '7raysadmindb',
    database: 'testhotel',
  });
  db.connect((err) => {
    if (err) {
      console.error('Database connection error: ' + err.message);
    } else {
      console.log('Database connected');
    }
  });


exports.getRoomsbyFloor = (req, res) => {
  const floorsQuery = 'SELECT * FROM Floors';

  db.query(floorsQuery, (err, floors) => {
    if (err) {
      console.error('Database query error: ' + err.message);
      res.status(500).send('Internal Server Error');
    } else {
      // Iterate through floors and fetch rooms for each floor
      const roomsByFloor = [];
      const fetchRooms = (floorIndex) => {
        if (floorIndex >= floors.length) {
          // All floors processed, render the template
          // console.log(roomsByFloor[0]);
          res.render('rooms', { roomsByFloor });
        } else {
          const floor = floors[floorIndex];
          // Query the database to get rooms for the current floor
          const roomsQuery = `
          SELECT Rooms.*, Room_Type.*
          FROM Rooms
          JOIN Room_Type ON Rooms.room_type = Room_Type.room_type
          WHERE Rooms.floor_id = ${floor.floor_id}
          `;
          db.query(roomsQuery, (err, rooms) => {
            if (err) {
              console.error('Database query error: ' + err.message);
              res.status(500).send('Internal Server Error');
            } else {
              roomsByFloor.push({ floor, rooms });
              fetchRooms(floorIndex + 1);
            }
          });
        }
      };

      fetchRooms(0); // Start fetching rooms for the first floor
    }
  });
}

exports.getOrderedRooms = (req, res) => {
  db.connect((err) => {
    if (err) {
      console.error('Database connection error: ' + err.message);
    } else {
      console.log('Database connected getfb');
    }
  });
  const roomID = req.params.room_id;

  const query = `SELECT price_per_night FROM Rooms where room_id = '${roomID}'`
  db.query(query , (err, price)=>{
    if (err) {
      console.error(err);
      return res.status(500).send('Internal Server Error');
  }else{
    res.render('booking', { data: price[0].price_per_night, roomID : roomID });
  }
  });
}

exports.getRoomBooked = (req, res) => {
  const roomID = req.params.room_id;

  const roomQuery = `SELECT * FROM Rooms WHERE room_id = ${roomID}`;
  db.query(roomQuery, (err, room) => {
    if (err) {
      throw err;
    }
    const bookingQuery = `
        SELECT Rooms.*, Bookings.*, Guest.*
        FROM Rooms
        LEFT JOIN Bookings ON Rooms.room_id = Bookings.room_id
        LEFT JOIN Guest ON Bookings.guest_id = Guest.guest_id
        WHERE Rooms.room_id = ${roomID} AND Bookings.status = 'booked'` ;

    db.query(bookingQuery, (err, booking) => {
      if (err) {
        throw err;
      }
      // console.log(booking);
      res.render('bookingById', { booking });
    });
  });
}

