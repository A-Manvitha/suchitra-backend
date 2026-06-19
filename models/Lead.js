// models/Lead.js — Mongoose schema for loan enquiry leads
const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    // ── Basic Info ──────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
      match: [/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Enter a valid email address"],
      default: "",
    },

    // ── Loan Details ────────────────────────────────────────────────────────
    loanType: {
      type: String,
      required: true,
      enum: [
        "Home Loan",
        "Business Loan",
        "Personal Loan",
        "Mortgage / LAP",
        "Project Finance",
        "Balance Transfer",
        "Other",
      ],
      default: "Home Loan",
    },
    loanAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ── Eligibility Info ────────────────────────────────────────────────────
    monthlyIncome: {
      type: Number,
      min: 0,
      default: 0,
    },
    existingEMI: {
      type: Number,
      min: 0,
      default: 0,
    },
    occupation: {
      type: String,
      enum: ["Salaried", "Self-Employed", "Business Owner", "Other"],
      default: "Salaried",
    },

    // ── Message ─────────────────────────────────────────────────────────────
    message: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    // ── Admin Fields ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["New", "In Progress", "Approved", "Rejected", "On Hold"],
      default: "New",
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    assignedTo: {
      type: String,
      default: "",
    },
    followUpDate: {
      type: Date,
    },

    // ── Source Tracking ─────────────────────────────────────────────────────
    source: {
      type: String,
      enum: ["Website", "WhatsApp", "Referral", "Walk-In", "Other"],
      default: "Website",
    },
    utmSource: { type: String, default: "" },
    utmMedium: { type: String, default: "" },
    utmCampaign: { type: String, default: "" },

    // ── Meta ────────────────────────────────────────────────────────────────
    ipAddress: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,           // createdAt, updatedAt
    toJSON:  { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ─────────────────────────────────────────────────────────────────
leadSchema.index({ phone: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ loanType: 1 });

// ── Virtual: formatted amount ────────────────────────────────────────────────
leadSchema.virtual("formattedAmount").get(function () {
  if (!this.loanAmount) return "N/A";
  return "₹" + this.loanAmount.toLocaleString("en-IN");
});

module.exports = mongoose.model("Lead", leadSchema);
