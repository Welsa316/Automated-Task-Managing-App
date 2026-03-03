import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { canvasRouter } from './routes/canvas.js';
import { tasksRouter } from './routes/tasks.js';
import { sessionsRouter } from './routes/sessions.js';
import { metricsRouter } from './routes/metrics.js';
import { getDb, closeDb } from './database.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });
// Also try root .env
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Initialize database
getDb();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? true
    : ['http://localhost:5173', 'http://localhost:3001', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth middleware for all /api routes
app.use('/api', authMiddleware);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/canvas', canvasRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/metrics', metricsRouter);

// Serve frontend static files in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Graceful shutdown
process.on('SIGTERM', () => { closeDb(); process.exit(0); });
process.on('SIGINT', () => { closeDb(); process.exit(0); });

app.listen(PORT, () => {
  console.log(`\n  Canvas Flow backend running at http://localhost:${PORT}`);
  console.log(`  API docs: http://localhost:${PORT}/api/health\n`);
});

export default app;
