import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // DEBUG: log decoded token
    console.log("Decoded JWT:", decoded);

    if (!decoded.username) {
      return res.status(401).json({ error: "Token missing username" });
    }

    req.user = { username: decoded.username };
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};

export default auth;
