import { Router, Request, Response } from 'express';
import { getDb } from '../database.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, course_id, scheduled_date, due_date, energy_required, sort_by } = req.query;
    let sql = 'SELECT t.*, c.name as course_name, c.color as course_color FROM tasks t LEFT JOIN courses c ON t.course_id = c.id WHERE 1=1';
    const params: any[] = [];
    if (status) { sql += ' AND t.status = ?'; params.push(status); }
    if (course_id) { sql += ' AND t.course_id = ?'; params.push(course_id); }
    if (scheduled_date) { sql += ' AND t.scheduled_date = ?'; params.push(scheduled_date); }
    if (due_date) { sql += ' AND t.due_date = ?'; params.push(due_date); }
    if (energy_required) { sql += ' AND t.energy_required = ?'; params.push(energy_required); }
    const sortMap: Record<string, string> = { due_date: 't.due_date ASC', priority: "CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END", created_at: 't.created_at DESC', scheduled_date: 't.scheduled_date ASC' };
    sql += ` ORDER BY ${sortMap[sort_by as string] || 't.due_date ASC'}`;
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) { res.status(500).json({ error: `Failed to fetch tasks: ${err.message}` }); }
});

router.get('/today', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    res.json(db.prepare(`SELECT t.*, c.name as course_name, c.color as course_color FROM tasks t LEFT JOIN courses c ON t.course_id = c.id WHERE (t.scheduled_date = ? OR t.due_date = ?) AND t.status NOT IN ('completed', 'skipped') ORDER BY CASE t.status WHEN 'in_progress' THEN 0 ELSE 1 END, CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.due_date ASC`).all(today, today));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/suggested', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const now = new Date();
    const profile = db.prepare('SELECT avg_energy FROM energy_profiles WHERE day_of_week = ? AND hour = ?').get(now.getDay(), now.getHours()) as { avg_energy: number } | undefined;
    let energyLevel = 'MEDIUM';
    if (profile) { if (profile.avg_energy >= 0.7) energyLevel = 'HIGH'; else if (profile.avg_energy < 0.45) energyLevel = 'LOW'; }
    const tasks = db.prepare(`SELECT t.*, c.name as course_name, c.color as course_color FROM tasks t LEFT JOIN courses c ON t.course_id = c.id WHERE t.status = 'pending' AND t.energy_required = ? ORDER BY t.due_date ASC LIMIT 5`).all(energyLevel) as any[];
    if (tasks.length < 3) {
      const adjacent = energyLevel === 'HIGH' ? 'MEDIUM' : energyLevel === 'LOW' ? 'MEDIUM' : 'HIGH';
      const more = db.prepare(`SELECT t.*, c.name as course_name, c.color as course_color FROM tasks t LEFT JOIN courses c ON t.course_id = c.id WHERE t.status = 'pending' AND t.energy_required = ? AND t.id NOT IN (${tasks.map(() => '?').join(',') || "''"}) ORDER BY t.due_date ASC LIMIT ?`).all(adjacent, ...tasks.map((t: any) => t.id), 5 - tasks.length);
      tasks.push(...more);
    }
    res.json({ currentEnergy: energyLevel, tasks });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const task = db.prepare('SELECT t.*, c.name as course_name, c.color as course_color FROM tasks t LEFT JOIN courses c ON t.course_id = c.id WHERE t.id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch { res.status(500).json({ error: 'Failed to fetch task' }); }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = uuid();
    const { assignment_id, course_id, title, description, status, priority, energy_required, estimated_minutes, due_date, scheduled_date } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    db.prepare('INSERT INTO tasks (id, assignment_id, course_id, title, description, status, priority, energy_required, estimated_minutes, due_date, scheduled_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, assignment_id || null, course_id || null, title, description || null, status || 'pending', priority || 'medium', energy_required || 'MEDIUM', estimated_minutes || 30, due_date || null, scheduled_date || null);
    res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    const fields = ['title', 'description', 'status', 'priority', 'energy_required', 'estimated_minutes', 'actual_minutes', 'due_date', 'scheduled_date', 'course_id', 'assignment_id'];
    const updates: string[] = ["updated_at = datetime('now')"];
    const params: any[] = [];
    for (const field of fields) {
      if (req.body[field] !== undefined) { updates.push(`${field} = ?`); params.push(req.body[field]); }
    }
    if (req.body.status === 'completed' && existing.status !== 'completed') updates.push("completed_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT t.*, c.name as course_name, c.color as course_color FROM tasks t LEFT JOIN courses c ON t.course_id = c.id WHERE t.id = ?').get(req.params.id));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to delete task' }); }
});

router.post('/from-assignment', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { assignment_id } = req.body;
    if (!assignment_id) return res.status(400).json({ error: 'assignment_id is required' });
    const assignment = db.prepare('SELECT a.*, c.name as course_name FROM assignments a LEFT JOIN courses c ON a.course_id = c.id WHERE a.id = ?').get(assignment_id) as any;
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const id = uuid();
    const estimatedMinutes = (assignment.workload_units || 4) * 30;
    db.prepare('INSERT INTO tasks (id, assignment_id, course_id, title, due_date, estimated_minutes, energy_required) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, assignment.id, assignment.course_id, assignment.name, assignment.due_at, estimatedMinutes, estimatedMinutes > 90 ? 'HIGH' : estimatedMinutes > 45 ? 'MEDIUM' : 'LOW');
    res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export { router as tasksRouter };
