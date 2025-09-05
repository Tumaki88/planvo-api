// routes/journal.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

/* ------------------- Get journal entries for a goal ------------------- */
router.get("/", async (req, res) => {
  const { goal_id } = req.query;
  if (!goal_id) return res.status(400).json({ error: "Missing goal_id" });

  try {
    const result = await pool.query(
      "SELECT * FROM journal WHERE goal_id = $1 ORDER BY created_at DESC",
      [goal_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching journal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- Add a journal entry ------------------- */
router.post("/", async (req, res) => {
  const { goal_id, username, note, progress } = req.body;
  if (!goal_id || !username || progress === undefined) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (typeof progress !== "number" || progress < 0 || progress > 100) {
    return res.status(400).json({ error: "`progress` must be a number 0–100" });
  }

  try {
    const insert = await pool.query(
      `INSERT INTO journal (goal_id, username, note, progress, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [goal_id, username, note || "", progress]
    );

    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error("Error inserting journal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- Delete a journal entry ------------------- */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM journal WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Journal entry not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting journal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
