import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Get all goals for logged-in user
router.get("/", auth, async (req, res) => {
  const username = req.user?.username;
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  const result = await pool.query(
    "SELECT * FROM goals WHERE username = $1 ORDER BY created_at DESC",
    [username]
  );
  res.json(result.rows);
});

// Add a new goal for logged-in user
router.post("/", auth, async (req, res) => {
  const username = req.user?.username;
  const { title, description, category, timeframe, motivation } = req.body;
  if (!username || !title || !category || !timeframe)
    return res.status(400).json({ error: "Missing required fields" });

  const result = await pool.query(
    "INSERT INTO goals (username, title, description, category, timeframe, motivation, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *",
    [username, title, description || "", category, timeframe, motivation || ""]
  );
  res.status(201).json(result.rows[0]);
});

// Update a goal (only if it belongs to user)
router.patch("/:id", auth, async (req, res) => {
  const username = req.user?.username;
  const { id } = req.params;
  const { title, description, category, timeframe, motivation, public: isPublic, slug } = req.body;

  // Ensure goal belongs to user
  const check = await pool.query("SELECT * FROM goals WHERE id = $1 AND username = $2", [id, username]);
  if (check.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

  // Build dynamic update query
  const fields = [];
  const values = [];
  let idx = 2;
  if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
  if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
  if (category !== undefined) { fields.push(`category = $${idx++}`); values.push(category); }
  if (timeframe !== undefined) { fields.push(`timeframe = $${idx++}`); values.push(timeframe); }
  if (motivation !== undefined) { fields.push(`motivation = $${idx++}`); values.push(motivation); }
  if (isPublic !== undefined) { fields.push(`public = $${idx++}`); values.push(isPublic); }
  if (slug !== undefined) { fields.push(`slug = $${idx++}`); values.push(slug); }

  if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });

  const query = `UPDATE goals SET ${fields.join(", ")} WHERE id = $1 AND username = $2 RETURNING *`;
  const result = await pool.query(query, [id, username, ...values]);
  res.json(result.rows[0]);
});

// Delete a goal (only if it belongs to user)
router.delete("/:id", auth, async (req, res) => {
  const username = req.user?.username;
  const { id } = req.params;

  // Ensure goal belongs to user
  const check = await pool.query("SELECT * FROM goals WHERE id = $1 AND username = $2", [id, username]);
  if (check.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

  await pool.query("DELETE FROM goals WHERE id = $1 AND username = $2", [id, username]);
  res.json({ success: true });
});

export default router;