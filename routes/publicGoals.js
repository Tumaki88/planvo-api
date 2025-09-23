import express from "express";
import pool from "../db.js";
import { applyTimeframeReset } from "../utils/timeframe.js";

const router = express.Router();

// Handle GET /
router.get("/", async (req, res) => {
  try {
    const sort = String(req.query.sort || "").toLowerCase();
    let orderBy = "g.created_at DESC";
    if (sort === "likes") orderBy = "g.likes_count DESC, g.created_at DESC";

    const { rows } = await pool.query(
      `SELECT g.id, g.username, g.title, g.description, g.motivation, g.slug, g.timeframe, g.category, g.public,
              g.created_at, g.updated_at, COALESCE(g.likes_count, 0) AS likes_count
       FROM goals g
       WHERE g.public = true
       ORDER BY ${orderBy}`
    );
    return res.json(rows);
  } catch (err) {
    console.error("publicGoals.list:", err);
    return res.status(500).json({ error: "Failed to load public goals" });
  }
});

// Handle GET /:username/:slug
router.get("/:username/:slug", async (req, res) => {
  const { username, slug } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.username, g.title, g.description, g.motivation, g.slug, g.timeframe, g.category, g.public,
              g.created_at, g.updated_at, COALESCE(g.likes_count, 0) AS likes_count
       FROM goals g
       WHERE g.public = true AND g.username = $1 AND g.slug = $2
       LIMIT 1`,
      [username, slug]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const goal = rows[0];
    const { rows: journal } = await pool.query(
      `SELECT id, goal_id, username, note, progress, created_at
       FROM journal WHERE goal_id = $1 ORDER BY created_at DESC`,
      [goal.id]
    );
    goal.journal = journal;
    return res.json(goal ? applyTimeframeReset(goal) : null);
  } catch (err) {
    console.error("publicGoals.detail:", err);
    return res.status(500).json({ error: "Failed to load goal" });
  }
});

export default router;
