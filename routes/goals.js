import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";
import slugify from "slugify";
const { applyTimeframeReset } = require('../utils/timeframe');

const router = express.Router();
router.get("/public", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, title, slug, description, timeframe, motivation, created_at 
       FROM goals 
       WHERE public = true 
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching public goals:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- GET public goal by slug ------------------- */
router.get("/public/:username/:slug", async (req, res) => {
  const { username, slug } = req.params;

  try {
    const goalsResult = await pool.query(
      "SELECT * FROM goals WHERE username = $1 AND slug = $2 AND public = true LIMIT 1",
      [username, slug]
    );

    if (goalsResult.rows.length === 0)
      return res.status(404).json({ error: "Goal not found" });

    const goal = goalsResult.rows[0];

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
// Get all goals for logged-in user (with journal entries)
router.get("/", auth, async (req, res) => {
  const username = req.user?.username;
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      `
      SELECT g.*, COALESCE(
        (
          SELECT COALESCE(json_agg(to_jsonb(j) ORDER BY j.created_at DESC), '[]'::json)
          FROM journal j
          WHERE j.goal_id = g.id
        ), '[]'::json
      ) AS journal
      FROM goals g
      WHERE g.username = $1
      ORDER BY g.created_at DESC
      `,
      [username]
    );
    // Ensure progress is reset per timeframe for current period without losing journals
    res.json(Array.isArray(result.rows) ? result.rows.map(g => applyTimeframeReset(g)) : []);
  } catch (err) {
    console.error("GET /goals error", err);
    res.status(500).json({ error: "Failed to load goals" });
  }
});

// Add a new goal for logged-in user
router.post("/", auth, async (req, res) => {
  const username = req.user?.username;
  const { title, description, category, timeframe, motivation } = req.body;
  if (!username || !title || !category || !timeframe)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    // Generate a non-null unique slug per user
    const base = slugify(String(title), { lower: true, strict: true }) || "goal";
    let candidate = base;
    let i = 1;
    // Ensure uniqueness for this user
    // Small loop; breaks quickly in practice
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await pool.query("SELECT 1 FROM goals WHERE username = $1 AND slug = $2", [username, candidate]);
      if (exists.rows.length === 0) break;
      candidate = `${base}-${i++}`;
    }

    const result = await pool.query(
      "INSERT INTO goals (username, title, description, category, timeframe, motivation, slug, public, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW()) RETURNING *",
      [username, title, description || "", category, timeframe, motivation || "", candidate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /goals error", err);
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// Update a goal (only if it belongs to user)
router.patch("/:id", auth, async (req, res) => {
  const username = req.user?.username;
  const { id } = req.params;
  const { title, description, category, timeframe, motivation, public: isPublic, slug } = req.body;

  try {
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
  } catch (err) {
    console.error("PATCH /goals/:id error", err);
    res.status(500).json({ error: "Failed to update goal" });
  }
});

// Toggle public/slug (explicit endpoint used by frontend fallback)
router.patch("/:id/public", auth, async (req, res) => {
  const username = req.user?.username;
  const { id } = req.params;
  const { public: isPublic, slug } = req.body;

  try {
    const check = await pool.query("SELECT * FROM goals WHERE id = $1 AND username = $2", [id, username]);
    if (check.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

    const result = await pool.query(
      "UPDATE goals SET public = $3, slug = COALESCE($4, slug) WHERE id = $1 AND username = $2 RETURNING *",
      [id, username, !!isPublic, slug ?? null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /goals/:id/public error", err);
    res.status(500).json({ error: "Failed to update visibility" });
  }
});

// Delete a goal (only if it belongs to user)
router.delete("/:id", auth, async (req, res) => {
  const username = req.user?.username;
  const { id } = req.params;

  try {
    // Ensure goal belongs to user
    const check = await pool.query("SELECT * FROM goals WHERE id = $1 AND username = $2", [id, username]);
    if (check.rows.length === 0) return res.status(403).json({ error: "Not allowed" });

    await pool.query("DELETE FROM goals WHERE id = $1 AND username = $2", [id, username]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /goals/:id error", err);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

export default router;
