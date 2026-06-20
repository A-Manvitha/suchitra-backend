// utils/mailer.js — Email sending via Resend API (HTTPS) + email templates
//
// Why Resend instead of Nodemailer/SMTP?
// Render's free tier blocks outbound SMTP ports (587/465/25) to prevent spam abuse,
// which causes ETIMEDOUT errors no matter how SMTP is configured. Resend sends
// email over a normal HTTPS API call (port 443), which is never blocked.
// Free tier: 3,000 emails/month, 100/day — plenty for a lead-gen site.
//
// Setup: 1) Sign up free at resend.com  2) Get your API key
//        3) Set RESEND_API_KEY in .env / Render dashboard
//        4) (Optional) Verify your own domain in Resend for a custom "from" address.
//           Until verified, use the default: onboarding@resend.dev as EMAIL_FROM.

const { Resend } = require("resend");
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_ADDRESS = process.env.EMAIL_FROM || "Suchitra Financial Services <onboarding@resend.dev>";
const REPLY_TO = process.env.ADMIN_EMAIL; // hitting "Reply" on any email goes to your real Gmail

// ── Send helper — wraps Resend API call with consistent logging ──────────────
async function sendMail({ to, subject, html }) {
  if (!resend) {
    console.warn("⚠️  RESEND_API_KEY not set — email skipped:", subject);
    return;
  }
  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
    });
    if (result.error) {
      console.error("❌ Resend API error:", result.error.message || result.error);
    } else {
      console.log("✅ Email sent:", subject, "→", to, "| id:", result.data?.id);
    }
  } catch (err) {
    console.error("❌ Email send failed:", err.message);
  }
}

// ── HTML template helpers ────────────────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin:0; padding:0; background:#F7F8FC; font-family:'Segoe UI',sans-serif; }
    .wrapper { max-width:600px; margin:30px auto; background:#fff; border-radius:12px;
               box-shadow:0 4px 24px rgba(11,29,58,0.10); overflow:hidden; }
    .header  { background:linear-gradient(135deg,#0B1D3A 0%,#1B3A6A 100%);
               padding:32px 32px 28px; text-align:center; }
    .header img { height:56px; border-radius:8px; background:#fff; padding:4px 8px; }
    .header h1 { color:#E8B84B; margin:12px 0 4px; font-size:22px; }
    .header p  { color:#9DB8D8; margin:0; font-size:13px; }
    .body   { padding:32px; }
    .label  { font-size:12px; font-weight:700; color:#6B7A90; text-transform:uppercase;
              letter-spacing:0.5px; margin-bottom:4px; }
    .value  { font-size:15px; color:#0D1B2A; font-weight:500; margin-bottom:18px; }
    .badge  { display:inline-block; background:#E8F5FF; color:#0055AA; border-radius:6px;
              padding:4px 12px; font-size:13px; font-weight:700; }
    .btn    { display:inline-block; background:#C9941A; color:#fff; padding:14px 32px;
              border-radius:8px; text-decoration:none; font-weight:700; font-size:15px; }
    .divider{ border:none; border-top:1px solid #EEF0F5; margin:24px 0; }
    .footer { background:#070F1D; padding:20px 32px; text-align:center;
              color:#7A8FA3; font-size:12px; }
    .footer a { color:#E8B84B; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Suchitra Financial Services</h1>
      <p>Your Trusted Partner for Financial Solutions</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      © 2024 Suchitra Financial Services &nbsp;|&nbsp;
      <a href="https://wa.me/919949903372">WhatsApp</a> &nbsp;|&nbsp;
      +91 99499 03372
    </div>
  </div>
</body>
</html>`;

// ── Email: New lead to admin ──────────────────────────────────────────────────
const sendNewLeadEmail = async (lead) => {
  const html = baseTemplate(`
    <h2 style="color:#0B1D3A;margin:0 0 24px">🆕 New Lead Received</h2>
    <div class="label">Name</div>
    <div class="value">${lead.name}</div>
    <div class="label">Phone</div>
    <div class="value"><a href="tel:${lead.phone}">${lead.phone}</a></div>
    <div class="label">Email</div>
    <div class="value">${lead.email || "—"}</div>
    <div class="label">Loan Type</div>
    <div class="value"><span class="badge">${lead.loanType}</span></div>
    <div class="label">Loan Amount</div>
    <div class="value">${lead.loanAmount ? "₹" + Number(lead.loanAmount).toLocaleString("en-IN") : "—"}</div>
    <div class="label">Monthly Income</div>
    <div class="value">${lead.monthlyIncome ? "₹" + Number(lead.monthlyIncome).toLocaleString("en-IN") : "—"}</div>
    <div class="label">Occupation</div>
    <div class="value">${lead.occupation || "—"}</div>
    <div class="label">Message</div>
    <div class="value">${lead.message || "—"}</div>
    <hr class="divider"/>
    <p style="color:#6B7A90;font-size:13px">Submitted on ${new Date().toLocaleString("en-IN")} &nbsp;|&nbsp; Source: ${lead.source || "Website"}</p>
    <p style="text-align:center;margin-top:28px">
      <a class="btn" href="${process.env.ADMIN_URL || "http://localhost:3000"}?page=Admin">View Dashboard →</a>
    </p>
  `);

  await sendMail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `🆕 New ${lead.loanType} Lead — ${lead.name} (${lead.phone})`,
    html,
  });
};

// ── Email: Acknowledgement to applicant ──────────────────────────────────────
const sendAcknowledgementEmail = async (lead) => {
  if (!lead.email) return;
  const html = baseTemplate(`
    <h2 style="color:#0B1D3A;margin:0 0 8px">Thank you, ${lead.name.split(" ")[0]}! 🙏</h2>
    <p style="color:#3D4E63;margin:0 0 24px;line-height:1.7">
      We have received your enquiry for a <strong>${lead.loanType}</strong>.
      Our team will contact you within <strong>2 business hours</strong> to discuss the best options available.
    </p>
    <div style="background:#F7F8FC;border-radius:10px;padding:20px;margin-bottom:24px">
      <div class="label">Reference Number</div>
      <div class="value" style="font-family:monospace;font-size:16px;color:#1B4F8A">SFS-${Date.now().toString(36).toUpperCase()}</div>
      <div class="label">Loan Type</div>
      <div class="value"><span class="badge">${lead.loanType}</span></div>
      <div class="label">Registered Phone</div>
      <div class="value">${lead.phone}</div>
    </div>
    <p style="color:#3D4E63;font-size:14px;line-height:1.7">
      Need immediate assistance?
      <a href="https://wa.me/919949903372" style="color:#C9941A;font-weight:700;">WhatsApp us</a>
      or call <a href="tel:+919949903372" style="color:#C9941A;font-weight:700;">+91 99499 03372</a>.
    </p>
    <p style="text-align:center;margin-top:28px">
      <a class="btn" href="https://wa.me/919949903372">💬 Chat on WhatsApp</a>
    </p>
  `);

  await sendMail({
    to: lead.email,
    subject: `We received your ${lead.loanType} enquiry — Suchitra Financial Services`,
    html,
  });
};

// ── Email: Status update to lead ─────────────────────────────────────────────
const sendStatusUpdateEmail = async (lead, newStatus) => {
  if (!lead.email) return;

  const statusMessages = {
    "In Progress": { emoji: "⚡", text: "Your application is now being processed by our team." },
    "Approved":    { emoji: "✅", text: "Great news! Your loan application has been approved. Our team will contact you to share next steps." },
    "Rejected":    { emoji: "❌", text: "We regret to inform you that your application could not be processed at this time. Please contact us for alternatives." },
    "On Hold":     { emoji: "⏸️", text: "Your application is on hold pending additional documentation. We will contact you shortly." },
  };

  const info = statusMessages[newStatus] || { emoji: "ℹ️", text: "Your application status has been updated." };

  const html = baseTemplate(`
    <h2 style="color:#0B1D3A;margin:0 0 8px">${info.emoji} Application Update</h2>
    <p style="color:#3D4E63;margin:0 0 24px;line-height:1.7">Dear <strong>${lead.name.split(" ")[0]}</strong>,</p>
    <p style="color:#3D4E63;margin:0 0 24px;line-height:1.7">${info.text}</p>
    <div style="background:#F7F8FC;border-radius:10px;padding:20px;margin-bottom:24px">
      <div class="label">Current Status</div>
      <div class="value"><span class="badge">${newStatus}</span></div>
      <div class="label">Loan Type</div>
      <div class="value">${lead.loanType}</div>
    </div>
    <p style="text-align:center;margin-top:28px">
      <a class="btn" href="https://wa.me/919949903372">Contact Us →</a>
    </p>
  `);

  await sendMail({
    to: lead.email,
    subject: `${info.emoji} ${newStatus}: Your ${lead.loanType} Application — Suchitra Financial Services`,
    html,
  });
};

// ── Email: General contact form ───────────────────────────────────────────────
const sendContactEmail = async ({ name, phone, email, loanType, message }) => {
  const html = baseTemplate(`
    <h2 style="color:#0B1D3A;margin:0 0 24px">📩 New Contact Form Submission</h2>
    <div class="label">Name</div><div class="value">${name}</div>
    <div class="label">Phone</div><div class="value">${phone}</div>
    <div class="label">Email</div><div class="value">${email || "—"}</div>
    <div class="label">Interested In</div><div class="value"><span class="badge">${loanType}</span></div>
    <div class="label">Message</div><div class="value">${message || "—"}</div>
  `);

  await sendMail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `📩 Contact Form: ${name} (${phone})`,
    html,
  });
};

module.exports = {
  sendNewLeadEmail,
  sendAcknowledgementEmail,
  sendStatusUpdateEmail,
  sendContactEmail,
};