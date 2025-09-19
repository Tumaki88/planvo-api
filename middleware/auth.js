// backend/middleware/auth.js
import jwt from "jsonwebtoken";
import pool from "../db.js"; // used as fallback to resolve username from id

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    const token = authHeader?.split?.(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error("JWT verify error:", err?.message || err);
      return res.status(401).json({ error: "Invalid token" });
    }

    // decoded should ideally contain { id, username }
    let { id, username } = decoded || {};

    // If token has id but no username, fetch username from DB as a fallback
    if (!username && id) {
      try {
        const r = await pool.query("SELECT username FROM users WHERE id = $1", [id]);
        if (r.rows.length > 0) username = r.rows[0].username;
      } catch (dbErr) {
        console.error("Auth DB lookup error:", dbErr);
      }
    }

    if (!username) {
      return res.status(401).json({ error: "Token missing username" });
    }

    req.user = { id: id ?? null, username };
    next();
  } catch (err) {
    console.error("Auth middleware unexpected error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};

export default auth;
