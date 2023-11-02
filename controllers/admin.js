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
      console.log('Database connected sss');
    }
  });

exports.getHome = (req, res) => {
  if (req.session.username) {
    // The user is logged in, allow access to the admin home
    res.render('home');
  } else {
    // User is not logged in, redirect to login page or handle unauthorized access
    res.redirect('/admin/login'); // Redirect to the login page
  }
}