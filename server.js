// ─────────────────────────────────────────────────────────────────────────────
// Suchitra Financial Services — Backend Server
// ─────────────────────────────────────────────────────────────────────────────
const express  = require("express");
const cors     = require("cors");
const helmet   = require("helmet");
const morgan   = require("morgan");
const mongoose = require("mongoose");
require("dotenv").config();

const authRoutes  = require("./routes/auth");
const leadRoutes  = require("./routes/leads");
const emailRoutes = require("./routes/email");

const app = express();

// ── Security & Middleware ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",  authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/email", emailRoutes);

// ── Health Check ──────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Suchitra Financial Services API",
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Global Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Server error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ── Database + Server Start ────────────────────────────────────────────────
const PORT    = process.env.PORT || 5000;
const MONGODB = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/suchitra_financial";

mongoose
  .connect(MONGODB)
  .then(() => {
    console.log("✅  MongoDB connected:", MONGODB);
    app.listen(PORT, () =>
      console.log(`🚀  Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌  MongoDB connection failed:", err.message);
    console.log("ℹ️   Starting server WITHOUT database (demo mode)…");
    app.listen(PORT, () =>
      console.log(`🚀  Server running on http://localhost:${PORT} [no DB]`)
    );
  });

module.exports = app;
