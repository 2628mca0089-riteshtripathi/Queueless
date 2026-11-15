const Appointment = require("../models/Appointment");
require("../models/Shop");
const { sendMail } = require("../utils/mailer");

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const t12 = (t) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`; };

// Appointment shuru hone se 2 ghante ke andar wale customers ko ek baar reminder bhejta hai
async function sendDueReminders() {
  const now = new Date();
  const limit = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const list = await Appointment.find({
    status: { $in: ["pending", "confirmed"] },
    reminderSent: { $ne: true },
    customerEmail: { $nin: ["", null] },
    date: { $in: [ymd(now), ymd(limit)] },
  }).populate("shopId", "name address phone");

  for (const a of list) {
    const [h, m] = a.timeSlot.split(":").map(Number);
    const [Y, M, D] = a.date.split("-").map(Number);
    const start = new Date(Y, M - 1, D, h, m);
    if (start <= now || start > limit) continue;
    const shop = a.shopId || {};
    const ok = await sendMail({
      to: a.customerEmail,
      subject: `Reminder: ${shop.name || "Salon"} me aaj ${t12(a.timeSlot)} par appointment`,
      text: `Namaste ${a.customerName},\n\nAapki appointment aaj ${t12(a.timeSlot)} par ${shop.name || "salon"} me hai.\n${shop.address ? "Address: " + shop.address + "\n" : ""}${shop.phone ? "Phone: " + shop.phone + "\n" : ""}\nDhanyavaad!`,
    });
    if (ok) { a.reminderSent = true; await a.save(); }
  }
}

function startReminderJob() {
  const run = () => sendDueReminders().catch((e) => console.error("Reminder error:", e.message));
  setInterval(run, 10 * 60 * 1000);
  run();
}
module.exports = { startReminderJob };
