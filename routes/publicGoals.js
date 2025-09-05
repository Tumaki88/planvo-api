// backend/routes/publicGoals.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// Handle GET /:username/:slug
router.get("/", async (req, res) => {
  const { username, slug } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM goals WHERE username = ? AND slug = ? AND public = 1 LIMIT 1",
      [username, slug]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const goal = rows[0];

    // Attach journal entries
    const [entries] = await pool.query(
      "SELECT * FROM journal WHERE goal_id = ? ORDER BY created_at DESC",
      [goal.id]
    );

    goal.journal = entries;
    res.json(goal);
  } catch (err) {
    console.error("Error fetching public goal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
