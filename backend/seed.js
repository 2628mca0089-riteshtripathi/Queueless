// Ye script database me starting data daal deta hai:
// - Ek admin account
// - Kuch services
// - Kuch stylists
//
// Run karne ke liye: npm run seed

require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const mongoose = require("mongoose");

const Admin = require("./models/Admin");
const Shop = require("./models/Shop");
const Service = require("./models/Service");
const Stylist = require("./models/Stylist");

const seed = async () => {
  await connectDB();

  try {
    // ---------- Default shop + legacy data migration ----------
    let defaultShop = await Shop.findOne({ slug: "glow-and-co" });
    if (!defaultShop) {
      defaultShop = await Shop.create({
        name: "Glow & Co.", slug: "glow-and-co", status: "approved", ownerName: "Salon Admin",
        phone: "0000000000", email: (process.env.ADMIN_EMAIL || "admin@smartsalon.com").toLowerCase(),
        address: "Update your salon address"
      });
    }
    await Admin.updateMany({ shopId: { $exists: false } }, { $set: { shopId: defaultShop._id } });
    await Service.updateMany({ shopId: { $exists: false } }, { $set: { shopId: defaultShop._id } });
    await Stylist.updateMany({ shopId: { $exists: false } }, { $set: { shopId: defaultShop._id } });
    const Appointment = require("./models/Appointment");
    await Appointment.updateMany({ shopId: { $exists: false } }, { $set: { shopId: defaultShop._id } });

    await Shop.updateMany({ status: { $exists: false } }, { $set: { status: "approved" } });

    // ---------- Super Admin (optional: SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD .env me do) ----------
    if (process.env.SUPERADMIN_EMAIL && process.env.SUPERADMIN_PASSWORD) {
      const sEmail = process.env.SUPERADMIN_EMAIL.toLowerCase().trim();
      if (!(await Admin.findOne({ email: sEmail }))) {
        await Admin.create({ email: sEmail, password: await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 12), name: "Super Admin", role: "superadmin" });
        console.log(`✅ Super admin banaya gaya -> ${sEmail}`);
      }
    }

    // ---------- Admin ----------
    const adminEmail = (
      process.env.ADMIN_EMAIL || "admin@smartsalon.com"
    ).toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

    const existingAdmin = await Admin.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hashed = await bcrypt.hash(adminPassword, 10);
      await Admin.create({
        email: adminEmail,
        password: hashed,
        name: "Salon Admin",
        shopId: defaultShop._id,
      });
      console.log(
        `✅ Admin banaya gaya -> email: ${adminEmail} | password: ${adminPassword}`,
      );
    } else {
      if (!existingAdmin.shopId) { existingAdmin.shopId = defaultShop._id; await existingAdmin.save(); }
      console.log("ℹ️  Admin pehle se maujood hai, skip kar diya");
    }

    // ---------- Services ----------
    const serviceCount = await Service.countDocuments();
    if (serviceCount === 0) {
      await Service.insertMany([
        {
          shopId: defaultShop._id,
          name: "Haircut & Styling",
          category: "Hair",
          price: 399,
          durationMinutes: 45,
          description: "Wash, cut aur blow-dry styling",
        },
        {
          name: "Hair Spa",
          category: "Hair",
          price: 899,
          durationMinutes: 60,
          description: "Deep conditioning aur nourishing hair spa",
        },
        {
          name: "Global Hair Color",
          category: "Hair",
          price: 1999,
          durationMinutes: 90,
          description: "Full hair coloring, ammonia-free",
        },
        {
          name: "Classic Facial",
          category: "Skin",
          price: 699,
          durationMinutes: 45,
          description: "Cleansing, exfoliation aur glow facial",
        },
        {
          name: "Gold Facial",
          category: "Skin",
          price: 1499,
          durationMinutes: 60,
          description: "Premium 24k gold radiance facial",
        },
        {
          name: "Manicure",
          category: "Nails",
          price: 349,
          durationMinutes: 30,
          description: "Nail shaping, cuticle care aur polish",
        },
        {
          name: "Pedicure",
          category: "Nails",
          price: 449,
          durationMinutes: 40,
          description: "Foot spa, scrub aur polish",
        },
        {
          name: "Bridal Makeup",
          category: "Makeup",
          price: 4999,
          durationMinutes: 120,
          description: "HD bridal makeup with trial",
        },
        {
          name: "Full Body Massage",
          category: "Spa",
          price: 1299,
          durationMinutes: 60,
          description: "Relaxing aromatherapy body massage",
        },
      ].map((item) => ({ ...item, shopId: defaultShop._id })));
      console.log("✅ Services seed ho gayi");
    } else {
      console.log("ℹ️  Services pehle se maujood hain, skip kar diya");
    }

    // ---------- Stylists ----------
    const stylistCount = await Stylist.countDocuments();
    if (stylistCount === 0) {
      await Stylist.insertMany([
        {
          name: "Priya Sharma",
          specialty: "Senior Hair Stylist",
          experienceYears: 8,
          workStart: "10:00",
          workEnd: "19:00",
          weeklyOff: [1],
        },
        {
          name: "Rahul Verma",
          specialty: "Color Expert",
          experienceYears: 6,
          workStart: "10:00",
          workEnd: "19:00",
          weeklyOff: [2],
        },
        {
          name: "Ananya Singh",
          specialty: "Skin & Facial Specialist",
          experienceYears: 5,
          workStart: "11:00",
          workEnd: "20:00",
          weeklyOff: [1],
        },
        {
          name: "Karan Mehta",
          specialty: "Makeup Artist",
          experienceYears: 7,
          workStart: "10:00",
          workEnd: "18:00",
          weeklyOff: [3],
        },
      ].map((item) => ({ ...item, shopId: defaultShop._id })));
      console.log("✅ Stylists seed ho gaye");
    } else {
      console.log("ℹ️  Stylists pehle se maujood hain, skip kar diya");
    }

    console.log("🎉 Seeding complete!");
  } catch (error) {
    console.error("❌ Seeding error:", error.message);
  } finally {
    mongoose.connection.close();
  }
};

seed();
