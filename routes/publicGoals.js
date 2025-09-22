// backend/routes/publicGoals.js
import express from "express";
import pool from "../db.js";
const { applyTimeframeReset } = require('../utils/timeframe');

const router = express.Router();

// Handle GET /:username/:slug
router.get("/:username/:slug", async (req, res) => {
  const { username, slug } = req.params;

  try {
    // Fetch the public goal
    const goalResult = await pool.query(
      "SELECT * FROM goals WHERE username = $1 AND slug = $2 AND public = true LIMIT 1",
      [username, slug]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const goal = goalResult.rows[0];

    // Attach journal entries
    const entriesResult = await pool.query(
      "SELECT * FROM journal WHERE goal_id = $1 ORDER BY created_at DESC",
      [goal.id]
    );

    goal.journal = entriesResult.rows;
    res.json(goal ? applyTimeframeReset(goal) : null);
  } catch (err) {
    console.error("Error fetching public goal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
