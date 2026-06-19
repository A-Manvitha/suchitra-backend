// routes/auth.js — Admin authentication routes
const express = require("express");
const jwt     = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User   = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || "suchitra_secret_2024", {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;

    try {
      // Explicitly select password (it's hidden by default)
      const user = await User.findOne({ email }).select("+password");
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ success: false, message: "Invalid email or password" });
      }
      if (!user.isActive) {
        return res.status(401).json({ success: false, message: "Account deactivated. Contact superadmin." });
      }

      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      const token = signToken(user._id);
      res.json({
        success: true,
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ── POST /api/auth/register  (superadmin only after first run) ────────────────
router.post(
  "/register",
  protect,
  authorize("superadmin"),
  [
    body("name").trim().notEmpty().withMessage("Name required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Password min 6 chars"),
    body("role").optional().isIn(["admin", "viewer"]).withMessage("Role must be admin or viewer"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, password, role } = req.body;
    try {
      if (await User.findOne({ email }))
        return res.status(400).json({ success: false, message: "Email already registered" });

      const user = await User.create({ name, email, password, role: role || "admin" });
      res.status(201).json({
        success: true,
        message: "User created",
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── POST /api/auth/seed  (one-time: create default superadmin) ────────────────
// Disable or protect this in production!
router.post("/seed", async (req, res) => {
  try {
    const exists = await User.findOne({ role: "superadmin" });
    if (exists)
      return res.status(400).json({ success: false, message: "Superadmin already exists" });

    const admin = await User.create({
      name: "Admin",
      email: process.env.ADMIN_EMAIL || "admin@suchitrafinancial.com",
      password: process.env.ADMIN_PASSWORD || "Admin@123",
      role: "superadmin",
    });

    res.status(201).json({
      success: true,
      message: "Superadmin created. Change the default password immediately!",
      email: admin.email,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
  });
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
router.put(
  "/change-password",
  protect,
  [
    body("currentPassword").notEmpty().withMessage("Current password required"),
    body("newPassword").isLength({ min: 6 }).withMessage("New password min 6 chars"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { currentPassword, newPassword } = req.body;
    try {
      const user = await User.findById(req.user._id).select("+password");
      if (!(await user.comparePassword(currentPassword)))
        return res.status(400).json({ success: false, message: "Current password incorrect" });

      user.password = newPassword;
      await user.save();
      res.json({ success: true, message: "Password changed successfully" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
