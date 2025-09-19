// backend/routes/auth.js
import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "1h";

/* SIGNUP */
router.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rows.length > 0) return res.status(400).json({ error: "Username already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, hashed]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({ success: true, token });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const q = await pool.query("SELECT id, username, password FROM users WHERE username = $1", [username]);
    if (q.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = q.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({ success: true, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
