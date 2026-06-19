// routes/email.js — standalone contact form email route
const express = require("express");
const { body, validationResult } = require("express-validator");
const { sendContactEmail } = require("../utils/mailer");
const { submitLimiter }    = require("../middleware/rateLimiter");

const router = express.Router();

// POST /api/email/contact — contact form submission
router.post(
  "/contact",
  submitLimiter,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("phone").matches(/^[6-9]\d{9}$/).withMessage("Valid Indian mobile number required"),
    body("email").optional().isEmail().withMessage("Valid email required"),
    body("loanType").notEmpty().withMessage("Loan type required"),
    body("message").optional().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    try {
      await sendContactEmail(req.body);
      res.json({ success: true, message: "Message sent! We will contact you within 2 hours." });
    } catch (err) {
      console.error("Contact email error:", err);
      // Still return success to user if email fails (log internally)
      res.json({ success: true, message: "Message received! We will contact you soon." });
    }
  }
);

module.exports = router;
