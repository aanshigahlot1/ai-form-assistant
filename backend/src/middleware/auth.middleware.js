// backend/src/middleware/auth.middleware.js
// Simple API key auth for the backend — used when extension talks to backend

import { config } from '../config.js';

/**
 * Middleware that validates an extension ID or API key.
 * For now: check that extensionId header is present (basic security).
 * In production: use proper JWT or shared secret.
 */
export function requireExtensionId(req, res, next) {
  // Allow health check without auth
  if (req.path === '/health') return next();

  const extensionId = req.headers['x-extension-id'] || req.body?.extensionId || req.params?.extensionId;

  if (!extensionId) {
    return res.status(401).json({ error: 'Missing x-extension-id header' });
  }

  // Basic format check for Chrome extension IDs (32 lowercase chars)
  if (!/^[a-z]{32}$/.test(extensionId)) {
    return res.status(401).json({ error: 'Invalid extension ID format' });
  }

  req.extensionId = extensionId;
  next();
}

/**
 * Optional: shared secret auth for production deployments.
 */
export function requireApiKey(req, res, next) {
  if (!config.API_SECRET) return next(); // No secret configured — skip

  const provided = req.headers['x-api-key'];
  if (provided !== config.API_SECRET) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

/**
 * Rate limiting helper (simple in-memory, use redis in production).
 */
const requestCounts = new Map();
export function rateLimit(maxPerMinute = 60) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - 60000;

    if (!requestCounts.has(key)) requestCounts.set(key, []);
    const times = requestCounts.get(key).filter(t => t > windowStart);
    times.push(now);
    requestCounts.set(key, times);

    if (times.length > maxPerMinute) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
    }
    next();
  };
}
