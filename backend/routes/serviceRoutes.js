const express = require("express");
const Service = require("../models/Service");
const { protectAdmin } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/services
// @desc    Sabhi active services list karo (public - customer ke liye)
router.get("/", async (req, res) => {
  try {
    const { shopId } = req.query;
    if (!shopId || !require("mongoose").isValidObjectId(shopId)) return res.status(400).json({ message: "Please select a valid shop" });
    const filter = { shopId, ...(req.query.all === "true" ? {} : { isActive: true }) };
    const services = await Service.find(filter).sort({ category: 1, name: 1 });
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/services
// @desc    Naya service add karo (admin only)
router.post("/", protectAdmin, async (req, res) => {
  try {
    const service = await Service.create({ ...req.body, shopId: req.admin.shopId });
    res.status(201).json(service);
  } catch (error) {
    res.status(400).json({ message: "Service create nahi ho paaya", error: error.message });
  }
});

// @route   PUT /api/services/:id
// @desc    Service update karo (admin only)
router.put("/:id", protectAdmin, async (req, res) => {
  try {
    const update = {};
    for (const key of ["name", "category", "description", "price", "durationMinutes", "isActive"]) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const service = await Service.findOneAndUpdate({ _id: req.params.id, shopId: req.admin.shopId }, update, {
      new: true,
      runValidators: true,
    });
    if (!service) return res.status(404).json({ message: "Service nahi mila" });
    res.json(service);
  } catch (error) {
    res.status(400).json({ message: "Service update nahi ho paaya", error: error.message });
  }
});

// @route   DELETE /api/services/:id
// @desc    Service delete karo (admin only)
router.delete("/:id", protectAdmin, async (req, res) => {
  try {
    const service = await Service.findOneAndDelete({ _id: req.params.id, shopId: req.admin.shopId });
    if (!service) return res.status(404).json({ message: "Service nahi mila" });
    res.json({ message: "Service delete ho gaya" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
