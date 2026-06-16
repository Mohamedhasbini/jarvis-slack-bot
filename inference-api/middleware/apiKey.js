const supabase = require('../db');

async function requireApiKey(req, res, next) {
  const raw = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!raw) {
    return res.status(401).json({
      error: { message: 'Missing API key in Authorization header', type: 'authentication_error', code: 'missing_api_key' }
    });
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('key', raw)
    .single();

  if (error || !data) {
    return res.status(401).json({
      error: { message: 'Invalid API key', type: 'authentication_error', code: 'invalid_api_key' }
    });
  }

  // Update last_used timestamp (fire-and-forget)
  supabase.from('api_keys').update({ last_used: new Date().toISOString() }).eq('id', data.id).then(() => {});

  req.apiKeyId = data.id;
  req.userId = data.user_id;
  next();
}

module.exports = { requireApiKey };
