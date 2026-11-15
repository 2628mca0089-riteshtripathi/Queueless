const express = require("express");
const Shop = require("../models/Shop");
const Admin = require("../models/Admin");
const { protectSuper } = require("../middleware/auth");
const { sendMail } = require("../utils/mailer");
const router = express.Router();

router.get("/shops", protectSuper, async (_req, res) => {
  try {
    const shops = await Shop.find().sort({ createdAt: -1 }).lean();
    shops.forEach((s) => { s.status = s.status || "approved"; });
    res.json(shops);
  } catch (e) { res.status(500).json({ message: "Shops load nahi ho payi" }); }
});

router.put("/shops/:id/status", protectSuper, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "approved", "blocked"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    const shop = await Shop.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!shop) return res.status(404).json({ message: "Shop nahi mili" });
    if (status === "approved") {
      sendMail({ to: shop.email, subject: "Aapki shop approve ho gayi", text: `Namaste ${shop.ownerName},\n\n${shop.name} approve ho gayi hai. Ab aap admin panel me login kar sakte hain.` });
    }
    res.json(shop);
  } catch (e) { res.status(400).json({ message: "Status update nahi ho paya" }); }
});

module.exports = router;
