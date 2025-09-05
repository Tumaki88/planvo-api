// backend/routes/auth.js
import express from "express";
import pool from "../db.js"; // Make sure this exports a working pool
import bcrypt from "bcrypt";

const router = express.Router();

// SIGNUP
router.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Missing fields" });

  try {
    // Check if user exists
    const [existing] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (existing.length > 0)
      return res.status(400).json({ error: "Username already exists" });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Insert user
    await pool.query(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashed]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    if (!user.password) return res.status(500).json({ error: "No password stored" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
// CHANGE PASSWORD
router.post("/change-password", async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  if (!username || !oldPassword || !newPassword) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });

    const user = rows[0];
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(401).json({ error: "Old password incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = ? WHERE username = ?", [
      hashed,
      username,
    ]);

    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    console.error("change-password:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE ACCOUNT
// DELETE ACCOUNT
router.delete("/delete-account", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    // Delete journals tied to user's goals
    await pool.query(
      "DELETE FROM journal WHERE goal_id IN (SELECT id FROM goals WHERE username = ?)",
      [username]
    );

    // Delete goals
    await pool.query("DELETE FROM goals WHERE username = ?", [username]);

    // Delete user
    const [result] = await pool.query("DELETE FROM users WHERE username = ?", [
      username,
    ]);

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "User not found" });

    res.json({ success: true, message: "Account and all data deleted" });
  } catch (err) {
    console.error("Error deleting account:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
