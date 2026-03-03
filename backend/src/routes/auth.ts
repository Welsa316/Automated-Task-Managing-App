import { Router, Request, Response } from 'express';
import { getDb } from '../database.js';

const router = Router();

router.get('/canvas/status', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'canvas_token'").get() as { value: string } | undefined;
    const urlRow = db.prepare("SELECT value FROM app_settings WHERE key = 'canvas_url'").get() as { value: string } | undefined;
    const syncRow = db.prepare("SELECT value FROM app_settings WHERE key = 'last_sync'").get() as { value: string } | undefined;
    res.json({ connected: !!row?.value, canvasUrl: urlRow?.value || null, lastSync: syncRow?.value || null });
  } catch {
    res.status(500).json({ error: 'Failed to check Canvas status' });
  }
});

router.post('/canvas/token', async (req: Request, res: Response) => {
  try {
    const { canvasUrl, token } = req.body;
    if (!canvasUrl || !token) return res.status(400).json({ error: 'canvasUrl and token are required' });

    const testUrl = `${canvasUrl.replace(/\/$/, '')}/api/v1/users/self`;
    const testRes = await fetch(testUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!testRes.ok) return res.status(401).json({ error: 'Invalid Canvas token or URL' });

    const user = await testRes.json();
    const db = getDb();
    const upsert = db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?");
    upsert.run('canvas_token', token, token);
    upsert.run('canvas_url', canvasUrl.replace(/\/$/, ''), canvasUrl.replace(/\/$/, ''));
    res.json({ success: true, user: { name: user.name, id: user.id } });
  } catch {
    res.status(500).json({ error: 'Failed to connect to Canvas' });
  }
});

router.delete('/canvas/disconnect', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM app_settings WHERE key = 'canvas_token'").run();
    db.prepare("DELETE FROM app_settings WHERE key = 'canvas_url'").run();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export { router as authRouter };
