import express from "express";
import pool from "../db.js";

const router = express.Router();

// Get entries for a specific user
router.get("/", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Username required" });

    const result = await pool.query(
      `SELECT e.*, g.title AS goal_title 
       FROM entries e 
       JOIN goals g ON e.goal_id = g.id 
       WHERE g.username = $1`,
      [username]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch entries" });
  }
});

// Create a new entry
router.post("/", async (req, res) => {
  try {
    const { goal_id, progress, note, username } = req.body;
    if (!goal_id || !username)
      return res.status(400).json({ error: "Goal ID & username required" });

    // Optional: validate that goal_id belongs to the user
    const goalCheck = await pool.query(
      "SELECT * FROM goals WHERE id = $1 AND username = $2",
      [goal_id, username]
    );
    if (goalCheck.rows.length === 0)
      return res.status(403).json({ error: "Goal does not belong to this user" });

    const insert = await pool.query(
      "INSERT INTO entries (goal_id, progress, note) VALUES ($1, $2, $3) RETURNING *",
      [goal_id, progress, note]
    );

    res.json(insert.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create entry" });
  }
});

export default router;
