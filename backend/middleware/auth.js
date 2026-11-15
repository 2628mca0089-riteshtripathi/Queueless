const jwt = require("jsonwebtoken");
const Shop = require("../models/Shop");

function readToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.split(" ")[1], process.env.JWT_SECRET); } catch (_e) { return undefined; }
}

// Shop owner/admin ke liye: valid token + shop approved honi chahiye
const protectAdmin = async (req, res, next) => {
  const decoded = readToken(req);
  if (decoded === null) return res.status(401).json({ message: "Not authorized. Token missing." });
  if (!decoded) return res.status(401).json({ message: "Not authorized. Invalid or expired token." });
  if (!decoded.shopId) return res.status(403).json({ message: "Admin account kisi shop se linked nahi hai. npm run seed chalayein." });
  try {
    const shop = await Shop.findById(decoded.shopId).select("status isActive");
    if (!shop || !Shop.isLive(shop)) return res.status(403).json({ message: "Aapki shop approved ya active nahi hai." });
    req.admin = decoded;
    next();
  } catch (_e) { res.status(401).json({ message: "Not authorized." }); }
};

// Sirf super admin ke liye
const protectSuper = (req, res, next) => {
  const decoded = readToken(req);
  if (decoded === null) return res.status(401).json({ message: "Not authorized. Token missing." });
  if (!decoded) return res.status(401).json({ message: "Not authorized. Invalid or expired token." });
  if (decoded.role !== "superadmin") return res.status(403).json({ message: "Sirf super admin ke liye." });
  req.admin = decoded;
  next();
};

module.exports = { protectAdmin, protectSuper };
