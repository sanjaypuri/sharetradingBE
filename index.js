const express = require('express');
const bodyparser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const conn = require('./database/mysql');
const fetchuser = require('./fetchuser');

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
        conn.query(sql, [username, hash], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.affectedRows) {
            return res.json({ success: true, data: "", message: `${username} registered successfully` });
          } else {
            return res.json({ success: false, error: `${username} could not be registered` });
          };
        });
      } catch (err) {
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
    conn.query(sql, [username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "Invalid username or password" });
      };
      bcrypt.compare(password, result[0].password, (err, validUser) => {
        if (err) {
          return res.json({ success: false, error: err });
        };
        if (validUser) {
          const username = result[0].username;
          const token = jwt.sign({ loggedinUser: username }, process.env.SECRET_KEY);
          return res.json({
            success: true,
            data: {
              userid: result[0].id,
              user: result[0].username,
              token: token
            },
            message: `${username} logged in successfully`
          });
        } else {
          return res.json({ success: false, error: "Invalid username or password" });
        };
      });
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

/////////////////////
//List of Companies//
////////////////////
app.get("/api/companies", (req, res) => {
  const sql = "SELECT * from companies order by company";
  try {
    conn.query(sql, (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "No companies available" });
      }
      return res.json({ success: true, data: result });
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

/////////////////////////////////////////////////
//List of Companies in format for Search Select//
/////////////////////////////////////////////////
app.get("/api/forselect", (req, res) => {
  const sql = "SELECT id as value, company as label FROM companies";
  try {
    conn.query(sql, (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "No companies available" })
      }
      return res.json({ success: true, data: result });
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

//////////////
//Buy Shares//
//////////////
app.post("/api/buy", fetchuser, async (req, res) => {
  let sql = "SELECT * FROM users WHERE username = ?";
  const { shareid, buydate, buyrate, buyqty } = req.body;
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "User not found" });
      };
      const userid = result[0].id;
      sql = "INSERT INTO purchases (shareid, buydate, buyrate, buyqty, userid) VALUES (?, ?, ?, ?, ?)";
      try {
        conn.query(sql, [shareid, buydate, buyrate, buyqty, userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.affectedRows) {
            return res.json({
              success: true,
              newRecord: {
                id: result.insertId,
                shareid: shareid,
                buydate: buydate,
                buyrate: buyrate,
                buyqty: buyqty,
                userid: userid
              },
              message: "Record saves successfully"
            });
          } else {
            return res.json({ success: false, error: "Record not saved" });
          };
        });
      } catch (err) {
        return res.json({ success: false, error: err });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

//////////////////
//Show Portfolio//
/////////////////
app.get("/api/portfolio", fetchuser, async (req, res) => {
  let sql = "SELECT * FROM users WHERE username = ?";
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "User not found" });
      };
      const userid = result[0].id;
      sql = "create or replace view v_sales as select c.company, sum(s.sellqty) as qty, avg(s.sellrate) as avgrate, sum(s.sellqty*s.sellrate) as salevalue from sales as s inner join companies as c on c.id = s.shareid where s.userid = ? group by c.company";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.length === 0) {
            return res.json({ success: false, error: "No data to show portfolio" });
          };
          sql = "create or replace view v_purchases as select c.company, sum(p.buyqty) as qty, avg(p.buyrate) as avgrate, sum(p.buyqty*p.buyrate) as cost from purchases as p inner join companies as c on c.id = p.shareid where p.userid = ? group by c.company";
          try {
            conn.query(sql, [userid], (err, result) => {
              if (err) {
                return res.json({ success: false, error: err });
              };
              if (result.length === 0) {
                return res.json({ success: false, error: "No data to show portfolio" });
              };
              sql = "select p.company, (p.qty-ifnull(s.qty, 0)) as qtyinhand, p.avgrate, (p.cost-(ifnull(s.qty, 0)*p.avgrate)) as cost from v_purchases as p left join v_sales as s on p.company = s.company where (p.qty-ifnull(s.qty, 0)) > 0";
              try {
                conn.query(sql, [userid], (err, result) => {
                  if (err) {
                    return res.json({ success: false, error: err });
                  };
                  if (result.length === 0) {
                    return res.json({ success: false, error: "No data to show portfolio" });
                  };
                  return res.json({ success: true, data: result });
                });
              } catch (err) {
                return res.json({ success: false, error: err });
              };
            });
          } catch (err) {
            return res.json({ success: false, error: err });
          };
        });
      } catch (err) {
        return res.json({ success: false, error: err });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

///////////////
//Sell Shares//
///////////////
app.post("/api/sell", fetchuser, async (req, res) => {
  const { selldate, sellrate, sellqty, company } = req.body;
  let sql = "SELECT * FROM users WHERE username = ?";
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "User not found" });
      };
      const userid = result[0].id;
      sql = "SELECT * from companies where company = ?";
      try {
        conn.query(sql, [company], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.length === 0) {
            return res.json({ success: false, error: "Error finding company" });
          } else {
            const shareid = result[0].id;
            sql = "INSERT INTO sales (selldate, sellrate, sellqty, shareid, userid) VALUES (?, ?, ?, ?, ?)";
            try {
              conn.query(sql, [selldate, sellrate, sellqty, shareid, userid], (err, result) => {
                if (err) {
                  return res.json({ success: false, error: err });
                };
                if(result.affectedRows){
                  return res.json({success:true, message:"Record saved successfully"});
                } else {
                  return res.json({success:false, error:"Record could not be saved"});
                };
              });
            } catch (err) {
              return res.json({ success: false, error: "Server Error" });
            };
          };
        });
      } catch (err) {
        return res.json({ success: false, error: "Server Error" });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: "Server Error" });
  };
});

////////////////////////////////
//List of all purchased shares//
////////////////////////////////
app.get("/api/allbuy", fetchuser, async (req, res) => {
  let sql = "SELECT * FROM users WHERE username = ?";
  try{
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "User not found" });
      };
      const userid = result[0].id;
      sql = "SELECT p.id, c.company, p.buydate AS date, p.buyqty AS qty, p.buyrate AS rate, (p.buyqty*p.buyrate) AS cost FROM purchases AS p LEFT JOIN companies AS c ON c.id = p.shareid WHERE p.userid = ?  ORDER BY p.buydate";
      try{
        conn.query(sql, [userid], (err, result) => {
          if(err) {
            return res.json({success:false, error:err});
          };
          if(result.length === 0){
            return res.json({success:false, error:"No records to display"});
          };
          return res.json({success:true, data:result});
        });
      } catch(err) {
        return res.json({ success: false, error: "Server Error" });    
      };
    });
  } catch(err) {
    return res.json({ success: false, error: "Server Error" });
  };
});

////////////////////////////////
//List of all purchased shares//
////////////////////////////////
app.get("/api/allsale", fetchuser, async (req, res) => {
  let sql = "SELECT * FROM users WHERE username = ?";
  try{
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "User not found" });
      };
      const userid = result[0].id;
      sql = "SELECT s.id, c.company, s.selldate AS date, s.sellqty AS qty, s.sellrate AS rate, (s.sellqty*s.sellrate) AS soldvalue FROM sales AS s LEFT JOIN companies AS c ON c.id = s.shareid WHERE s.userid = ?  ORDER BY s.selldate";
      try{
        conn.query(sql, [userid], (err, result) => {
          if(err) {
            return res.json({success:false, error:err});
          };
          if(result.length === 0){
            return res.json({success:false, error:"No records to display"});
          };
          return res.json({success:true, data:result});
        });
      } catch(err) {
        return res.json({ success: false, error: "Server Error" });    
      };
    });
  } catch(err) {
    return res.json({ success: false, error: "Server Error" });
  };
});

app.listen(5000);