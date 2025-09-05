// backend/routes/auth.js
import express from "express";
import pool from "../db.js"; // PostgreSQL pool
import bcrypt from "bcrypt";

const router = express.Router();

/**
 * GET user settings
 */
router.get("/", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    const result = await pool.query(
      "SELECT username, created_at FROM users WHERE username = $1",
      [username]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
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
    await pool.query(
      "UPDATE users SET password = $1 WHERE username = $2",
      [hashed, username]
    );
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
    // delete journal entries first
    await pool.query(
      "DELETE FROM journal WHERE goal_id IN (SELECT id FROM goals WHERE username = $1)",
      [username]
    );
    // delete goals
    await pool.query("DELETE FROM goals WHERE username = $1", [username]);
    // delete user
    await pool.query("DELETE FROM users WHERE username = $1", [username]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
