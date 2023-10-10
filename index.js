const express = require('express');
const axios = require('axios');
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

/////////////
//portfolio//
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
      sql = "SELECT t.shareid, c.company, c.symbol, sum(t.qty) AS qty, avg(t.rate) as avgrate, sum(t.rate*t.qty) AS avgcost FROM transactions t LEFT JOIN companies c ON c.id = t.shareid WHERE t.userid = ? GROUP BY c.company, t.shareid HAVING sum(t.qty) > 0";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          // if (result.length === 0) {
          //   return res.json({ success: false, error: "No data to show portfolio" });
          // };
          portfolio = result;
          sql = "SELECT t.id, t.shareid, c.company, t.tdate, t.qty, t.rate, (t.rate*t.qty) AS amount FROM transactions t LEFT JOIN companies c ON c.id = t.shareid WHERE t.userid = ?";
          try {
            conn.query(sql, [userid], (err, result) => {
              if (err) {
                return res.json({ success: false, error: err });
              };
              // if (result.length === 0) {
              //   return res.json({ success: false, error: "No data on transactions" });
              // };
              transactions = result;
              sql = "select c.company, sum(t.qty) as qty, avg(t.rate) as avgrate, sum((t.qty*t.rate)) as amount from transactions t  left join companies c on c.id = t.shareid where t.userid = ? group by c.company having sum(t.qty) = 0";
              try {
                conn.query(sql, [userid], (err, result) => {
                  if (err) {
                    return res.json({ success: false, error: err });
                  };
                  return res.json({ success: true, portfolio: portfolio, transactions: transactions, gain: result });
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
  } catch (err) {
    return res.json({ success: false, error: "Server Error" });
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

///////////////
//Sell Shares//
///////////////
app.post("/api/sell", fetchuser, async (req, res) => {
  const { tdate, rate, qty, shareid } = req.body;
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
        conn.query(sql, [shareid, tdate, qty, rate, userid], (err, result) => {
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

////////////////////////////////
//List of all purchased shares//
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
      sql = "SELECT c.company, sum(t.qty) AS qty, avg(t.rate) as avgrate, sum(t.rate*t.qty) AS avgcost FROM transactions t LEFT JOIN companies c ON c.id = t.shareid WHERE t.userid = ? GROUP BY c.company HAVING sum(t.qty) > 0";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.length === 0) {
            return res.json({ success: false, error: "No records to display" });
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
              return res.json({ success: true, portfolio: portfolio, transactions: result });
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

////////////////////////////
//List of all sold shares//
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

///////////////////////
//Update transactions//
//////////////////////
app.put("/api/update", fetchuser, async (req, res) => {
  let sql = "SELECT * FROM users WHERE username = ?";
  const { tdate, qty, rate, id } = req.body;
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "User not found" });
      };
      const userid = result[0].id;
      sql = "UPDATE transactions SET tdate = ?, qty = ?, rate =? WHERE userid = ? and id = ?";
      try {
        conn.query(sql, [tdate, qty, rate, userid, id], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          return res.json({ success: true, message: "Record updated" });
        });
      } catch (err) {
        return res.json({ success: false, error: "Server Error" });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: "Server Error" });
  };
});

//////////////////////
//delete transaction//
//////////////////////
app.delete("/api/delete/:id", fetchuser, async (req, res) => {
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
      sql = "DELETE FROM transactions WHERE userid = ? and id = ?";
      try {
        conn.query(sql, [userid, req.params.id], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          return res.json({ success: true, message: "Record deleted successfully" });
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
//find symbol//
///////////////
app.get("/api/symbol/:id", (req, res) => {
  const sql = "SELECT symbol FROM companies WHERE id = ?"
  try {
    conn.query(sql, [req.params.id], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      return res.json({ success: true, data: result });
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

app.get("/api/uniquecompanies", (req, res) => {
  const sql = "select distinct t.shareid, c.symbol from transactions t left join companies c on c.id = t.shareid"
  try {
    conn.query(sql, (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      return res.json({ success: true, data: result });
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  }
});

////////////////////////////
//APIs for the Home Screen//
////////////////////////////

///////////////////
//Total Purchases//
///////////////////
app.get("/api/home/purchasessum", fetchuser, async (req, res) => {
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
      sql = "SELECT CAST(SUM(qty*rate) AS FLOAT) AS totalpurchases FROM transactions WHERE userid = ? AND qty > 0";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.length === 0) {
            return res.json({ success: true, data: [{ totalpurchases: 0 }] });
          };
          return res.json({ success: true, data: result })
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
//Total Sales//
///////////////
app.get("/api/home/salessum", fetchuser, async (req, res) => {
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
      sql = "SELECT IFNULL(CAST(SUM(-1*qty*rate) AS FLOAT),0) AS totalsales FROM transactions WHERE userid = ? AND qty < 0";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.affectedRows === 0) {
            return res.json({ success: true, data: [{ totalsales: 0 }] });
          };
          return res.json({ success: true, data: result })
        });
      } catch (err) {
        return res.json({ success: false, error: "Server Error" });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: "Server Error" });
  };
});

/////////////////////
//Summary of Sales//
////////////////////
app.get("/api/home/salesummary", fetchuser, async (req, res) => {
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
      sql = "SELECT shareid, CAST(-1*sum(qty) AS FLOAT) AS qty, CAST(sum(qty*rate)/sum(qty) AS FLOAT) AS avgrate, CAST(-1*sum(qty*rate) AS FLOAT) AS amount FROM transactions WHERE userid = ? AND qty < 0 GROUP BY shareid";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          return res.json({ success: true, data: result })
        });
      } catch (err) {
        return res.json({ success: false, error: "Server Error" });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: "Server Error" });
  };
});

///////////////////////
//Summary of Purchase//
//////////////////////
app.get("/api/home/purchasesummary", fetchuser, async (req, res) => {
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
      sql = "SELECT shareid, CAST(sum(qty) AS FLOAT) AS qty, CAST(sum(qty*rate)/sum(qty) AS FLOAT) AS avgrate, CAST(sum(qty*rate) AS FLOAT) AS amount FROM transactions WHERE userid = ? AND qty > 0 GROUP BY shareid";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          return res.json({ success: true, data: result })
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
//Realised Profit//
///////////////////
app.get("/api/home/realisedprofit", fetchuser, async (req, res) => {
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
      sql = "SELECT shareid, CAST(sum(qty) AS FLOAT) AS qty, CAST(sum(qty*rate)/sum(qty) AS FLOAT) AS avgrate, CAST(sum(qty*rate) AS FLOAT) AS amount FROM transactions WHERE userid = ? AND qty > 0 GROUP BY shareid";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          const purchaseSummary = result;
          sql = "SELECT shareid, CAST(-1*sum(qty) AS FLOAT) AS qty, CAST(sum(qty*rate)/sum(qty) AS FLOAT) AS avgrate, CAST(-1*sum(qty*rate) AS FLOAT) AS amount FROM transactions WHERE userid = ? AND qty < 0 GROUP BY shareid";
          try {
            conn.query(sql, [userid], (err, result) => {
              if (err) {
                return res.json({ success: false, error: err });
              };
              const saleSummary = result;
              let i = 0, j = 0;
              // let realisedProfitSummary = [];
              let realisedprofit = 0;
              for (i = 0; i < saleSummary.length; i++) {
                for (j = 0; j < purchaseSummary.length; j++) {
                  if (saleSummary[i].shareid === purchaseSummary[j].shareid) {
                    realisedprofit += (saleSummary[i].avgrate - purchaseSummary[j].avgrate) * saleSummary[i].qty;
                    // realisedProfitSummary.push(JSON.parse(`{"shareid":${saleSummary[i].shareid},"realisedprofit":${(saleSummary[i].avgrate - purchaseSummary[j].avgrate)*saleSummary[i].qty}}`))
                  };
                };
              };
              return res.json({ success: true, realisedprofit: realisedprofit })
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

////////////////////
//Home - Portfolio//
////////////////////
app.get("/api/home/portfolio", fetchuser, async (req, res) => {
  let portfolioWithCurrentRates;
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
      sql = "SELECT c.company as share, CAST(sum(t.qty) AS FLOAT) AS qty, CAST(sum(t.rate*t.qty)/sum(t.qty) AS FLOAT) AS avgrate, CAST(sum(t.rate*t.qty) AS FLOAT) AS value FROM transactions t LEFT JOIN companies c on c.id = t.shareid WHERE userid = ? GROUP BY c.company";
      try {
        conn.query(sql, [userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          const portfolio = result;
          const sql = "select distinct t.shareid, c.symbol from transactions t left join companies c on c.id = t.shareid"
          try {
            conn.query(sql, (err, result) => {
              if (err) {
                return res.json({ success: false, error: err });
              };
              const uniqueCompanies = result;
              console.log(uniqueCompanies)
              let i;
              const apiUrl = "https://www.alphavantage.co/query";
              const apiParams = {};
              let closingValues = [];
              for (i = 0; i < uniqueCompanies.length; i++) {
                const apiParams = {
                  params: {
                    function: 'TIME_SERIES_DAILY',
                    apikey: 'YSX0K9U097FUH83Z',
                    symbol: uniqueCompanies[i].symbol,
                  },
                };
                console.log(apiParams);
                axios.get(apiUrl, apiParams)
                  .then((response) => {
                    try {
                      if (!response.data || !response.data["Time Series (Daily)"]) {
                        return res.json({ success: false, error: "Error fatching current market rates" });
                      } else {
                        const datesArray = Object.keys(response.data["Time Series (Daily)"]);
                        datesArray.sort((a, b) => new Date(b) - new Date(a));
                        const mostRecentDate = datesArray[0];
                        closingValues.push(parseFloat(response.data["Time Series (Daily)"][mostRecentDate]["4. close"]));
                        portfolioWithCurrentRates = portfolio.map((item, index) => ({
                          ...item,
                          currentrate: closingValues[index],
                          currentvalue: closingValues[index] * item.qty
                        }));
                        // console.log("new portfolio:", portfolioWithCurrentRates);
                        return res.json({ success: true, data: portfolioWithCurrentRates });
                      }
                    } catch (err) {
                      console.error(err);
                      // throw new Error("Error fetching data");
                    };
                  });
              };
            });
          } catch (err) {
            return res.json({ success: false, error: err });
          }
        });
      } catch (err) {
        return res.json({ success: false, error: "Server Error" });
      };
    });
  } catch (err) {
  };
});

app.listen(5000);