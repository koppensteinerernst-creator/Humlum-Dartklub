// netlify/functions/config.js
// CJS function + ESM dynamic import (fixer ERR_REQUIRE_ESM)

exports.handler = async (event) => {
  // ESM import i en CJS function
  const { getStore } = await import('@netlify/blobs');

  const STORE = getStore({ name: 'humlum-config' });
  const KEY = 'config-v1';
  const FALLBACK_PATH = 'data/config.json';

  const method = event.httpMethod;

  if (method === 'GET') {
    // 1) Prøv seneste gemte config (Netlify Blobs)
    try {
      const latest = await STORE.get(KEY, { type: 'json' });
      if (latest) return json(200, latest);
    } catch (_) {}

    // 2) Første gang: fald tilbage til repo-filen
    try {
      const fs = await import('node:fs/promises');
      const raw = await fs.readFile(FALLBACK_PATH, 'utf8');
      return json(200, JSON.parse(raw));
    } catch (_) {
      return json(404, { error: 'Config not found' });
    }
  }

  if (method === 'POST') {
    // Simpel auth: Authorization: Bearer <ADMIN_SECRET>
    const auth = (event.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!auth || auth !== process.env.ADMIN_SECRET) {
      return json(401, { error: 'Unauthorized' });
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }

    // meget let skema-check (tilpas feltnavne til dine inputs)
    const must = ['heroTitle','heroSubtitle','heroImage','heroRotator','newsList','events','contact'];
    if (!must.every(k => Object.prototype.hasOwnProperty.call(body, k))) {
      return json(422, { error: 'Config schema validation failed' });
    }

    await STORE.set(KEY, JSON.stringify(body), { metadata: { updatedAt: Date.now() } });
    return json(200, { ok: true, updatedAt: new Date().toISOString() });
  }

  return json(405, { error: 'Method not allowed' });
};

function json(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data),
  };
}
