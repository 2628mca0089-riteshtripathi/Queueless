const nodemailer = require("nodemailer");

const enabled = Boolean(process.env.SMTP_HOST);
const transporter = enabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

// true = mail gaya. SMTP set nahi hai to console me print hota hai (development ke liye).
async function sendMail({ to, subject, text }) {
  if (!to) return false;
  if (!transporter) {
    console.log(`📧 [SMTP not configured]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return false;
  }
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
    return true;
  } catch (e) {
    console.error("Mail error:", e.message);
    return false;
  }
}
module.exports = { sendMail, enabled };
