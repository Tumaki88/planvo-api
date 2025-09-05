import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";

const router = express.Router();

/**
 * GET user settings
 */
router.get("/", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    const [rows] = await pool.query(
      "SELECT username, created_at FROM users WHERE username = ?",
      [username]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * UPDATE password
 */
router.put("/password", async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = ? WHERE username = ?", [
      hashed,
      username,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE account
 */
router.delete("/", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Missing username" });

  try {
    // delete journal entries first (FK constraints)
    await pool.query("DELETE FROM journal WHERE goal_id IN (SELECT id FROM goals WHERE username = ?)", [username]);
    // delete goals
    await pool.query("DELETE FROM goals WHERE username = ?", [username]);
    // delete user
    await pool.query("DELETE FROM users WHERE username = ?", [username]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
