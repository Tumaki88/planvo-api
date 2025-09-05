// routes/goals.js
import express from "express";
import pool from "../db.js";
import slugify from "slugify";

const router = express.Router();

/* ------------------- GET all goals for user ------------------- */
router.get("/", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    const goalsResult = await pool.query(
      "SELECT * FROM goals WHERE username = $1 ORDER BY created_at DESC",
      [username]
    );

    const goals = goalsResult.rows;

    for (let goal of goals) {
      const entriesResult = await pool.query(
        "SELECT * FROM journal WHERE goal_id = $1 ORDER BY created_at DESC",
        [goal.id]
      );
      goal.journal = entriesResult.rows;
    }

    res.json(goals);
  } catch (err) {
    console.error("Error fetching goals:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- CREATE new goal ------------------- */
router.post("/", async (req, res) => {
  const { username, title, description, category, timeframe, motivation } =
    req.body;
  if (!username || !title || !category || !timeframe) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    let baseSlug = slugify(title, { lower: true, strict: true }) || "goal";
    let uniqueSlug = baseSlug;
    let suffix = 1;

    let existingResult = await pool.query(
      "SELECT id FROM goals WHERE username = $1 AND slug = $2",
      [username, uniqueSlug]
    );

    while (existingResult.rows.length > 0) {
      uniqueSlug = `${baseSlug}-${suffix++}`;
      existingResult = await pool.query(
        "SELECT id FROM goals WHERE username = $1 AND slug = $2",
        [username, uniqueSlug]
      );
    }

    const insertResult = await pool.query(
      `INSERT INTO goals 
        (username, title, description, category, timeframe, motivation, slug, public, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())
       RETURNING *`,
      [username, title, description || "", category, timeframe, motivation || "", uniqueSlug]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    console.error("Error creating goal:", err);
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

    if (goalsResult.rows.length === 0) return res.status(404).json({ error: "Goal not found" });

    const goal = goalsResult.rows[0];

    const entriesResult = await pool.query(
      "SELECT * FROM journal WHERE goal_id = $1 ORDER BY created_at DESC",
      [goal.id]
    );

    goal.journal = entriesResult.rows;
    res.json(goal);
  } catch (err) {
    console.error("Error fetching public goal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- UPDATE goal (PATCH) ------------------- */
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields to update" });

  try {
    if (patch.slug) {
      let baseSlug = slugify(patch.slug, { lower: true, strict: true });
      let uniqueSlug = baseSlug;
      let suffix = 1;

      let existingResult = await pool.query(
        "SELECT id FROM goals WHERE slug = $1 AND id != $2",
        [uniqueSlug, id]
      );

      while (existingResult.rows.length > 0) {
        uniqueSlug = `${baseSlug}-${suffix++}`;
        existingResult = await pool.query(
          "SELECT id FROM goals WHERE slug = $1 AND id != $2",
          [uniqueSlug, id]
        );
      }

      patch.slug = uniqueSlug;
    }

    const fields = Object.keys(patch);
    const values = Object.values(patch);

    const setString = fields.map((f, i) => `"${f}" = $${i + 1}`).join(", ");
    await pool.query(`UPDATE goals SET ${setString} WHERE id = $${fields.length + 1}`, [...values, id]);

    const updatedResult = await pool.query("SELECT * FROM goals WHERE id = $1", [id]);
    if (updatedResult.rows.length === 0) return res.status(404).json({ error: "Goal not found" });

    res.json(updatedResult.rows[0]);
  } catch (err) {
    console.error("Error updating goal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- TOGGLE public/private ------------------- */
router.patch("/:id/public", async (req, res) => {
  const { id } = req.params;
  const { public: isPublic, slug } = req.body;

  if (typeof isPublic !== "boolean") {
    return res.status(400).json({ error: "`public` must be true or false" });
  }

  try {
    let slugToUse = slug || null;

    if (isPublic && slugToUse) {
      let baseSlug = slugify(slugToUse, { lower: true, strict: true });
      let uniqueSlug = baseSlug;
      let suffix = 1;

      let existingResult = await pool.query(
        "SELECT id FROM goals WHERE slug = $1 AND id != $2",
        [uniqueSlug, id]
      );

      while (existingResult.rows.length > 0) {
        uniqueSlug = `${baseSlug}-${suffix++}`;
        existingResult = await pool.query(
          "SELECT id FROM goals WHERE slug = $1 AND id != $2",
          [uniqueSlug, id]
        );
      }

      slugToUse = uniqueSlug;
    }

    const updatedResult = await pool.query(
      "UPDATE goals SET public = $1, slug = $2 WHERE id = $3 RETURNING *",
      [isPublic, slugToUse, id]
    );

    if (updatedResult.rows.length === 0) return res.status(404).json({ error: "Goal not found" });

    res.json(updatedResult.rows[0]);
  } catch (err) {
    console.error("Error toggling public goal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- DELETE goal ------------------- */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM journal WHERE goal_id = $1", [id]);
    const result = await pool.query("DELETE FROM goals WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Goal not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting goal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
