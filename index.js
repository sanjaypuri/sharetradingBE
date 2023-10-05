const express = require('express');
const bodyparser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const conn = require('./database/mysql');
const fetchuser = require('./fetchuser');
// const { parse } = require('dotenv');

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
//Add new User//OK
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
//User Login//OK
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
//List of Companies//Not Required
////////////////////
// app.get("/api/companies", (req, res) => {
//   const sql = "SELECT * from companies order by company";
//   try {
//     conn.query(sql, (err, result) => {
//       if (err) {
//         return res.json({ success: false, error: err });
//       };
//       if (result.length === 0) {
//         return res.json({ success: false, error: "No companies available" });
//       }
//       return res.json({ success: true, data: result });
//     });
//   } catch (err) {
//     return res.json({ success: false, error: err });
//   };
// });

/////////////////////////////////////////////////
//List of Companies in format for Search Select//OK
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
//Buy Shares//OK
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
      sql = "INSERT INTO transactions (shareid, tdate, qty, rate, userid) VALUES (?, ?, ?, ?, ?)";
      try {
        conn.query(sql, [shareid, buydate, buyqty, buyrate, userid], (err, result) => {
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
                buyqty: buyqty,
                buyrate: buyrate,
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

/////////////
//portfolio//OK
/////////////
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
      sql = "SELECT c.company, sum(t.qty) AS qty, avg(t.rate) as avgrate, sum(t.rate*t.qty) AS avgcost FROM transactions t LEFT JOIN companies c ON c.id = t.shareid WHERE t.userid = ? GROUP BY c.company HAVING sum(t.qty) > 0";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.length === 0) {
            return res.json({ success: false, error: "No data to show portfolio" });
          };
          portfolio = result;
          sql = "SELECT t.shareid, c.company, t.tdate, t.qty, t.rate, (t.rate*t.qty) AS amount FROM transactions t LEFT JOIN companies c ON c.id = t.shareid WHERE t.userid = ?";
          try {
            conn.query(sql, [userid], (err, result) => {
              if (err) {
                return res.json({ success: false, error: err });
              };
              if (result.length === 0) {
                return res.json({ success: false, error: "No data on transactions" });
              };
              transactions = result;
              return res.json({ success: true, portfolio: portfolio, transactions: transactions });
            });
          } catch (err) {
            return res.json({ success: false, error: "Server Error" });
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

///////////////
//Sell Shares//OK
///////////////
app.post("/api/sell", fetchuser, async (req, res) => {
  const { selldate, sellrate, sellqty, shareid } = req.body;
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
      sql = "INSERT INTO transactions (shareid, tdate, qty, rate, userid) VALUES (?, ?, ?, ?, ?)";
      try {
        conn.query(sql, [shareid, selldate, sellqty, sellrate, userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.affectedRows) {
            return res.json({ success: true, message: "Record saved successfully" });
          } else {
            return res.json({ success: false, error: "Record could not be saved" });
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

///////////////
//Sell Update//Not Required
///////////////
// app.put("/api/sellupdate", fetchuser, async (req, res) => {
//   const { id, purrate, issold, saleqty } = req.body;
//   // sql = "SELECT * from companies where company = ?";
//   // try {
//   // conn.query(sql, [req.username], (err, result) => {
//   // if (err) {
//   //   return res.json({ success: false, error: err });
//   // };
//   // if (result.length === 0) {
//   //   return res.json({ success: false, error: "User not found" });
//   // };
//   // const userid = result[0].id;
//   sql = "UPDATE transactions SET purchaserate = ?, issold = ?, soldqty = ? WHERE id = ?";
//   try {
//     conn.query(sql, [purrate, issold, saleqty, id], (err, result));
//     if (err) {
//       return res.json({ success: false, error: err });
//     };
//     if (result.affectedRows) {
//       return res.json({ success: true, message: "Record saved successfully" });
//     } else {
//       return res.json({ success: false, error: "Record could not be saved" });
//     };
//   } catch (err) {
//     console.log(err);
//     return res.json({ success: false, error: "Server Error" });
//   };
//   // });
//   // } catch (err) {
//   //   return res.json({ success: false, error: "Server Error" });
//   // };
// });

////////////////////////////////
//List of all purchased shares//OK
////////////////////////////////
app.get("/api/allbuy", fetchuser, async (req, res) => {
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
      sql = "SELECT t.id, c.company, t.tdate, t.qty, t.rate, (t.rate*t.qty) AS amount FROM transactions t LEFT JOIN companies c ON c.id = t.shareid WHERE t.userid = ? and t.qty > 0 order by t.tdate";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.length === 0) {
            return res.json({ success: false, error: "No records to display" });
          };
          return res.json({ success: true, data: result });
        });
      } catch (err) {
        return res.json({ success: false, error: "Server Error" });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: "Server Error" });
  };
});

////////////////////////////
//List of all sold shares//OK
///////////////////////////
app.get("/api/allsale", fetchuser, async (req, res) => {
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
      sql = "SELECT t.id, c.company, t.tdate, t.qty, t.rate, (t.rate*t.qty) AS amount FROM transactions t LEFT JOIN companies c ON c.id = t.shareid WHERE t.userid = ? and t.qty < 0 order by t.tdate";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.length === 0) {
            return res.json({ success: false, error: "No records to display" });
          };
          return res.json({ success: true, data: result });
        });
      } catch (err) {
        return res.json({ success: false, error: "Server Error" });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: "Server Error" });
  };
});

///////////////////
//Shares for Sale//Not Required
///////////////////
// app.get("/api/forsale", fetchuser, async (req, res) => {
//   let sql = "SELECT * FROM users WHERE username = ?";
//   try {
//     conn.query(sql, [req.username], (err, result) => {
//       if (err) {
//         return res.json({ success: false, error: err });
//       };
//       if (result.length === 0) {
//         return res.json({ success: false, error: "User not found" });
//       };
//       const userid = result[0].id;
//       sql = "SELECT t.id, t.shareid, c.company, t.qty, t.rate, (t.qty-t.soldqty) AS cansell FROM transactions t LEFT JOIN companies c ON c.id = t.shareid WHERE userid = ? AND (t.qty-t.soldqty) > 0 ";
//       try {
//         conn.query(sql, [userid], (err, result) => {
//           if (err) {
//             return res.json({ success: false, error: err });
//           };
//           if (result.length === 0) {
//             return res.json({ success: false, error: "No records to display" });
//           };
//           return res.json({ success: true, data: result });
//         });
//       } catch (err) {
//         return res.json({ success: false, error: "Server Error" });
//       };
//     });

//   } catch (err) {
//     return res.json({ success: false, error: "Server Error" });
//   };
// });

app.listen(5000);