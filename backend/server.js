require("dotenv").config();
process.env.TZ = process.env.TZ || "Asia/Kolkata"; // reminders/dates India time par
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const serviceRoutes = require("./routes/serviceRoutes");
const stylistRoutes = require("./routes/stylistRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const authRoutes = require("./routes/authRoutes");
const shopRoutes = require("./routes/shopRoutes");
const superRoutes = require("./routes/superRoutes");
const { startReminderJob } = require("./services/reminders");
const { enabled: mailEnabled } = require("./utils/mailer");

const app = express();

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// ---------- DB Connect ----------
connectDB();

// ---------- API Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/super", superRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/stylists", stylistRoutes);
app.use("/api/appointments", appointmentRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Smart Salon API is running" });
});

// ---------- Serve Frontend (static files) ----------
// Agar tum frontend ko is hi server se serve karna chahte ho:
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(frontendPath, "admin.html"));
});

// ---------- Error handler (fallback) ----------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Kuch galat ho gaya (Internal Server Error)" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  if (mailEnabled) startReminderJob();
  else console.log("ℹ️  SMTP set nahi hai: emails console me print honge, reminders band hain.");
  console.log(`🚀 Smart Salon server chal raha hai: http://localhost:${PORT}`);
});
