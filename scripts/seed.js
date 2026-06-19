// scripts/seed.js — Run once to create the default superadmin account
// Usage: node scripts/seed.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User     = require("../models/User");

const MONGODB = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/suchitra_financial";

(async () => {
  try {
    await mongoose.connect(MONGODB);
    console.log("✅  Connected to MongoDB");

    const exists = await User.findOne({ email: process.env.ADMIN_EMAIL || "admin@suchitrafinancial.com" });
    if (exists) {
      console.log("ℹ️   Superadmin already exists:", exists.email);
      process.exit(0);
    }

    const admin = await User.create({
      name: "Admin",
      email: process.env.ADMIN_EMAIL || "admin@suchitrafinancial.com",
      password: process.env.ADMIN_PASSWORD || "Admin@123",
      role: "superadmin",
    });

    console.log("✅  Superadmin created!");
    console.log("    Email   :", admin.email);
    console.log("    Password:", process.env.ADMIN_PASSWORD || "Admin@123");
    console.log("⚠️   Change the default password immediately after first login.");
    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    process.exit(1);
  }
})();
