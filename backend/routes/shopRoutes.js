const express = require("express");
const bcrypt = require("bcryptjs");
const Shop = require("../models/Shop");
const Admin = require("../models/Admin");
const { protectAdmin } = require("../middleware/auth");
const router = express.Router();

const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

router.get("/", async (_req, res) => {
  try {
    const shops = await Shop.find({ isActive: true, status: { $in: ["approved", null] } }).select("name slug address phone description").sort({ name: 1 });
    res.json(shops);
  } catch (error) { res.status(500).json({ message: "Could not load salons" }); }
});

router.post("/register", async (req, res) => {
  try {
    const { name, ownerName, phone, email, address, description, password } = req.body;
    if (!name || !ownerName || !phone || !email || !address || !password) {
      return res.status(400).json({ message: "Shop name, owner, phone, email, address and password are required" });
    }
    if (String(password).length < 8) return res.status(400).json({ message: "Password must contain at least 8 characters" });
    const normalizedEmail = email.toLowerCase().trim();
    if (await Admin.findOne({ email: normalizedEmail })) return res.status(409).json({ message: "An account already exists for this email" });

    const baseSlug = slugify(name) || "shop";
    let slug = baseSlug, suffix = 1;
    while (await Shop.exists({ slug })) slug = `${baseSlug}-${suffix++}`;

    const hashed = await bcrypt.hash(password, 12);
    const shop = await Shop.create({ name, slug, ownerName, phone, email: normalizedEmail, address, description, status: "pending" });
    try {
      await Admin.create({ shopId: shop._id, email: normalizedEmail, password: hashed, name: ownerName, role: "owner" });
    } catch (e) { await Shop.findByIdAndDelete(shop._id); throw e; }
    res.status(201).json({ message: "Shop registered successfully. You can log in after approval.", shop: { _id: shop._id, name: shop.name } });
  } catch (error) { res.status(400).json({ message: "Could not register the shop", error: error.message }); }
});

router.get("/mine", protectAdmin, async (req, res) => {
  try {
    const shop = await Shop.findById(req.admin.shopId);
    if (!shop) return res.status(404).json({ message: "Shop nahi mili" });
    res.json(shop);
  } catch (_error) { res.status(400).json({ message: "Invalid shop" }); }
});

router.put("/mine", protectAdmin, async (req, res) => {
  try {
    const allowed = ["name", "ownerName", "phone", "address", "description"];
    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] === undefined) return;
      update[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
    });
    if (update.phone !== undefined && !/^[0-9]{10}$/.test(update.phone)) {
      return res.status(400).json({ message: "Phone number 10 digits ka hona chahiye" });
    }
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
    const { openTime, closeTime, holidays } = req.body;
    if (openTime !== undefined || closeTime !== undefined) {
      if (!!openTime !== !!closeTime) return res.status(400).json({ message: "Opening aur closing time dono bharein (ya dono khali chhodein)" });
      if (openTime && (!hhmm.test(openTime) || !hhmm.test(closeTime) || openTime >= closeTime)) {
        return res.status(400).json({ message: "Closing time opening time ke baad ka hona chahiye" });
      }
      update.openTime = openTime || "";
      update.closeTime = closeTime || "";
    }
    if (holidays !== undefined) {
      const ok = Array.isArray(holidays) && holidays.length <= 120 &&
        holidays.every((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)));
      if (!ok) return res.status(400).json({ message: "Holidays ki dates galat hain" });
      update.holidays = [...new Set(holidays)].sort();
    }
    const shop = await Shop.findByIdAndUpdate(req.admin.shopId, update, { new: true, runValidators: true });
    if (!shop) return res.status(404).json({ message: "Shop nahi mili" });
    if (update.ownerName) await Admin.findByIdAndUpdate(req.admin.id, { name: update.ownerName });
    res.json(shop);
  } catch (error) { res.status(400).json({ message: "Shop update nahi ho payi", error: error.message }); }
});

module.exports = router;
