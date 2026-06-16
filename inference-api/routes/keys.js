const express = require('express');
const { randomBytes } = require('crypto');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All key routes require dashboard auth
router.use(requireAuth);

function generateApiKey() {
  return 'sk-jarvis-' + randomBytes(32).toString('hex');
}

// GET /api/keys
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_preview, created_at, last_used')
    .eq('user_id', req.user.userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to fetch keys' });
  res.json(data);
});

// POST /api/keys
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const key = generateApiKey();
  const preview = key.slice(0, 18) + '...' + key.slice(-4);

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: req.user.userId, name, key, key_preview: preview })
    .select('id, name, key, key_preview, created_at')
    .single();

  if (error) return res.status(500).json({ error: 'Failed to create key' });

  // Return the full key only once at creation
  res.status(201).json(data);
});

// DELETE /api/keys/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.userId);

  if (error) return res.status(500).json({ error: 'Failed to revoke key' });
  res.json({ ok: true });
});

module.exports = router;
