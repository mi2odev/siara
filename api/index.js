const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { predictDriverRisk } = require("./contollers/Model/models");

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
dotenv.config();
app.use(cookieParser());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(express.json());

app.post("/api/model/predict", predictDriverRisk);

app.listen(process.env.PORT_NUM || 5000, () => {
  console.log("Backend server is running !!");
});
