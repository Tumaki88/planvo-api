import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Get journal entries
// If goal_id is provided, return that goal's entries (owned by user)
// If missing, return recent entries across all goals owned by user
router.get("/", auth, async (req, res) => {
  try {
    const username = req.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const { goal_id } = req.query;

    if (goal_id) {
      // Ensure goal belongs to logged-in user
      const goalCheck = await pool.query("SELECT 1 FROM goals WHERE id = $1 AND username = $2", [goal_id, username]);
      if (goalCheck.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

      const result = await pool.query("SELECT * FROM journal WHERE goal_id = $1 ORDER BY created_at DESC", [goal_id]);
      return res.json(result.rows);
    }

    // No goal_id: return user's recent journal entries across all their goals
    const result = await pool.query(
      `SELECT j.*
       FROM journal j
       JOIN goals g ON j.goal_id = g.id
       WHERE g.username = $1
       ORDER BY j.created_at DESC
       LIMIT 500`,
      [username]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("GET /journal error", err);
    res.status(500).json({ error: "Failed to load journal" });
  }
});

// Add a journal entry
router.post("/", auth, async (req, res) => {
  try {
    const username = req.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const { goal_id, note, progress } = req.body;
    if (!goal_id || progress === undefined) return res.status(400).json({ error: "Missing fields" });

    if (typeof progress !== "number" || progress < 0 || progress > 100)
      return res.status(400).json({ error: "`progress` must be 0–100" });

    // Ensure goal belongs to user
    const goalCheck = await pool.query("SELECT 1 FROM goals WHERE id = $1 AND username = $2", [goal_id, username]);
    if (goalCheck.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

    // Include username to satisfy NOT NULL if present in schema
    const insert = await pool.query(
      "INSERT INTO journal (goal_id, username, note, progress, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *",
      [goal_id, username, note || "", progress]
    );

    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error("POST /journal error", err);
    res.status(500).json({ error: "Failed to add journal" });
  }
});

// Delete a journal entry
router.delete("/:id", auth, async (req, res) => {
  try {
    const username = req.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    // Ensure entry belongs to user's goal
    const check = await pool.query(
      "SELECT j.id FROM journal j JOIN goals g ON j.goal_id = g.id WHERE j.id = $1 AND g.username = $2",
      [id, username]
    );
    if (check.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

    await pool.query("DELETE FROM journal WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /journal/:id error", err);
    res.status(500).json({ error: "Failed to delete journal" });
  }
});

export default router;
