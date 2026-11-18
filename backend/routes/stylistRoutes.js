const express = require("express");
const Stylist = require("../models/Stylist");
const { protectAdmin } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/stylists
// @desc    Sabhi active stylists list karo (public)
router.get("/", async (req, res) => {
  try {
    const { shopId } = req.query;
    if (!shopId || !require("mongoose").isValidObjectId(shopId)) return res.status(400).json({ message: "Please select a valid shop" });
    const filter = { shopId, ...(req.query.all === "true" ? {} : { isActive: true }) };
    const stylists = await Stylist.find(filter).sort({ name: 1 });
    res.json(stylists);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/stylists
// @desc    Naya stylist add karo (admin only)
router.post("/", protectAdmin, async (req, res) => {
  try {
    const stylist = await Stylist.create({ ...req.body, shopId: req.admin.shopId });
    res.status(201).json(stylist);
  } catch (error) {
    res.status(400).json({ message: "Stylist create nahi ho paaya", error: error.message });
  }
});

// @route   PUT /api/stylists/:id
// @desc    Stylist update karo (admin only)
router.put("/:id", protectAdmin, async (req, res) => {
  try {
    const update = {};
    for (const key of ["name", "specialty", "experienceYears", "bio", "workStart", "workEnd", "weeklyOff", "isActive"]) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const stylist = await Stylist.findOneAndUpdate({ _id: req.params.id, shopId: req.admin.shopId }, update, {
      new: true,
      runValidators: true,
    });
    if (!stylist) return res.status(404).json({ message: "Stylist nahi mila" });
    res.json(stylist);
  } catch (error) {
    res.status(400).json({ message: "Stylist update nahi ho paaya", error: error.message });
  }
});

// @route   DELETE /api/stylists/:id
// @desc    Stylist delete karo (admin only)
router.delete("/:id", protectAdmin, async (req, res) => {
  try {
    const stylist = await Stylist.findOneAndDelete({ _id: req.params.id, shopId: req.admin.shopId });
    if (!stylist) return res.status(404).json({ message: "Stylist nahi mila" });
    res.json({ message: "Stylist delete ho gaya" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
