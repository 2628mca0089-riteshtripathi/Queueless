require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

const Admin = require("./models/Admin");
const Shop = require("./models/Shop");
const Service = require("./models/Service");
const Stylist = require("./models/Stylist");
const Appointment = require("./models/Appointment");

const demoShops = [
  { name: "Velvet & Vibe", slug: "velvet-and-vibe", ownerName: "Aarav Mehta", phone: "9876543210", email: "demo1@queueless.com", address: "12 MG Road, Central Jaipur", description: "Premium hair styling and modern grooming.", openTime: "09:30", closeTime: "20:30" },
  { name: "Urban Crown Salon", slug: "urban-crown-salon", ownerName: "Sneha Kapoor", phone: "9876543211", email: "demo2@queueless.com", address: "45 Park Street, South Kolkata", description: "Trendy cuts, expert color and bridal looks.", openTime: "10:00", closeTime: "21:00" },
  { name: "Luxe Glow Studio", slug: "luxe-glow-studio", ownerName: "Riya Malhotra", phone: "9876543212", email: "demo3@queueless.com", address: "18 Brigade Road, Bengaluru", description: "Luxury facials, skincare and makeup services.", openTime: "10:00", closeTime: "20:00" },
  { name: "The Bridal Loft", slug: "the-bridal-loft", ownerName: "Nisha Arora", phone: "9876543213", email: "demo4@queueless.com", address: "23 Gulmohar Avenue, New Delhi", description: "Bridal makeup, hair styling and occasion looks.", openTime: "08:00", closeTime: "19:00" },
  { name: "Serenity Spa & Salon", slug: "serenity-spa-salon", ownerName: "Kabir Shah", phone: "9876543214", email: "demo5@queueless.com", address: "7 Lake View Road, Pune", description: "Relaxing spa therapies and complete salon care.", openTime: "09:00", closeTime: "21:00" },
];

const serviceTemplates = [
  { name: "Signature Haircut", category: "Hair", price: 499, durationMinutes: 45, description: "Consultation, precision haircut and finishing style." },
  { name: "Hair Spa Ritual", category: "Hair", price: 899, durationMinutes: 60, description: "Deep cleansing, nourishing mask and relaxing massage." },
  { name: "Classic Facial", category: "Skin", price: 799, durationMinutes: 50, description: "Cleansing, exfoliation, massage and hydration." },
  { name: "Premium Manicure", category: "Nails", price: 599, durationMinutes: 40, description: "Nail care, cuticle treatment and polish." },
  { name: "Party Makeup", category: "Makeup", price: 2499, durationMinutes: 90, description: "Professional makeup for parties and special occasions." },
];

const stylistTemplates = [
  { name: "Priya Sharma", specialty: "Senior Hair Stylist", experienceYears: 8, workStart: "10:00", workEnd: "19:00", weeklyOff: [1] },
  { name: "Rahul Verma", specialty: "Color & Grooming Expert", experienceYears: 6, workStart: "10:00", workEnd: "20:00", weeklyOff: [2] },
  { name: "Ananya Singh", specialty: "Skin & Makeup Artist", experienceYears: 5, workStart: "11:00", workEnd: "20:00", weeklyOff: [0] },
];

const seed = async () => {
  await connectDB();
  try {
    const legacyShop = await Shop.findOne({ slug: "glow-and-co" });
    if (legacyShop) {
      await Admin.updateMany({ shopId: { $exists: false } }, { $set: { shopId: legacyShop._id } });
      await Service.updateMany({ shopId: { $exists: false } }, { $set: { shopId: legacyShop._id } });
      await Stylist.updateMany({ shopId: { $exists: false } }, { $set: { shopId: legacyShop._id } });
      await Appointment.updateMany({ shopId: { $exists: false } }, { $set: { shopId: legacyShop._id } });
    }

    for (const demo of demoShops) {
      let shop = await Shop.findOne({ slug: demo.slug });
      if (!shop) {
        shop = await Shop.create({ ...demo, status: "approved", isActive: true });
        console.log(`Created shop: ${demo.name}`);
      } else {
        await Shop.findByIdAndUpdate(shop._id, { ...demo, status: "approved", isActive: true });
        console.log(`Updated shop: ${demo.name}`);
      }

      let admin = await Admin.findOne({ email: demo.email });
      if (!admin) {
        await Admin.create({
          shopId: shop._id,
          email: demo.email,
          password: await bcrypt.hash("Demo@123", 12),
          name: demo.ownerName,
          role: "owner",
        });
      } else if (!admin.shopId) {
        admin.shopId = shop._id;
        await admin.save();
      }

      if (await Service.countDocuments({ shopId: shop._id }) === 0) {
        await Service.insertMany(serviceTemplates.map((item) => ({ ...item, shopId: shop._id })));
      }
      if (await Stylist.countDocuments({ shopId: shop._id }) === 0) {
        await Stylist.insertMany(stylistTemplates.map((item) => ({ ...item, shopId: shop._id })));
      }
    }

    if (process.env.SUPERADMIN_EMAIL && process.env.SUPERADMIN_PASSWORD) {
      const email = process.env.SUPERADMIN_EMAIL.toLowerCase().trim();
      if (!(await Admin.findOne({ email }))) {
        await Admin.create({ email, password: await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 12), name: "Super Admin", role: "superadmin" });
      }
    }

    console.log("Seeding complete: 5 demo shops are ready.");
    console.log("Demo shop login: demo1@queueless.com ... demo5@queueless.com");
    console.log("Demo password: Demo@123");
  } catch (error) {
    console.error("Seeding error:", error.message);
  } finally {
    await mongoose.connection.close();
  }
};

seed();
