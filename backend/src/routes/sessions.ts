import { Router, Request, Response } from 'express';
import { getDb } from '../database.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { task_id, started_after, limit } = req.query;
    let sql = 'SELECT s.*, t.title as task_title FROM sessions s LEFT JOIN tasks t ON s.task_id = t.id WHERE 1=1';
    const params: any[] = [];
    if (task_id) { sql += ' AND s.task_id = ?'; params.push(task_id); }
    if (started_after) { sql += ' AND s.started_at >= ?'; params.push(started_after); }
    sql += ' ORDER BY s.started_at DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit as string)); }
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/active', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const session = db.prepare('SELECT s.*, t.title as task_title FROM sessions s LEFT JOIN tasks t ON s.task_id = t.id WHERE s.ended_at IS NULL ORDER BY s.started_at DESC LIMIT 1').get();
    res.json(session || null);
  } catch { res.status(500).json({ error: 'Failed to fetch active session' }); }
});

router.post('/start', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { task_id, energy_before } = req.body;
    if (!task_id) return res.status(400).json({ error: 'task_id is required' });

    // End any active session first
    const active = db.prepare("SELECT id, started_at FROM sessions WHERE ended_at IS NULL").get() as any;
    if (active) {
      const dur = Math.round((Date.now() - new Date(active.started_at).getTime()) / 60000);
      db.prepare("UPDATE sessions SET ended_at = datetime('now'), duration_minutes = ? WHERE id = ?").run(dur, active.id);
    }

    const id = uuid();
    db.prepare('INSERT INTO sessions (id, task_id, started_at, energy_before) VALUES (?, ?, datetime(\'now\'), ?)').run(id, task_id, energy_before || null);
    db.prepare("UPDATE tasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").run(task_id);

    res.status(201).json(db.prepare('SELECT s.*, t.title as task_title FROM sessions s LEFT JOIN tasks t ON s.task_id = t.id WHERE s.id = ?').get(id));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/end', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as any;
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.ended_at) return res.status(400).json({ error: 'Session already ended' });

    const { energy_after, focus_rating, notes } = req.body;
    const durationMinutes = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000);

    db.prepare("UPDATE sessions SET ended_at = datetime('now'), duration_minutes = ?, energy_after = ?, focus_rating = ?, notes = ? WHERE id = ?")
      .run(durationMinutes, energy_after || null, focus_rating || 3, notes || null, req.params.id);

    if (session.task_id) {
      db.prepare("UPDATE tasks SET actual_minutes = actual_minutes + ?, updated_at = datetime('now') WHERE id = ?").run(durationMinutes, session.task_id);
    }

    // Update energy profile
    const startDate = new Date(session.started_at);
    const energyNum = energy_after === 'HIGH' ? 1.0 : energy_after === 'MEDIUM' ? 0.6 : 0.3;
    const focusNum = (focus_rating || 3) / 5;
    db.prepare("UPDATE energy_profiles SET avg_energy = (avg_energy * sample_count + ?) / (sample_count + 1), avg_focus = (avg_focus * sample_count + ?) / (sample_count + 1), sample_count = sample_count + 1, updated_at = datetime('now') WHERE day_of_week = ? AND hour = ?")
      .run(energyNum, focusNum, startDate.getDay(), startDate.getHours());

    res.json(db.prepare('SELECT s.*, t.title as task_title FROM sessions s LEFT JOIN tasks t ON s.task_id = t.id WHERE s.id = ?').get(req.params.id));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const totals = db.prepare('SELECT COUNT(*) as totalSessions, COALESCE(SUM(duration_minutes), 0) as totalMinutes, COALESCE(AVG(focus_rating), 3) as avgFocus FROM sessions WHERE ended_at IS NOT NULL').get() as any;
    res.json({ totalSessions: totals.totalSessions, totalMinutes: totals.totalMinutes, avgFocus: Math.round(totals.avgFocus * 10) / 10 });
  } catch { res.status(500).json({ error: 'Failed to fetch session stats' }); }
});

export { router as sessionsRouter };
