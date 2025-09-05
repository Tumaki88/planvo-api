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
    const [goals] = await pool.query(
      "SELECT * FROM goals WHERE username = ? ORDER BY created_at DESC",
      [username]
    );

    for (let goal of goals) {
      const [entries] = await pool.query(
        "SELECT * FROM journal WHERE goal_id = ? ORDER BY created_at DESC",
        [goal.id]
      );
      goal.journal = entries;
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
    // generate slug candidate
    let baseSlug = slugify(title, { lower: true, strict: true }) || "goal";
    let uniqueSlug = baseSlug;
    let suffix = 1;

    // ensure uniqueness per user
    let [existing] = await pool.query(
      "SELECT id FROM goals WHERE username = ? AND slug = ?",
      [username, uniqueSlug]
    );
    while (existing.length > 0) {
      uniqueSlug = `${baseSlug}-${suffix++}`;
      [existing] = await pool.query(
        "SELECT id FROM goals WHERE username = ? AND slug = ?",
        [username, uniqueSlug]
      );
    }

    const [result] = await pool.query(
      `INSERT INTO goals 
        (username, title, description, category, timeframe, motivation, slug, public, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        username,
        title,
        description || "",
        category,
        timeframe,
        motivation || "",
        uniqueSlug,
      ]
    );

    const [newGoal] = await pool.query("SELECT * FROM goals WHERE id = ?", [
      result.insertId,
    ]);
    res.status(201).json(newGoal[0]);
  } catch (err) {
    console.error("Error creating goal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- GET public goal by slug ------------------- */
router.get("/public/:username/:slug", async (req, res) => {
  const { username, slug } = req.params;

  try {
    const [goals] = await pool.query(
      "SELECT * FROM goals WHERE username = ? AND slug = ? AND public = 1 LIMIT 1",
      [username, slug]
    );

    if (!goals.length) return res.status(404).json({ error: "Goal not found" });

    const goal = goals[0];
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

/* ------------------- UPDATE goal (PATCH) ------------------- */
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};
  if (Object.keys(patch).length === 0)
    return res.status(400).json({ error: "No fields to update" });

  try {
    // slug uniqueness if updating slug
    if (patch.slug) {
      let baseSlug = slugify(patch.slug, { lower: true, strict: true });
      let uniqueSlug = baseSlug;
      let suffix = 1;
      let [existing] = await pool.query(
        "SELECT id FROM goals WHERE slug = ? AND id != ?",
        [uniqueSlug, id]
      );
      while (existing.length > 0) {
        uniqueSlug = `${baseSlug}-${suffix++}`;
        [existing] = await pool.query(
          "SELECT id FROM goals WHERE slug = ? AND id != ?",
          [uniqueSlug, id]
        );
      }
      patch.slug = uniqueSlug;
    }

    const fields = Object.keys(patch);
    const values = Object.values(patch);

    const sql = `UPDATE goals SET ${fields
      .map((f) => `${f} = ?`)
      .join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query("SELECT * FROM goals WHERE id = ?", [
      id,
    ]);
    if (!updated.length) return res.status(404).json({ error: "Goal not found" });
    res.json(updated[0]);
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
      // ensure slug unique
      let baseSlug = slugify(slugToUse, { lower: true, strict: true });
      let uniqueSlug = baseSlug;
      let suffix = 1;
      let [existing] = await pool.query(
        "SELECT id FROM goals WHERE slug = ? AND id != ?",
        [uniqueSlug, id]
      );
      while (existing.length > 0) {
        uniqueSlug = `${baseSlug}-${suffix++}`;
        [existing] = await pool.query(
          "SELECT id FROM goals WHERE slug = ? AND id != ?",
          [uniqueSlug, id]
        );
      }
      slugToUse = uniqueSlug;
    }

    await pool.query("UPDATE goals SET public = ?, slug = ? WHERE id = ?", [
      isPublic ? 1 : 0,
      slugToUse,
      id,
    ]);

    const [updatedGoal] = await pool.query("SELECT * FROM goals WHERE id = ?", [
      id,
    ]);
    if (!updatedGoal.length)
      return res.status(404).json({ error: "Goal not found" });

    res.json(updatedGoal[0]);
  } catch (err) {
    console.error("Error toggling public goal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- DELETE goal ------------------- */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // remove journal entries first (if not cascading in DB)
    await pool.query("DELETE FROM journal WHERE goal_id = ?", [id]);
    const [result] = await pool.query("DELETE FROM goals WHERE id = ?", [id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Goal not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting goal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
