import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'canvas-flow.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      canvas_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      code TEXT,
      color TEXT DEFAULT '#6366f1',
      term TEXT,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      canvas_id INTEGER UNIQUE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      assignment_type TEXT DEFAULT 'assignment',
      due_at TEXT,
      points_possible REAL DEFAULT 0,
      submitted INTEGER DEFAULT 0,
      graded INTEGER DEFAULT 0,
      score REAL,
      workload_units REAL DEFAULT 4,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_due ON assignments(due_at);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      assignment_id TEXT REFERENCES assignments(id) ON DELETE SET NULL,
      course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      energy_required TEXT DEFAULT 'MEDIUM' CHECK(energy_required IN ('LOW','MEDIUM','HIGH')),
      estimated_minutes INTEGER DEFAULT 30,
      actual_minutes INTEGER DEFAULT 0,
      due_date TEXT,
      scheduled_date TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_date);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_minutes INTEGER DEFAULT 0,
      energy_before TEXT CHECK(energy_before IN ('LOW','MEDIUM','HIGH')),
      energy_after TEXT CHECK(energy_after IN ('LOW','MEDIUM','HIGH')),
      focus_rating INTEGER DEFAULT 3 CHECK(focus_rating BETWEEN 1 AND 5),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);

    CREATE TABLE IF NOT EXISTS energy_profiles (
      id TEXT PRIMARY KEY,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
      hour INTEGER NOT NULL CHECK(hour BETWEEN 0 AND 23),
      avg_energy REAL DEFAULT 0.5,
      avg_focus REAL DEFAULT 0.5,
      sample_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(day_of_week, hour)
    );

    CREATE TABLE IF NOT EXISTS behavior_patterns (
      id TEXT PRIMARY KEY,
      course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
      task_type TEXT NOT NULL,
      avg_start_delta_hours REAL DEFAULT 48,
      std_dev_hours REAL DEFAULT 24,
      sample_count INTEGER DEFAULT 0,
      procrastination_score REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(course_id, task_type)
    );

    CREATE TABLE IF NOT EXISTS weekly_metrics (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL UNIQUE,
      planned_tasks INTEGER DEFAULT 0,
      completed_tasks INTEGER DEFAULT 0,
      total_estimated_minutes INTEGER DEFAULT 0,
      total_actual_minutes INTEGER DEFAULT 0,
      reality_score REAL DEFAULT 50,
      smooth_week_probability REAL DEFAULT 50,
      momentum_score REAL DEFAULT 0,
      consistency_score REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_weekly_week ON weekly_metrics(week_start);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      synced_at TEXT DEFAULT (datetime('now')),
      device_id TEXT
    );
  `);

  // Seed default energy profiles if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM energy_profiles').get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare(
      'INSERT INTO energy_profiles (id, day_of_week, hour, avg_energy, avg_focus, sample_count) VALUES (?, ?, ?, ?, ?, 0)'
    );
    const txn = db.transaction(() => {
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          // Default energy curve: peaks mid-morning and mid-afternoon
          let energy = 0.3;
          if (hour >= 8 && hour <= 11) energy = 0.8;
          else if (hour >= 14 && hour <= 16) energy = 0.65;
          else if (hour >= 19 && hour <= 21) energy = 0.5;
          insert.run(`ep-${day}-${hour}`, day, hour, energy, energy);
        }
      }
    });
    txn();
  }
}

export function closeDb() {
  if (db) db.close();
}
