import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    // Accept tokens regardless of exp so users stay logged in until they log out
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    req.user = { username: decoded.username };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

export default auth;
