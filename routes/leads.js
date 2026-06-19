// routes/leads.js — Lead management CRUD API
const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const Lead   = require("../models/Lead");
const { protect, authorize } = require("../middleware/auth");
const { submitLimiter }       = require("../middleware/rateLimiter");
const { sendNewLeadEmail, sendAcknowledgementEmail, sendStatusUpdateEmail } = require("../utils/mailer");

const router = express.Router();

// ── Helper: send validation errors ───────────────────────────────────────────
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: POST /api/leads/submit   — website contact / application form
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/submit",
  submitLimiter,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("phone")
      .matches(/^[6-9]\d{9}$/)
      .withMessage("Enter a valid 10-digit Indian mobile number"),
    body("email").optional().isEmail().withMessage("Enter a valid email"),
    body("loanType")
      .isIn(["Home Loan","Business Loan","Personal Loan","Mortgage / LAP","Project Finance","Balance Transfer","Other"])
      .withMessage("Invalid loan type"),
    body("loanAmount").optional().isNumeric(),
    body("monthlyIncome").optional().isNumeric(),
    body("message").optional().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    try {
      const lead = await Lead.create({
        ...req.body,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
        source: req.body.source || "Website",
      });

      // Fire-and-forget emails (don't fail the response on email error)
      sendNewLeadEmail(lead).catch(console.error);
      if (lead.email) sendAcknowledgementEmail(lead).catch(console.error);

      res.status(201).json({
        success: true,
        message: "Your enquiry has been submitted. We will contact you within 2 hours.",
        lead: { id: lead._id, status: lead.status },
      });
    } catch (err) {
      console.error("Lead submit error:", err);
      res.status(500).json({ success: false, message: "Failed to save enquiry. Please try again." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: All routes below require JWT auth
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/leads — paginated list with filters
router.get("/", protect, async (req, res) => {
  try {
    const {
      page = 1, limit = 20, status, loanType, search,
      startDate, endDate, sortBy = "createdAt", sortOrder = "desc",
    } = req.query;

    const filter = { isDeleted: false };

    if (status)   filter.status   = status;
    if (loanType) filter.loanType = loanType;
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate + "T23:59:59Z");
    }

    const total = await Lead.countDocuments(filter);
    const leads = await Lead.find(filter)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({
      success: true,
      total,
      page: +page,
      pages: Math.ceil(total / +limit),
      leads,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/leads/stats — dashboard stats
router.get("/stats", protect, async (req, res) => {
  try {
    const [statusCounts, loanTypeCounts, monthlyTrend] = await Promise.all([
      Lead.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$loanType", count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { isDeleted: false, createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const total = await Lead.countDocuments({ isDeleted: false });
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayCount = await Lead.countDocuments({ createdAt: { $gte: todayStart }, isDeleted: false });

    res.json({
      success: true,
      stats: {
        total,
        todayCount,
        byStatus:   Object.fromEntries(statusCounts.map(s => [s._id, s.count])),
        byLoanType: Object.fromEntries(loanTypeCounts.map(s => [s._id, s.count])),
        monthlyTrend,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/leads/:id
router.get("/:id", protect, async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, isDeleted: false });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/leads/:id/status — update status + send email
router.patch(
  "/:id/status",
  protect,
  [body("status").isIn(["New","In Progress","Approved","Rejected","On Hold"]).withMessage("Invalid status")],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const lead = await Lead.findOneAndUpdate(
        { _id: req.params.id, isDeleted: false },
        { status: req.body.status },
        { new: true }
      );
      if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

      // Notify lead by email on certain status changes
      if (["Approved","Rejected","In Progress"].includes(req.body.status)) {
        sendStatusUpdateEmail(lead, req.body.status).catch(console.error);
      }

      res.json({ success: true, message: "Status updated", lead });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/leads/:id — update notes / follow-up / assignment
router.patch("/:id", protect, async (req, res) => {
  const allowedFields = ["adminNotes","assignedTo","followUpDate","status","loanAmount","monthlyIncome"];
  const update = {};
  allowedFields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

  try {
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      update,
      { new: true, runValidators: true }
    );
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/leads/:id — soft delete (admin only)
router.delete("/:id", protect, authorize("superadmin","admin"), async (req, res) => {
  try {
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id },
      { isDeleted: true },
      { new: true }
    );
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    res.json({ success: true, message: "Lead deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/leads/export/csv — export all leads as CSV
router.get("/export/csv", protect, async (req, res) => {
  try {
    const leads = await Lead.find({ isDeleted: false }).sort({ createdAt: -1 }).lean();
    const header = "ID,Name,Phone,Email,Loan Type,Loan Amount,Income,Occupation,Status,Source,Date";
    const rows = leads.map(l =>
      [
        l._id, `"${l.name}"`, l.phone, l.email || "",
        l.loanType, l.loanAmount || "", l.monthlyIncome || "",
        l.occupation || "", l.status, l.source || "Website",
        new Date(l.createdAt).toLocaleDateString("en-IN"),
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=suchitra_leads_${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
