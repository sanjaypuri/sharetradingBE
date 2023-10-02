const express = require('express');
const bodyparser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const conn = require('./database/mysql');

require('dotenv').config()

const port = process.env.PORT || 5000;

const app = express();

app.use(bodyparser.json());
app.use(express.json());

app.use(cors(
  {
    origin: ["http://localhost:3000", "https://urlofthefrontendappafterdeployment.com"],
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    credentials: true
  }
));

////////////////
//Add new User//
///////////////
app.post("/api/newuser", (req, res) => {
  const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
  const { username, password } = req.body;
  bcrypt.genSalt(10, (err, salt) => {
    if (err) {
      return res.json({ success: false, error: err });
    };
    bcrypt.hash(password, salt, (err, hash) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      try {
        conn.query(sql, [ username, hash ], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if(result.affectedRows){
            return res.json({success:true, data:"", message:`${username} registered successfully`});
          } else {
            return res.json({success:false, error:`${username} could not be registered`});
          };
        });
      } catch(err) {
        return res.json({ success: false, error: err });
      };
    });
  });
});

//////////////
//User Login//
/////////////
app.post("/api/login", (req, res) => {
  const sql = "SELECT * FROM users where username = ?";
  const { username, password } = req.body;
  try {
    conn.query(sql, [ username ], (err, result) => {
      if (err) {
        return res.json({success:false, error:err});
      };
      if(result.length === 0){
        return res.json({success:false, error:"Invalid username or password"});
      };
      bcrypt.compare(password, result[0].password, (err, validUser) => {
        if(err) {
          return res.json({success:false, error:err});
        };
        if(validUser){
          const token = jwt.sign({ loggedinUser:username }, process.env.SECRET_KEY);
          return res.json({
            success:true, 
            data:{
              userid:result[0].id,
              user:result[0].username,
              token:token
            }, 
            message:`${username} logged in successfully`});
          } else {
            return res.json({success:false, error:"Invalid username or password"});
        };
      });
    });
  } catch (err) {
    return res.json({success:false, error:err});
  };
});

/////////////////////
//List of Companies//
////////////////////
app.get("/api/companies", (req, res) => {
  const sql = "SELECT * from companies order by company";
  try {
    conn.query(sql, (err, result) => {
      if(err) {
        return res.json({success:false, error:err});
      };
      if(result.length === 0){
        return res.json({success:false, error:"No companies available"});
      }
      return res.json({success:true, data:result});
    });
  } catch(err) {
    return res.json({success:false, error:err});
  };
});

// app.post("/api/buy", fetchusers, (req, res) => {
//   const sql = "INSERT INTO portfolio (shareid, buydate, buyrate, buyqty, userid) VALUES (?, ?, ?, ?, ?) ";
//   const {} = req.body
// });

app.listen(5000);