import { Router, Request, Response } from 'express';
import { getDb } from '../database.js';
import { v4 as uuid } from 'uuid';

const router = Router();

function getWeekStart(date: Date): string {
  const d = new Date(date); d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}
function getWeekEnd(date: Date): string {
  const d = new Date(date); d.setDate(d.getDate() + (6 - d.getDay()));
  return d.toISOString().split('T')[0];
}

router.get('/reality-score', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const weekStart = getWeekStart(new Date());
    const tasks = db.prepare('SELECT estimated_minutes, actual_minutes FROM tasks WHERE completed_at >= ? AND actual_minutes > 0 AND estimated_minutes > 0').all(weekStart) as any[];
    if (tasks.length === 0) return res.json({ daily: 50, weekly: 50, calibration: 50, overall: 50 });

    const calibrations = tasks.map((t: any) => Math.max(0, Math.min(100, 100 - Math.abs(1 - t.actual_minutes / t.estimated_minutes) * 100)));
    const calibration = calibrations.reduce((a: number, b: number) => a + b, 0) / calibrations.length;

    const today = new Date().toISOString().split('T')[0];
    const todayTasks = db.prepare("SELECT estimated_minutes FROM tasks WHERE (scheduled_date = ? OR due_date = ?) AND status NOT IN ('completed', 'skipped')").all(today, today) as any[];
    const totalMins = todayTasks.reduce((s: number, t: any) => s + (t.estimated_minutes || 30), 0);
    const daily = Math.max(0, Math.min(100, 100 - Math.max(0, (totalMins / 360) - 1) * 100));

    const weekEnd = getWeekEnd(new Date());
    const ws = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM tasks WHERE (scheduled_date >= ? OR due_date >= ?) AND (scheduled_date < ? OR due_date < ?)").get(weekStart, weekStart, weekEnd, weekEnd) as any;
    const weekly = ws.total > 0 ? (ws.completed / ws.total) * 100 : 50;
    const overall = calibration * 0.4 + daily * 0.3 + weekly * 0.3;
    res.json({ daily: Math.round(daily), weekly: Math.round(weekly), calibration: Math.round(calibration), overall: Math.round(overall) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/smooth-week', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const weekStart = getWeekStart(new Date()); const weekEnd = getWeekEnd(new Date());
    const weekTasks = db.prepare("SELECT * FROM tasks WHERE (scheduled_date >= ? AND scheduled_date < ?) OR (due_date >= ? AND due_date < ?)").all(weekStart, weekEnd, weekStart, weekEnd) as any[];
    const totalEst = weekTasks.reduce((s: number, t: any) => s + (t.estimated_minutes || 30), 0);
    const densityRatio = totalEst / (6 * 60 * 5);
    const densityScore = densityRatio <= 0.8 ? 100 : Math.max(0, 100 - ((densityRatio - 0.8) / 1.2) * 100);
    const completed = weekTasks.filter((t: any) => t.status === 'completed').length;
    const progressScore = weekTasks.length > 0 ? (completed / weekTasks.length) * 100 : 50;
    const pastMetrics = db.prepare('SELECT planned_tasks, completed_tasks FROM weekly_metrics ORDER BY week_start DESC LIMIT 4').all() as any[];
    let historyScore = 50;
    if (pastMetrics.length > 0) { const rates = pastMetrics.map((m: any) => m.planned_tasks > 0 ? m.completed_tasks / m.planned_tasks : 0.5); historyScore = (rates.reduce((a: number, b: number) => a + b, 0) / rates.length) * 100; }
    const probability = densityScore * 0.35 + progressScore * 0.30 + historyScore * 0.35;
    res.json({ probability: Math.round(Math.min(100, Math.max(0, probability))), components: { density: Math.round(densityScore), progress: Math.round(progressScore), history: Math.round(historyScore) } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/momentum', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const now = new Date();
    let totalWeightedPoints = 0; let totalWeight = 0;
    const dailyMins: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const weight = 1.0 - i * 0.1;
      const tasks = db.prepare("SELECT priority FROM tasks WHERE DATE(completed_at) = ?").all(dateStr) as any[];
      let dayPoints = 0;
      for (const t of tasks) dayPoints += t.priority === 'high' ? 15 : t.priority === 'medium' ? 10 : 5;
      const sessions = db.prepare("SELECT duration_minutes, focus_rating FROM sessions WHERE DATE(started_at) = ? AND ended_at IS NOT NULL").all(dateStr) as any[];
      dayPoints += sessions.length * 5 + sessions.reduce((s: number, sess: any) => s + (sess.duration_minutes || 0) / 60 * 3, 0);
      totalWeightedPoints += dayPoints * weight; totalWeight += weight;
      const mins = db.prepare("SELECT COALESCE(SUM(duration_minutes), 0) as m FROM sessions WHERE DATE(started_at) = ? AND ended_at IS NOT NULL").get(dateStr) as any;
      dailyMins.push(mins.m);
    }
    const rolling7 = Math.min(100, (totalWeightedPoints / totalWeight) / 50 * 100);
    const avgMins = dailyMins.reduce((a, b) => a + b, 0) / 7;
    const stddev = Math.sqrt(dailyMins.reduce((s, m) => s + Math.pow(m - avgMins, 2), 0) / 7);
    const consistency = Math.max(0, Math.min(100, 100 - stddev));
    const allSessions = db.prepare("SELECT duration_minutes, focus_rating FROM sessions WHERE started_at >= ? AND ended_at IS NOT NULL").all(new Date(now.getTime() - 7 * 86400000).toISOString()) as any[];
    const totalSessionMins = allSessions.reduce((s: number, sess: any) => s + (sess.duration_minutes || 0), 0);
    const focusedMins = allSessions.filter((s: any) => (s.focus_rating || 3) >= 3).reduce((s: number, sess: any) => s + (sess.duration_minutes || 0), 0);
    const focusDensity = totalSessionMins > 0 ? focusedMins / totalSessionMins : 0;
    const lastWeek = db.prepare('SELECT momentum_score FROM weekly_metrics ORDER BY week_start DESC LIMIT 1').get() as any;
    const diff = rolling7 - (lastWeek?.momentum_score || rolling7);
    const trend = diff > 5 ? 'rising' : diff < -5 ? 'falling' : 'steady';
    res.json({ rolling7: Math.round(rolling7), consistency: Math.round(consistency), focusDensity: Math.round(focusDensity * 100) / 100, trend });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/procrastination/:taskId', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId) as any;
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!task.due_date) return res.json({ startDeltaHours: 0, typicalDelta: 48, confidence: 0, warning: false });
    const hoursUntilDue = (new Date(task.due_date).getTime() - Date.now()) / 3600000;
    const pattern = db.prepare('SELECT * FROM behavior_patterns WHERE course_id = ? AND task_type = ?').get(task.course_id, task.assignment_id ? 'assignment' : 'task') as any;
    if (!pattern || pattern.sample_count < 3) return res.json({ startDeltaHours: hoursUntilDue, typicalDelta: 48, confidence: 0, warning: false });
    const confidence = Math.min(1, pattern.sample_count / 10);
    const warning = confidence > 0.6 && task.status === 'pending' && hoursUntilDue < pattern.avg_start_delta_hours + pattern.std_dev_hours;
    res.json({ startDeltaHours: Math.round(hoursUntilDue), typicalDelta: Math.round(pattern.avg_start_delta_hours), confidence: Math.round(confidence * 100) / 100, warning });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/workload-heatmap', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const bounds = db.prepare("SELECT MIN(start_date) as semStart, MAX(end_date) as semEnd FROM courses WHERE start_date IS NOT NULL").get() as any;
    const semesterStart = bounds?.semStart || new Date(new Date().getFullYear(), 0, 13).toISOString();
    const semesterEnd = bounds?.semEnd || new Date(new Date().getFullYear(), 4, 15).toISOString();
    const assignments = db.prepare("SELECT a.*, c.name as course_name, c.color as course_color FROM assignments a LEFT JOIN courses c ON a.course_id = c.id WHERE a.due_at IS NOT NULL ORDER BY a.due_at ASC").all() as any[];
    const weeks: any[] = [];
    const start = new Date(semesterStart); start.setDate(start.getDate() - start.getDay());
    const end = new Date(semesterEnd);
    while (start <= end) {
      const weekStart = start.toISOString().split('T')[0];
      const we = new Date(start); we.setDate(we.getDate() + 6);
      const weekEnd = we.toISOString().split('T')[0];
      const wa = assignments.filter((a: any) => { const due = a.due_at.split('T')[0]; return due >= weekStart && due <= weekEnd; });
      weeks.push({ weekStart, weekEnd, totalUnits: wa.reduce((s: number, a: any) => s + (a.workload_units || 4), 0), assignments: wa });
      start.setDate(start.getDate() + 7);
    }
    res.json({ semesterStart, semesterEnd, weeks });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/weekly-summary', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const weekStart = getWeekStart(new Date());
    let metrics = db.prepare('SELECT * FROM weekly_metrics WHERE week_start = ?').get(weekStart) as any;
    if (!metrics) {
      const weekEnd = getWeekEnd(new Date());
      const tasks = db.prepare("SELECT * FROM tasks WHERE (scheduled_date >= ? AND scheduled_date < ?) OR (due_date >= ? AND due_date < ?)").all(weekStart, weekEnd, weekStart, weekEnd) as any[];
      const completed = tasks.filter((t: any) => t.status === 'completed');
      metrics = { week_start: weekStart, planned_tasks: tasks.length, completed_tasks: completed.length, total_estimated_minutes: tasks.reduce((s: number, t: any) => s + (t.estimated_minutes || 30), 0), total_actual_minutes: completed.reduce((s: number, t: any) => s + (t.actual_minutes || 0), 0), reality_score: 50, smooth_week_probability: 50, momentum_score: 0, consistency_score: 0 };
    }
    res.json(metrics);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/recalculate', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const completedTasks = db.prepare("SELECT t.*, a.assignment_type FROM tasks t LEFT JOIN assignments a ON t.assignment_id = a.id WHERE t.status = 'completed' AND t.due_date IS NOT NULL AND t.completed_at IS NOT NULL").all() as any[];
    const patternMap = new Map<string, number[]>();
    for (const task of completedTasks) {
      const key = `${task.course_id || 'none'}::${task.assignment_type || 'task'}`;
      const delta = (new Date(task.due_date).getTime() - new Date(task.created_at).getTime()) / 3600000;
      if (!patternMap.has(key)) patternMap.set(key, []);
      patternMap.get(key)!.push(delta);
    }
    const upsert = db.prepare("INSERT INTO behavior_patterns (id, course_id, task_type, avg_start_delta_hours, std_dev_hours, sample_count, procrastination_score, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(course_id, task_type) DO UPDATE SET avg_start_delta_hours=excluded.avg_start_delta_hours, std_dev_hours=excluded.std_dev_hours, sample_count=excluded.sample_count, procrastination_score=excluded.procrastination_score, updated_at=datetime('now')");
    for (const [key, deltas] of patternMap) {
      const [courseId, taskType] = key.split('::');
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const stddev = Math.sqrt(deltas.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / deltas.length);
      upsert.run(uuid(), courseId === 'none' ? null : courseId, taskType, avg, stddev, deltas.length, Math.max(0, Math.min(100, (1 - avg / 168) * 100)));
    }
    res.json({ success: true, patternsUpdated: patternMap.size });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/energy-profile', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    res.json(db.prepare('SELECT * FROM energy_profiles ORDER BY day_of_week, hour').all());
  } catch { res.status(500).json({ error: 'Failed to fetch energy profiles' }); }
});

export { router as metricsRouter };
