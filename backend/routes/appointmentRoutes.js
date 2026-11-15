const express = require("express");
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Service = require("../models/Service");
const Stylist = require("../models/Stylist");
const { protectAdmin } = require("../middleware/auth");
const Shop = require("../models/Shop");
const { sendMail } = require("../utils/mailer");
const router = express.Router();

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
const minutesToTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const validId = (id) => mongoose.isValidObjectId(id);

// Public: slots for a stylist/service within one shop
router.get("/availability", async (req, res) => {
  try {
    const { stylistId, serviceId, date, shopId } = req.query;
    if (!stylistId || !serviceId || !date || !shopId) {
      return res.status(400).json({ message: "stylistId, serviceId, date aur shopId zaroori hain" });
    }
    if (![stylistId, serviceId, shopId].every(validId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Invalid request details" });
    }
    const [stylist, service] = await Promise.all([
      Stylist.findOne({ _id: stylistId, shopId, isActive: true }),
      Service.findOne({ _id: serviceId, shopId, isActive: true }),
    ]);
    if (!stylist || !service) return res.status(404).json({ message: "Stylist ya service nahi mila" });
    const shop = await Shop.findById(shopId).select("status isActive openTime closeTime holidays");
    if (!shop || !Shop.isLive(shop)) return res.json({ slots: [], message: "Ye shop abhi booking ke liye available nahi hai" });
    if ((shop.holidays || []).includes(date)) return res.json({ slots: [], message: "Shop is din band rahegi (holiday)" });

    const day = new Date(`${date}T00:00:00`).getDay();
    if (stylist.weeklyOff.includes(day)) return res.json({ slots: [], message: "Stylist is off on this day" });

    const existing = await Appointment.find({
      shopId, stylist: stylistId, date, status: { $ne: "cancelled" },
    }).populate("service", "durationMinutes");
    const occupied = existing.map((appointment) => {
      const start = timeToMinutes(appointment.timeSlot);
      return [start, start + (appointment.service?.durationMinutes || 30)];
    });

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const slots = [];
    const start = Math.ceil(Math.max(timeToMinutes(stylist.workStart), shop.openTime ? timeToMinutes(shop.openTime) : 0) / 30) * 30;
    const end = Math.min(timeToMinutes(stylist.workEnd), shop.closeTime ? timeToMinutes(shop.closeTime) : 1440);
    for (let t = start; t + service.durationMinutes <= end; t += 30) {
      const finish = t + service.durationMinutes;
      const overlap = occupied.some(([a, b]) => t < b && finish > a);
      const past = date < today || (date === today && t <= nowMinutes);
      slots.push({ time: minutesToTime(t), available: !overlap && !past });
    }
    res.json({ slots });
  } catch (error) {
    res.status(500).json({ message: "Availability check nahi ho paya", error: error.message });
  }
});

// Public: create appointment only when service, stylist and shop match
router.post("/", async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, service, stylist, date, timeSlot, notes, shopId } = req.body;
    if (!customerName || !customerPhone || !service || !stylist || !date || !timeSlot || !shopId) {
      return res.status(400).json({ message: "Sabhi required fields bharein aur shop select karein" });
    }
    if (![service, stylist, shopId].every(validId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(timeSlot)) {
      return res.status(400).json({ message: "Invalid booking details" });
    }
    const [serviceDoc, stylistDoc] = await Promise.all([
      Service.findOne({ _id: service, shopId, isActive: true }),
      Stylist.findOne({ _id: stylist, shopId, isActive: true }),
    ]);
    if (!serviceDoc) return res.status(404).json({ message: "Service nahi mila" });
    if (!stylistDoc) return res.status(404).json({ message: "Stylist nahi mila" });

    const start = timeToMinutes(timeSlot);
    const finish = start + serviceDoc.durationMinutes;
    const day = new Date(`${date}T00:00:00`).getDay();
    if (stylistDoc.weeklyOff.includes(day)) return res.status(400).json({ message: "Stylist is off on this day" });
    if (start < timeToMinutes(stylistDoc.workStart) || finish > timeToMinutes(stylistDoc.workEnd) || start % 30 !== 0) {
      return res.status(400).json({ message: "Selected time slot is outside working hours" });
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    if (date < today || (date === today && start <= now.getHours() * 60 + now.getMinutes())) {
      return res.status(400).json({ message: "Past time slot select nahi kar sakte" });
    }

    const existing = await Appointment.find({
      shopId, stylist, date, status: { $ne: "cancelled" },
    }).populate("service", "durationMinutes");
    const clash = existing.some((appointment) => {
      const oldStart = timeToMinutes(appointment.timeSlot);
      const oldEnd = oldStart + (appointment.service?.durationMinutes || 30);
      return start < oldEnd && finish > oldStart;
    });
    if (clash) return res.status(409).json({ message: "Ye slot abhi-abhi book ho gaya. Kripya doosra slot chunein." });

    const shopDoc = await Shop.findById(shopId).select("name status isActive openTime closeTime holidays");
    if (!shopDoc || !Shop.isLive(shopDoc)) return res.status(400).json({ message: "Ye shop abhi booking ke liye available nahi hai" });
    if ((shopDoc.holidays || []).includes(date)) return res.status(400).json({ message: "Shop us din band rahegi (holiday)" });
    if ((shopDoc.openTime && start < timeToMinutes(shopDoc.openTime)) || (shopDoc.closeTime && finish > timeToMinutes(shopDoc.closeTime))) {
      return res.status(400).json({ message: "Selected time shop ke khulne ke time ke bahar hai" });
    }
    const appointment = await Appointment.create({
      shopId, customerName, customerPhone, customerEmail, service, stylist, date, timeSlot, notes, status: "pending",
    });
    await appointment.populate([
      { path: "service", select: "name price durationMinutes" },
      { path: "stylist", select: "name specialty" },
    ]);
    if (customerEmail) {
      const [hh, mm] = timeSlot.split(":").map(Number);
      sendMail({
        to: customerEmail,
        subject: `Booking request mili - ${shopDoc.name}`,
        text: `Namaste ${customerName},\n\n${shopDoc.name} me aapki appointment request (${date}, ${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}) mil gayi hai. Status: pending. Shop confirm karte hi aapko pata chal jayega.\n\nDhanyavaad!`,
      });
    }
    res.status(201).json(appointment);
  } catch (error) {
    res.status(400).json({ message: "Appointment book nahi ho paaya", error: error.message });
  }
});

// Public: customer lookup scoped to selected shop
router.get("/lookup", async (req, res) => {
  try {
    const { phone, shopId } = req.query;
    if (!phone || !shopId) return res.status(400).json({ message: "Phone aur shop select karna zaroori hai" });
    if (!validId(shopId)) return res.status(400).json({ message: "Invalid shop" });
    const appointments = await Appointment.find({ customerPhone: phone, shopId })
      .populate("service", "name price durationMinutes")
      .populate("stylist", "name specialty")
      .sort({ date: -1, timeSlot: -1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Appointments load nahi ho payi", error: error.message });
  }
});

// Public: phone verification + shop scope before cancellation
router.put("/:id/cancel", async (req, res) => {
  try {
    const { phone, shopId } = req.body;
    if (!phone || !shopId || !validId(shopId)) return res.status(400).json({ message: "Phone aur shop verify karna zaroori hai" });
    const appointment = await Appointment.findOne({ _id: req.params.id, shopId });
    if (!appointment) return res.status(404).json({ message: "Appointment nahi mila" });
    if (appointment.customerPhone !== phone) return res.status(403).json({ message: "Phone number match nahi hua" });
    if (!["pending", "confirmed"].includes(appointment.status)) return res.status(400).json({ message: "Is appointment ko cancel nahi kar sakte" });
    appointment.status = "cancelled";
    await appointment.save();
    res.json({ message: "Appointment cancel ho gaya", appointment });
  } catch (error) {
    res.status(500).json({ message: "Appointment cancel nahi ho paya", error: error.message });
  }
});

// Admin: kamai chart + popular services (sirf is shop ka data)
router.get("/stats", protectAdmin, async (req, res) => {
  try {
    const range = [7, 30].includes(Number(req.query.range)) ? Number(req.query.range) : 7;
    const pad = (n) => String(n).padStart(2, "0");
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const days = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: ymd(d), revenue: 0, count: 0 });
    }
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
    const appts = await Appointment.find({
      shopId: req.admin.shopId,
      date: { $gte: days[0].date, $lte: days[days.length - 1].date },
      status: { $ne: "cancelled" },
    }).populate("service", "name price");

    let totalRevenue = 0, completedCount = 0, expectedRevenue = 0;
    const services = {};
    for (const a of appts) {
      const price = a.service ? a.service.price : 0;
      if (a.status === "completed") {
        byDate[a.date].revenue += price;
        byDate[a.date].count += 1;
        totalRevenue += price;
        completedCount += 1;
      } else {
        expectedRevenue += price; // pending/confirmed: abhi kamai nahi, sirf anumaan
      }
      if (a.service) {
        const key = String(a.service._id);
        services[key] = services[key] || { name: a.service.name, count: 0, revenue: 0 };
        services[key].count += 1;
        if (a.status === "completed") services[key].revenue += price;
      }
    }
    const topServices = Object.values(services).sort((x, y) => y.count - x.count).slice(0, 5);
    res.json({ range, days, totalRevenue, completedCount, expectedRevenue, topServices });
  } catch (error) {
    res.status(500).json({ message: "Stats load nahi ho paye", error: error.message });
  }
});

// Admin: list only this shop's appointments
router.get("/", protectAdmin, async (req, res) => {
  try {
    const filter = { shopId: req.admin.shopId };
    if (req.query.date) filter.date = req.query.date;
    if (req.query.status) filter.status = req.query.status;
    const q = String(req.query.q || "").trim().slice(0, 50);
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ customerName: rx }, { customerPhone: rx }];
    }
    const appointments = await Appointment.find(filter)
      .populate("service", "name price durationMinutes")
      .populate("stylist", "name specialty")
      .sort({ date: 1, timeSlot: 1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Appointments load nahi ho payi", error: error.message });
  }
});

router.put("/:id/status", protectAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, shopId: req.admin.shopId }, { status }, { new: true, runValidators: true }
    ).populate("service", "name price durationMinutes").populate("stylist", "name specialty");
    if (!appointment) return res.status(404).json({ message: "Appointment nahi mila" });
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: "Status update nahi ho paya", error: error.message });
  }
});

router.delete("/:id", protectAdmin, async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndDelete({ _id: req.params.id, shopId: req.admin.shopId });
    if (!appointment) return res.status(404).json({ message: "Appointment nahi mila" });
    res.json({ message: "Appointment delete ho gaya" });
  } catch (error) {
    res.status(500).json({ message: "Appointment delete nahi ho paya", error: error.message });
  }
});

module.exports = router;
