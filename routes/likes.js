const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Toggle like for a public goal by username/slug
router.post('/:username/:slug', auth, async (req, res) => {
  const actor = req.user && (req.user.username || req.user.name || req.user.id);
  if (!actor) return res.status(401).json({ error: 'Unauthorized' });

  const { username, slug } = req.params;
  const { like } = req.body || {};

  try {
    const { rows: goals } = await pool.query(
      `SELECT id FROM goals WHERE username = $1 AND slug = $2 AND public = true LIMIT 1`,
      [username, slug]
    );
    if (!goals.length) return res.status(404).json({ error: 'Goal not found or not public' });

    const goalId = goals[0].id;

    if (like) {
      await pool.query(
        `INSERT INTO goal_likes (goal_id, username) VALUES ($1, $2) ON CONFLICT (goal_id, username) DO NOTHING`,
        [goalId, actor]
      );
    } else {
      await pool.query(
        `DELETE FROM goal_likes WHERE goal_id = $1 AND username = $2`,
        [goalId, actor]
      );
    }

    const { rows: cnt } = await pool.query(
      `SELECT COUNT(*)::int AS likes FROM goal_likes WHERE goal_id = $1`,
      [goalId]
    );
    const likes = cnt[0]?.likes || 0;

    await pool.query(`UPDATE goals SET likes_count = $2 WHERE id = $1`, [goalId, likes]);

    return res.json({ likes, liked: !!like });
  } catch (err) {
    console.error('likes.toggle:', err);
    return res.status(500).json({ error: 'Failed to update like' });
  }
});

module.exports = router;