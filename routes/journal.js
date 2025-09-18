import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Get journal entries for a goal (only logged-in user's goals)
router.get("/", auth, async (req, res) => {
  const { goal_id } = req.query;
  if (!goal_id) return res.status(400).json({ error: "Missing goal_id" });

  // Ensure goal belongs to logged-in user
  const goalCheck = await pool.query("SELECT * FROM goals WHERE id = $1 AND username = $2", [goal_id, req.user.username]);
  if (goalCheck.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

  const result = await pool.query("SELECT * FROM journal WHERE goal_id = $1 ORDER BY created_at DESC", [goal_id]);
  res.json(result.rows);
});

// Add a journal entry
router.post("/", auth, async (req, res) => {
  const { goal_id, note, progress } = req.body;
  if (!goal_id || progress === undefined) return res.status(400).json({ error: "Missing fields" });

  if (typeof progress !== "number" || progress < 0 || progress > 100)
    return res.status(400).json({ error: "`progress` must be 0–100" });

  // Ensure goal belongs to user
  const goalCheck = await pool.query("SELECT * FROM goals WHERE id = $1 AND username = $2", [goal_id, req.user.username]);
  if (goalCheck.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

  const insert = await pool.query(
    "INSERT INTO journal (goal_id, note, progress, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *",
    [goal_id, note || "", progress]
  );

  res.status(201).json(insert.rows[0]);
});

// Delete a journal entry
router.delete("/:id", auth, async (req, res) => {
  const { id } = req.params;

  // Ensure entry belongs to user's goal
  const check = await pool.query(
    "SELECT j.* FROM journal j JOIN goals g ON j.goal_id = g.id WHERE j.id = $1 AND g.username = $2",
    [id, req.user.username]
  );
  if (check.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

  await pool.query("DELETE FROM journal WHERE id = $1", [id]);
  res.json({ success: true });
});

export default router;
