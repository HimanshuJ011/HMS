const express =  require('express');
const path    =  require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql');
const ejs = require('ejs');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('invoice.pdf'));
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');



const app = express();

app.use(
  session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
  })
);

const db =  mysql.createConnection({
    host: 'hotel-db.cjhvgiah3e0n.us-east-1.rds.amazonaws.com',
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

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '/public')));

app.set('view engine', 'ejs');
app.set('views', 'views');
app.set('views', path.join(__dirname, 'views'));

// Login 
app.get('/admin', (req, res)=>{
  res.render('login', { msg: "", err: "" }); 
});

app.post('/admin', (req, res) =>{
  const { username, password } = req.body;
  console.log(username, password);

  const sql = 'SELECT * FROM admin WHERE username = ? AND password = ?';
  db.query(sql, [username, password], (err, results) => {
    if (err) {
      console.error('Database error: ' + err);
      res.status(500).json({ error: 'An error occurred while processing your request.' });
    } else if (results.length === 1) {
      req.session.username = username;
      res.redirect('/admin/home');
    } else {
      res.render('login', { msg: "", err: "Invalid User" }); 
    }
  });

});

app.get('/admin/logout', (req, res) => {
  // Destroy the user's session to log them out
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session: ' + err);
    }
    // Redirect the user to the login page after logout
    res.redirect('/admin');
  });
});

// logout



const adminRouter = require('./routes/admin');
const roomsRouter = require('./routes/rooms');

app.use("/admin",adminRouter);
app.use("/admin/rooms",roomsRouter);


// app.get('/home', (req, res)=>{
//     res.render('home');  
// });

// book ROOm

app.post('/admin/rooms/orders/:room_id', (req, res)=>{
  const { firstName,lastName, dob, gender, email,phone,addresss,city,country,postcode,room_id,checkin,checkout,
    payment_method,
    payment_status,
    room_price
    
  } = req.body;  
  const db =  mysql.createConnection({
    host: 'hotel-db.cjhvgiah3e0n.us-east-1.rds.amazonaws.com',
    user: 'admin',
    password: '7raysadmindb',
    database: 'testhotel',
  });
  // Create a single connection for the entire transaction
  db.connect((err) => {
    if (err) {
      console.error('Database connection failed:', err);
      return res.status(500).json({ error: 'Database connection failed' });
    }
    
    // Begin a transaction
    db.beginTransaction((err) => {
      if (err) {
        console.error('Transaction begin failed:', err);
        db.end();
        return res.status(500).json({ error: 'Transaction begin failed' });
      }

      // Step 1: Insert user data into the Guest table
      const user = {
        firstName,
        lastName,
        dob,
        gender,
        email,
        phone,
        addresss ,
        city,
        country,
        postcode
      };

      db.query('INSERT INTO Guest SET ?', user, (err, result) => {
        if (err) {
          console.error('Error inserting user:', err);
          return db.rollback(() => {
            db.end();
            res.status(500).json({ error: 'Failed to insert user' });
          });
        }

        const guest_id = result.insertId;
         // Get the auto-generated guest_id
    
        // Step 2: Insert booking data into the Booking table
        const booking = {
          guest_id,
          room_id,
          booking_date: new Date(),
          check_in_date: checkin,
          check_out_date: checkout,
          status : 'booked'
        };

        db.query('INSERT INTO Bookings SET ?', booking, (err, results) => {
          if (err) {
            console.error('Error inserting booking:', err);
            return db.rollback(() => {
              db.end();
              res.status(500).json({ error: 'Failed to insert booking' });
            });
          } 

          const booking_id = results.insertId;
          console.log("booking ID "+booking_id);

          const Days = Math.round((new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24));
          const totalAmount = Days*room_price;

          const invoice = {
            booking_id,
            guest_id,
            invoice_date: new Date(),
            total_amount: totalAmount,
            payment_method,
            status: payment_status,
          };
          
          db.query('INSERT INTO Invoices SET ?', invoice, (err) => {
            if (err) {
              console.error('Error inserting invoice:', err);
              return db.rollback(() => {
                db.end();
                res.status(500).json({ error: 'Failed to insert invoice' });
              });
            }
          // console.log("Invoicce set");
          // Commit the transaction
          db.commit((err) => {
            if (err) {
              console.error('Transaction commit failed:', err);
              return db.rollback(() => {
                db.end();
                res.status(500).json({ error: 'Transaction commit failed' });
              });
            }else{
              const updateRoomQuery = 'UPDATE Rooms SET status = "booked" WHERE room_id = ?';
              db.query(updateRoomQuery, room_id, function (err, result) {
                if (err) {
                  db.rollback(function () {
                    console.error(err);
                    res.status(500).json({ error: 'Failed to update room status.' });
                  });
                } 
              });
            }
            // Transaction successful
            console.log('User and booking added successfully');
            db.end();
            res.redirect('/admin/bookingsAll');
            });

          });
        });
      });
    });  
  });
});

// get who booked room
app.get('/admin/rooms/:room_id', (req, res) => {

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
});

// get all bookings
app.get('/admin/bookingsAll', (req, res) => {

  const bookingQuery = `SELECT
  b.booking_id,
  g.firstName AS guest_firstName,
  g.lastName AS guest_lastName,
  r.room_name,
  r.price_per_night,
  b.booking_date,
  b.check_in_date,
  b.check_out_date,
  b.status
  FROM Bookings AS b
  JOIN Guest AS g ON b.guest_id = g.guest_id
  JOIN Rooms AS r ON b.room_id = r.room_id;
  `;

  db.query(bookingQuery, (err, bookings) => {
    if (err) {
      throw err;
    }
    // console.log(bookings);
    res.render('bookingsTotal', { bookings , message:"" });
  });
});


//  cancel booking
app.get('/admin/bookings/cancel/:booking_id', (req, res)=>{
  const bookingId = req.params.booking_id;

  const query = `UPDATE Bookings SET status = ? WHERE booking_id = ?`;
  const newStatus = 'cancelled';

  db.query(query, [newStatus, bookingId], (err, result) => {
    if (err) {
      console.error('Database error: ' + err);
      return res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
    const roomQuery = 'UPDATE Rooms SET status = ? WHERE room_id = (SELECT room_id FROM Bookings WHERE booking_id = ?)';
    db.query(roomQuery, ['available', bookingId], (err, result) => {
      if (err) {
        console.error('Database error: ' + err);
        return res.status(500).json({ error: 'An error occurred while processing your request.' });
      }
      res.redirect('/admin/bookingsAll');
    });
  });
  

});
// All invoices
app.get('/admin/invoices', (req, res)=>{

  const bookingQuery = `SELECT I.*, G.*, B.*,R.* 
        FROM Invoices AS I
        JOIN Guest AS G ON I.guest_id = G.guest_id
        JOIN Bookings AS B ON I.booking_id = B.booking_id
        JOIN Rooms AS R ON B.room_id = R.room_id;`

  db.query(bookingQuery, (err, bookings) => {
    if (err) {
      throw err;
    }else{
      // console.log(bookings);
      res.render('invoices',{bookings});
    }
  });
});

app.get('/admin/invoices/:invoice_id', (req, res)=>{

  const {invoice_id} = req.params;

  const invoiceQuery = `
  SELECT I.*,
         g.firstName AS guest_firstName,
         g.lastName AS guest_lastName,
         g.email AS guest_email,
         g.phone AS guest_phone,
         g.addresss AS guest_address,
         b.booking_date,
         b.check_in_date,
         b.check_out_date,
         b.status,
         r.room_name,
         r.price_per_night
  FROM Invoices AS I
  JOIN Bookings AS b ON I.booking_id = b.booking_id
  JOIN Rooms AS r ON b.room_id = r.room_id
  JOIN Guest AS g ON I.guest_id = g.guest_id
  WHERE I.invoice_id = ${invoice_id}`;



  db.query(invoiceQuery, (err, invoiceData) => {
    if (err) {
      throw err;
    }
    // console.log(invoiceData[0]);
    // res.send("Success");
    res.render('invoicetest',{invoiceData : invoiceData[0]});
  });

});

// checkout APi
app.get('/admin/rooms/checkout/:booking_id', (req, res) => {
  const {booking_id} = req.params;

  const bookingStatus = `UPDATE Bookings
  SET status = 'checkout'
  WHERE booking_id = ${booking_id}`

  const query = `UPDATE Rooms
  SET status = 'available'
  WHERE room_id = (SELECT Bookings.room_id FROM Bookings WHERE booking_id = ${booking_id});`

  const invoiceQuery = `SELECT Invoices.invoice_id
  FROM Invoices
  JOIN Bookings ON Invoices.booking_id = Bookings.booking_id
  WHERE Bookings.booking_id = ${booking_id};
  `
  db.query(bookingStatus ,(err, result) => {
    if (err) {
     return res.send("Error in Update Booking Status");
    }
   else {
    db.query(query ,(err, result) => {
      if (err) {
        return res.send("Error in Update Booking Status");
       }
       else{
        db.query(invoiceQuery ,(err, invoiceId) => {
          if (err) {
            return res.send("Error in Update Booking Status");
           }
           res.redirect(`/admin/invoices/${invoiceId[0].invoice_id}`);

        });
       }
    });
   }
  })
});


// get all customers of rooms
app.get('/admin/roomcustomers', (req, res) => {

const query = `SELECT *
 FROM Guest;
`;
db.query(query, (err, rows) => {
    if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
    }
    res.render('roomCustomerInfo', { data: rows });
});
});

// get and post of update users
app.get('/admin/update',(req, res)=> {

const query = 'SELECT * FROM Guest';
db.query(query, (err, rows) => {
    if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
    }
    res.render('updateUser', { data: rows });
});
});


app.post('/admin/update',(req, res)=>{

  const db =  mysql.createConnection({
    host: 'hotel-db.cjhvgiah3e0n.us-east-1.rds.amazonaws.com',
    user: 'admin',
    password: '7raysadmindb',
    database: 'testhotel',
  });
  db.connect((err) => {
    if (err) {
      console.error('Database connection error: ' + err.message);
    } else {
      console.log('Database connected ');
    }
  });

const updatedData = req.body; 

const query = `UPDATE Guest SET
firstName = ?,
lastName = ?,
dob = ?,
addresss = ?,
email = ?,
phone = ?,
city = ?
WHERE guest_id = ?`;

db.query(
    query,
    [
      updatedData.firstName,
      updatedData.lastName,
      updatedData.dob,
      updatedData.addresss,
      updatedData.email,
      updatedData.phone,
      updatedData.city,
      updatedData.guest_id // You should have a guest_id property in your updatedData
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }

      // Check the result object for the number of affected rows to confirm the update
      if (result.affectedRows > 0) {
        res.redirect('/admin/table');
      } else {
        res.send("No records were updated. Guest not found.");
      }
    }
  );
});
//  SEND Invoice to mail

//  app.post is there after remove erro file
app.get('/admin/send/:invoice_id', async (req, res) => {

  const { invoice_id } = req.params;

  const invoiceQuery = `
  SELECT I.*,
         g.firstName AS guest_firstName,
         g.lastName AS guest_lastName,
         g.email AS guest_email,
         g.phone AS guest_phone,
         g.addresss AS guest_address,
         b.booking_date,
         b.check_in_date,
         b.check_out_date,
         b.status,
         r.room_name,
         r.price_per_night
  FROM Invoices AS I
  JOIN Bookings AS b ON I.booking_id = b.booking_id
  JOIN Rooms AS r ON b.room_id = r.room_id
  JOIN Guest AS g ON I.guest_id = g.guest_id
  WHERE I.invoice_id = ${invoice_id}`;

  db.query(invoiceQuery, async (err, invoiceData) => {
    if (err) {
      console.log("Error in Invoice");
      throw err;
    }
    else{
      const data = invoiceData[0];
      const full_name = data.guest_firstName + ' ' + data.guest_lastName;
      const email = data.guest_email;
  // Create a transporter for sending emails
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: '', // Your Gmail email
      pass: '', // App key from Gmail 2FA
    },
  });

  const mailOptions = {
    from: '', // Your Gmail email
    to: email, // Customer's email
    subject: 'Invoice from 7Rays',
    text: `
    Customer Details:-
    Name: ${full_name}
    Email: ${email}
    `,
    attachments: [
      {
        filename: 'invoice.pdf',
        path: 'invoice.pdf', // Path to the generated invoice PDF
      },
    ],
  };

  // chinmaymenaria07@gmail.com

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    res.redirect('/home');

  } catch (error) {
    console.error('Error sending email: ' + error);
    res.status(500).send('Error sending email');
  }
    }
  });
  // res.render('error-404')
});



// invoice download PDF
app.get('/admin/download/:invoice_id', async (req, res) => {
  try {
    const { invoice_id } = req.params;

    // Fetch invoice data using a parameterized query to prevent SQL injection
    const invoiceQuery = `
      SELECT I.*,
             g.firstName AS guest_firstName,
             g.lastName AS guest_lastName,
             g.email AS guest_email,
             g.phone AS guest_phone,
             g.addresss AS guest_address,
             b.booking_date,
             b.check_in_date,
             b.check_out_date,
             b.status,
             r.room_name,
             r.price_per_night
      FROM Invoices AS I
      JOIN Bookings AS b ON I.booking_id = b.booking_id
      JOIN Rooms AS r ON b.room_id = r.room_id
      JOIN Guest AS g ON I.guest_id = g.guest_id
      WHERE I.invoice_id = ?`;

    db.query(invoiceQuery, [invoice_id], async (err, invoiceData) => {
      if (err) {
        console.error("Error in Invoice query:", err);
        return res.status(500).send('Internal Server Error');
      }

      if (!invoiceData || invoiceData.length === 0) {
        return res.status(404).send('Invoice not found');
      }

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Add these args for running Puppeteer on some servers like EC2
      });
      const page = await browser.newPage();

      try {
        // Compile your EJS template to HTML
        const templatePath = path.join(__dirname, 'views', 'invoice.ejs');
        const htmlContent = await ejs.renderFile(templatePath, { invoiceData: invoiceData[0] });

        const options = {
          format: 'A4',
          margin: {
            top: '10mm',
            right: '20mm',
            bottom: '10mm',
            left: '10mm',
          },
        };

        await page.setContent(htmlContent);
        const pdfBuffer = await page.pdf(options);

        // Set the response headers for downloading the PDF
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice_id}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');

        // Send the PDF as a response
        res.send(pdfBuffer);
      } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).send('Error generating PDF');
      } finally {
        // Close the browser after generating the PDF
        await browser.close();
      }
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).send('Internal Server Error');
  }
});


// ------------- RESTAURETNS----------------
// get food items
app.get('/admin/fooditems', async (req, res) => {
  try {
    const foodQuery = `SELECT F.*, 
    FC.category_id AS foodC,
    FC.categoryName
    FROM FoodInfo AS F
    JOIN FoodCategories AS FC on F.category_id = FC.category_id
    `;

    db.query(foodQuery, (err, result)=>{
      if(err){
        console.log(err);
        
      }else{
        // console.log(result);
        res.render('foodItem', {foodItems : result});
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// get all restro customers
app.get('/admin/rescustomers', async (req, res) => {
  try {
    const customerQuery = `SELECT * FROM  Customers`;

    db.query(customerQuery, (err, result)=>{
      if(err){
        console.log(err);
        
      }else{
        console.log(result);
        res.render('restroCustomers', {restroCustomers : result});
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Table Booking
app.get('/admin/tableBookings',(req, res)=>{
  const tableQuery = `SELECT * FROM Tables`

  db.query(tableQuery, (err, result)=>{
    if(err){
      console.error(err);
        return res.status(500).send('Internal Server Error');
    }
    // console.log(result);
    res.render('TableBooking', {tableData : result})
  })
});

app.get('/admin/foodorders',(req, res)=>{
  const foodQuery = `SELECT F.*, 
  FC.category_id AS foodC,
  FC.categoryName
  FROM FoodInfo AS F
  JOIN FoodCategories AS FC on F.category_id = FC.category_id
  `;
  db.query(foodQuery, (err, result)=>{
    if(err){
      console.log(err);
    }else{
      console.log(result);
      res.render('foodBooking', {foodItems : result});
    }
  });
});

app.post('/admin/foodorders', (req, res) => {
  const data = req.body;
  // console.log("date is");
  // console.log(data);
  // console.log("Amount is " + data.amount);

  db.query(
    'INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
    [data.customer.name, data.customer.email, data.customer.phone, data.customer.address],
    (err, results) => {
      if (err) {
        console.error('Error saving customer details to the database: ', err);
        return res.status(500).json({ error: 'An error occurred while saving customer details.' });
      }
      else{
        const customer_id = results.insertId;
        // console.log(customer_id);

        db.query(
          'INSERT INTO orders (customer_id, order_time, total_amount) VALUES (?, NOW(), ?)',
          [customer_id, data.amount],
          (err, results) => {
            if (err) {
              console.error('Error saving order to the database: ', err);
              return res.status(500).json({ error: 'An error occurred while saving the order.' });
            }
        
            const orderId = results.insertId; // Get the auto-generated order ID
           
            // Now, insert the items associated with the order
            const items = data.items;
            const itemValues = items.map(item => [orderId, item.name, item.price, item.quantity, data.amount]);
            
            const placeholders = itemValues.map(() => "(?, ?, ?, ?, ?)").join(", ");
            const values = itemValues.flat(); // Flatten the array of arrays
            
            const query = `INSERT INTO order_details (order_id, food_name, price, quantity, total_price) VALUES ${placeholders}`;
            
            db.query(
              query,
              values,
              (err, itemResults) => {
                if (err) {
                  console.error('Error saving order items to the database: ', err);
                  return res.status(500).json({ error: 'An error occurred while saving the order items.' });
                }
                // Respond with a success message
              }
            );
            
          }
        );
       
      }
    }
  );
  res.redirect('/admin/home');
  // Store the order data in the MySQL database (update the SQL query as per your table structure)
});


// Error 404
app.get('/admin/error404',(req, res)=>{
  res.render('error-404');
});

app.listen(4040,() =>{
    console.log('Server running on port 4040');
});
