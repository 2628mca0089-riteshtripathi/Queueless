const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Shop = require("../models/Shop");
const { sendMail } = require("../utils/mailer");
const Admin = require("../models/Admin");
const { protectAdmin } = require("../middleware/auth");

const router = express.Router();

// Simple in-memory brute-force protection: 10 failed attempts / 15 min per IP+email
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const attemptKey = (req) => `${req.ip}:${String(req.body.email || "").toLowerCase()}`;
const isLocked = (key) => {
  const a = attempts.get(key);
  if (!a) return false;
  if (Date.now() - a.first > WINDOW_MS) { attempts.delete(key); return false; }
  return a.count >= MAX_FAILS;
};
const recordFail = (key) => {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else a.count++;
};

// @route   POST /api/auth/login
// @desc    Admin login -> returns JWT token
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const key = attemptKey(req);
    if (isLocked(key)) {
      return res.status(429).json({ message: "Bahut zyada galat attempts. 15 minute baad try karein." });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      recordFail(key);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      recordFail(key);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (admin.role !== "superadmin") {
      const shop = await Shop.findById(admin.shopId).select("status isActive");
      if (shop && !Shop.isLive(shop)) {
        const msg = shop.status === "pending"
          ? "Aapki shop abhi approval ke intezaar me hai. Approve hone par aap login kar payenge."
          : "Aapki shop block/inactive hai. Support se sampark karein.";
        return res.status(403).json({ message: msg });
      }
    }

    attempts.delete(key);
    const token = jwt.sign(
      { id: admin._id, email: admin.email, shopId: admin.shopId ? admin.shopId.toString() : null, role: admin.role || "owner" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      admin: { id: admin._id, email: admin.email, name: admin.name, shopId: admin.shopId, role: admin.role || "owner" },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");

// @route   POST /api/auth/forgot  -> reset link email par bhejta hai
router.post("/forgot", async (req, res) => {
  const generic = { message: "Agar ye email registered hai to reset link bhej diya gaya hai. Inbox/spam check karein." };
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "Email required hai" });
    const key = `forgot:${req.ip}`;
    if (isLocked(key)) return res.status(429).json({ message: "Bahut zyada requests. 15 minute baad try karein." });
    recordFail(key);
    const admin = await Admin.findOne({ email });
    if (admin) {
      const token = crypto.randomBytes(32).toString("hex");
      admin.resetTokenHash = hashToken(token);
      admin.resetExpires = new Date(Date.now() + 30 * 60 * 1000);
      await admin.save();
      const base = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      await sendMail({
        to: admin.email,
        subject: "Password reset link",
        text: `Namaste,\n\nPassword reset karne ke liye ye link kholein (30 minute valid):\n${base}/reset.html?token=${token}\n\nAgar aapne request nahi ki to ise ignore karein.`,
      });
    }
    res.json(generic);
  } catch (error) { res.status(500).json({ message: "Server error" }); }
});

// @route   POST /api/auth/reset  -> token se naya password set
router.post("/reset", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: "Token aur new password required hain" });
    if (String(newPassword).length < 8) return res.status(400).json({ message: "Password kam se kam 8 characters ka hona chahiye" });
    const admin = await Admin.findOne({ resetTokenHash: hashToken(String(token)), resetExpires: { $gt: new Date() } });
    if (!admin) return res.status(400).json({ message: "Reset link invalid ya expire ho chuka hai" });
    admin.password = await bcrypt.hash(newPassword, 12);
    admin.resetTokenHash = undefined;
    admin.resetExpires = undefined;
    await admin.save();
    res.json({ message: "Password reset ho gaya. Ab login karein." });
  } catch (error) { res.status(500).json({ message: "Server error" }); }
});

// @route   PUT /api/auth/password
// @desc    Logged-in admin apna password change kare
router.put("/password", protectAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current aur new password dono required hain" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: "New password kam se kam 8 characters ka hona chahiye" });
    }
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin nahi mila" });
    if (!(await bcrypt.compare(currentPassword, admin.password))) {
      return res.status(400).json({ message: "Current password galat hai" });
    }
    admin.password = await bcrypt.hash(newPassword, 12);
    await admin.save();
    res.json({ message: "Password change ho gaya" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
