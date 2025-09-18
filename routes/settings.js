import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";
import auth from "../middleware/auth.js";

const router = express.Router();

// GET user settings
router.get("/", auth, async (req, res) => {
  const username = req.user.username;
  const result = await pool.query("SELECT username, created_at FROM users WHERE username = $1", [username]);
  res.json(result.rows[0]);
});

// UPDATE password
router.put("/password", auth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: "Missing newPassword" });

  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE users SET password = $1 WHERE username = $2", [hashed, req.user.username]);
  res.json({ success: true });
});

// DELETE account
router.delete("/", auth, async (req, res) => {
  const username = req.user.username;

  await pool.query("DELETE FROM journal WHERE goal_id IN (SELECT id FROM goals WHERE username = $1)", [username]);
  await pool.query("DELETE FROM goals WHERE username = $1", [username]);
  await pool.query("DELETE FROM users WHERE username = $1", [username]);

  res.json({ success: true });
});

export default router;
