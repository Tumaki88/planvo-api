import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const username = req.user.username;

  const result = await pool.query(
    `SELECT e.*, g.title AS goal_title 
     FROM entries e JOIN goals g ON e.goal_id = g.id 
     WHERE g.username = $1`,
    [username]
  );

  res.json(result.rows);
});

router.post("/", auth, async (req, res) => {
  const { goal_id, progress, note } = req.body;
  if (!goal_id) return res.status(400).json({ error: "Goal ID required" });

  // Check ownership
  const goalCheck = await pool.query("SELECT * FROM goals WHERE id = $1 AND username = $2", [goal_id, req.user.username]);
  if (goalCheck.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

  const insert = await pool.query(
    "INSERT INTO entries (goal_id, progress, note) VALUES ($1, $2, $3) RETURNING *",
    [goal_id, progress, note || ""]
  );

  res.json(insert.rows[0]);
});

export default router;
