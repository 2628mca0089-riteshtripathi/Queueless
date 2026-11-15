const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", index: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String, // bcrypt hashed
      required: true,
    },
    role: { type: String, enum: ["owner", "superadmin"], default: "owner" },
    resetTokenHash: { type: String },
    resetExpires: { type: Date },
    name: {
      type: String,
      default: "Salon Admin",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
