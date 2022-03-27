const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
let alert = require("alert");

const saltRounds = 10;

const app = express();
app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

dotenv.config();

/* ---------------------------------------------------Database ---------------------------------------------------- */

async function asyncCall() {
  await mongoose.connect(process.env.CONNECTION_URL);
  console.log("Database Connect");
}
asyncCall();

let currentCount = 0;
const Registration = new mongoose.Schema({
  email: String,
  password: String,
  reminder: [String],
  point: Number,
});
const User = mongoose.model("User", Registration);

var currentUser = null;
var currentUserReminder = null;


const ReminderSchema = new mongoose.Schema({
  time: String,
  date: Date,
  madicine_name: String,
  madicine_shape: String,
  amount_of_medicine: Number,
});
const Reminder = mongoose.model("Reminder", ReminderSchema);

const feedbackSchema = new mongoose.Schema({
  feedback: String,
});

const Feedback = mongoose.model("Feedback", feedbackSchema);

/*--------------------------------------------------SENDING Mail------------------------------------------------*/
const sendMail = () => {
  // Initializing sendgrid object
  const mailer = require("@sendgrid/mail");
  // const { send } = require('process');

  // Insert your API key here
  mailer.setApiKey(process.env.SENDGRID_API_KEY);

  // Setting configurations
  const sendMail = async (msg) => {
    try {
      await mailer.send(msg);
      console.log("Message Send Successfully!");
    } catch (e) {
      console.error(e);

      if (e.response) {
        console.error(e.response.body);
      }
    }
  };
  sendMail({
    to: currentUser.email,
    from: "medicinedosetracker@gmail.com",
    subject: "Reminder",
    html: `<p>This is a gentle reminder from  "Medicine Dose Tracker Site"  that you have to take <b>${currentUserReminder.madicine_name}</b>, so that you don't suffer from any kind of problem for not taking <b>${currentUserReminder.madicine_name}</b>. Thank you for seeing this notification.</p>`,
  });
};
const checkReminder = () => {
  var intervalID = setInterval(() => {
    var currentTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    console.log("Waiting");

    if (currentUser) {
      let currentUserReminders = currentUser.reminder;

      for (let i = 0; i <= currentUserReminders.length; i++) {
        Reminder.findById(
          { _id: currentUserReminders[i] },
          function (err, foundReminder) {
            if (err) {
              console.log(err.message);
            } else {
              let currentReminderTime = foundReminder.time;
              if (currentReminderTime === currentTime) {
                sendMail();
                console.log("Send Mail to User");
                currentUser.point = currentUser.point + 10;
                console.log(currentUser.point);
                User.findByIdAndUpdate(
                  currentUser._id,
                  { $set: { point: currentUser.point } },
                  function (err) {
                    if (err) {
                      console.log(err);
                    } else {
                      console.log("Point Updated");
                    }
                  }
                );

                clearInterval(intervalID);
              }
            }
          }
        );
      }
    }
  }, 1000);
};
/*-------------------------------------------------GET Requests---------------------------------------*/

let userReminder = [];
async function userReminderList() {
  console.log("userReminderList function call");
  if (currentUser) {
    let currentUserReminders = currentUser.reminder;
    for (let i = 0; i <= currentUserReminders.length; i++) {
      let oneId = currentUserReminders[i];
      Reminder.findById({ _id: oneId }, function (err, foundReminder) {
        if (!err) {
          if (userReminder.indexOf(foundReminder) === -1) {
            userReminder.push(foundReminder);
          }
        } else {
          console.log(err.message);
        }
      });
    }
  }
}

app.get("/", function (req, res) {
  console.log("Home page get request");
  res.sendFile(__dirname + "/HTML/index.html");
});

app.get("/profile", function (req, res) {
  // console.log(currentUser);
  res.sendFile(__dirname + "/HTML/profile.html");
});

app.get("/signin", function (req, res) {
  res.sendFile(__dirname + "/HTML/signin.html");
});

app.get("/signup", function (req, res) {
  res.sendFile(__dirname + "/HTML/signup.html");
});

app.get("/profile/reminder", function (req, res) {
  console.log("Get Request Reminder");

  // res.sendFile(__dirname + "/HTML/reminder.html")

  res.render("reminder", { listReminder: userReminder });
});

app.get("/profile/feedback", function (req, res) {
  console.log("Get Request Feedback");
  res.sendFile(__dirname + "/HTML/feedback.html");
});

app.get("/tips", function (req, res) {
  res.sendFile(__dirname + "/HTML/tips.html");
});
app.get("/about", function (req, res) {
  res.sendFile(__dirname + "/HTML/about.html");
});

app.get("/profile/history", function (req, res) {
  console.log("Get Request History");
  console.log("User Reminder Array: ", userReminder);
  res.render("history", {
    listReminder: userReminder,
    progress: currentUser.point,
  });
});
/*-------------------------------------------------POST Requests---------------------------------------*/

app.post("/profile/feedback", function (req, res) {
  console.log("Feedback Post Request");
  const User_Response = req.body.response;
  console.log("User_Response : ", User_Response);
  
  const newFeedback = new Feedback({
    feedback: User_Response,
  });

  newFeedback.save((err) => {
    if (err) {
      console.log(err.message);
    } else {
      console.log("User Feedback Data Saved in database");
      alert("Feedback Submitted");
      res.sendFile(__dirname + "/HTML/profile.html");
    }
  });
});

app.post("/profile/reminder", function (req, res) {
  const Time = req.body.time;
  const Date = req.body.date;
  const Medicine_Name = req.body.madicine_name;
  const Madicine_Shape = req.body.shape;
  const Amount_of_Medicine = req.body.amount_of_medicine;

  // console.log(currentUser);

  const newReminder = new Reminder({
    time: Time,
    date: Date,
    madicine_name: Medicine_Name,
    madicine_shape: Madicine_Shape,
    amount_of_medicine: Amount_of_Medicine,
  });

  newReminder.save((err) => {
    if (err) {
      console.log(err.message);
    } else {
      User.findByIdAndUpdate(
        currentUser._id,
        { $push: { reminder: newReminder._id } },
        function (err) {
          if (err) {
            console.log(err);
          } else {
            if (userReminder.indexOf(newReminder) !== -1) {
              userReminder.push(newReminder);
            }
            console.log("Succesfully Added");
          }
        }
      );
      currentUserReminder = newReminder;
      // console.log("currentUserReminder ",currentUserReminder);
      console.log("Set Reminder");
      checkReminder();
      res.render("reminder", { listReminder: userReminder });
      // res.sendFile(__dirname + "/HTML/reminder.html")
    }
  });
});

app.post("/signup", function (req, res) {
  User.findOne({ email: req.body.email }, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser && res.status(200)) {
        console.log("Already exsist");
        res.redirect("/signin");
      } else {
        bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
          const Email_id = req.body.email;
          const Password = hash;
          const Confirm_Password = hash;
          const newUser = new User({
            email: Email_id,
            password: Password,
            confirm_password: Confirm_Password,
            point: 0,
          });
          currentUser = newUser;
          console.log("New User: ", currentUser);
          newUser.save((err) => {
            if (err) {
              console.log(err.message);
            } else {
              console.log("New User Sucessfully Added");
              alert("Welcome to Medicine Dose Tracker Site ✨✨");
              res.redirect("/profile");
            }
          });
        });
      }
    }
  });
});

app.post("/signin", function (req, res) {
  signinCall();

  async function signinCall() {
    const { email, password } = req.body;
    console.log(email, password);
    try {
      const existingUser = await User.findOne({ email });
      console.log("existingUser: ", existingUser);

      if (existingUser) {
        const isPasswordCorrect = await bcrypt.compare(
          password,
          existingUser.password
        );

        if (isPasswordCorrect) {
          currentUser = existingUser;
          userReminderList();
          console.log("currentUser : ", currentUser);
          res.redirect("/profile");
        } else {
          alert("Something went wrong! Please try again");
          res.redirect("/signin");
        }
      } else {
        alert("User not found! Please Sign Up First");
        res.redirect("/signup");
      }
    } catch (error) {
      res.redirect("/signup");
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server Running on ${PORT}`);
});
