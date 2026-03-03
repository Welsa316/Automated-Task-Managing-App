import { Router, Request, Response } from 'express';
import { getDb } from '../database.js';
import { v4 as uuid } from 'uuid';
import { CanvasApi } from '../services/canvasApi.js';

const router = Router();

function getCanvasApi(): CanvasApi | null {
  const db = getDb();
  const tokenRow = db.prepare("SELECT value FROM app_settings WHERE key = 'canvas_token'").get() as { value: string } | undefined;
  const urlRow = db.prepare("SELECT value FROM app_settings WHERE key = 'canvas_url'").get() as { value: string } | undefined;
  if (!tokenRow?.value || !urlRow?.value) return null;
  return new CanvasApi(urlRow.value, tokenRow.value);
}

router.post('/sync', async (_req: Request, res: Response) => {
  try {
    const api = getCanvasApi();
    if (!api) return res.status(400).json({ error: 'Canvas not connected' });

    const db = getDb();
    let coursesSynced = 0;
    let assignmentsSynced = 0;
    const errors: string[] = [];

    const courses = await api.getCourses();
    const upsertCourse = db.prepare(`
      INSERT INTO courses (id, canvas_id, name, code, term, start_date, end_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(canvas_id) DO UPDATE SET name=excluded.name, code=excluded.code, term=excluded.term, start_date=excluded.start_date, end_date=excluded.end_date, updated_at=datetime('now')
    `);
    const upsertAssignment = db.prepare(`
      INSERT INTO assignments (id, canvas_id, course_id, name, description, assignment_type, due_at, points_possible, submitted, workload_units, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(canvas_id) DO UPDATE SET name=excluded.name, description=excluded.description, assignment_type=excluded.assignment_type, due_at=excluded.due_at, points_possible=excluded.points_possible, submitted=excluded.submitted, workload_units=excluded.workload_units, updated_at=datetime('now')
    `);

    for (const course of courses) {
      try {
        const existing = db.prepare('SELECT id FROM courses WHERE canvas_id = ?').get(course.id) as { id: string } | undefined;
        const courseId = existing?.id || uuid();
        upsertCourse.run(courseId, course.id, course.name, course.course_code || null, course.enrollment_term_id ? `Term ${course.enrollment_term_id}` : null, course.start_at || null, course.end_at || null);
        coursesSynced++;

        const assignments = await api.getAssignments(course.id);
        for (const a of assignments) {
          try {
            const existingA = db.prepare('SELECT id FROM assignments WHERE canvas_id = ?').get(a.id) as { id: string } | undefined;
            const assignmentId = existingA?.id || uuid();
            const workloadUnits = Math.max(1, Math.ceil((a.points_possible || 10) / 25));
            upsertAssignment.run(assignmentId, a.id, courseId, a.name, a.description || null, a.submission_types?.[0] || 'assignment', a.due_at || null, a.points_possible || 0, a.has_submitted_submissions ? 1 : 0, workloadUnits);
            assignmentsSynced++;
          } catch (e: any) { errors.push(`Assignment ${a.name}: ${e.message}`); }
        }
      } catch (e: any) { errors.push(`Course ${course.name}: ${e.message}`); }
    }

    db.prepare("INSERT INTO app_settings (key, value) VALUES ('last_sync', ?) ON CONFLICT(key) DO UPDATE SET value = ?")
      .run(new Date().toISOString(), new Date().toISOString());

    res.json({ coursesSynced, assignmentsSynced, errors });
  } catch (err: any) {
    res.status(500).json({ error: `Sync failed: ${err.message}` });
  }
});

router.get('/courses', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    res.json(db.prepare('SELECT * FROM courses ORDER BY name').all());
  } catch { res.status(500).json({ error: 'Failed to fetch courses' }); }
});

router.get('/courses/:id/assignments', (req: Request, res: Response) => {
  try {
    const db = getDb();
    res.json(db.prepare('SELECT * FROM assignments WHERE course_id = ? ORDER BY due_at ASC').all(req.params.id));
  } catch { res.status(500).json({ error: 'Failed to fetch assignments' }); }
});

router.get('/events', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const days = parseInt(req.query.days as string) || 7;
    const now = new Date().toISOString();
    const future = new Date(Date.now() + days * 86400000).toISOString();
    res.json(db.prepare('SELECT a.*, c.name as course_name, c.color as course_color FROM assignments a LEFT JOIN courses c ON a.course_id = c.id WHERE a.due_at >= ? AND a.due_at <= ? ORDER BY a.due_at ASC').all(now, future));
  } catch { res.status(500).json({ error: 'Failed to fetch events' }); }
});

export { router as canvasRouter };
