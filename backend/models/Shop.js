const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  ownerName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  address: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  openTime: { type: String, default: "" },   // "HH:MM", khali = koi restriction nahi
  closeTime: { type: String, default: "" },
  holidays: [{ type: String }],              // "YYYY-MM-DD"
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ["pending", "approved", "blocked"], default: "pending" }
}, { timestamps: true });

const Shop = mongoose.model("Shop", shopSchema);
// Purani shops (jinme status field nahi hai) approved maani jaati hain
Shop.isLive = (s) => s.isActive !== false && (s.status || "approved") === "approved";
module.exports = Shop;
