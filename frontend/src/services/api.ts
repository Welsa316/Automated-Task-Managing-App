import type { Task, Course, Assignment, Session, RealityScore, MomentumData, ProcrastinationPrediction, WorkloadWeek, SyncSummary, SessionStats, WeeklyMetrics, EnergyLevel, EnergyProfile } from '../types';

const BASE_URL = import.meta.env.PROD ? window.location.origin : '';

function getApiKey(): string | null { return localStorage.getItem('cf_api_key'); }
export function setApiKey(key: string) { localStorage.setItem('cf_api_key', key); }

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Request failed: ${response.status}`); }
  if (response.status === 204) return undefined as T;
  return response.json();
}

// Canvas Auth
export function getCanvasStatus() { return apiFetch<{ connected: boolean; canvasUrl: string | null; lastSync?: string | null }>('/api/auth/canvas/status'); }
export function connectCanvas(canvasUrl: string, token: string) { return apiFetch<{ success: boolean; user: { name: string; id: number } }>('/api/auth/canvas/token', { method: 'POST', body: JSON.stringify({ canvasUrl, token }) }); }
export function disconnectCanvas() { return apiFetch<{ success: boolean }>('/api/auth/canvas/disconnect', { method: 'DELETE' }); }

// Canvas Sync
export function syncCanvas() { return apiFetch<SyncSummary>('/api/canvas/sync', { method: 'POST' }); }
export function getCourses() { return apiFetch<Course[]>('/api/canvas/courses'); }
export function getCourseAssignments(courseId: string) { return apiFetch<Assignment[]>(`/api/canvas/courses/${courseId}/assignments`); }

// Tasks
export function getTasks(filters?: Record<string, string>) { const p = filters ? '?' + new URLSearchParams(filters).toString() : ''; return apiFetch<Task[]>(`/api/tasks${p}`); }
export function getTodayTasks() { return apiFetch<Task[]>('/api/tasks/today'); }
export function getSuggestedTasks() { return apiFetch<{ currentEnergy: string; tasks: Task[] }>('/api/tasks/suggested'); }
export function getTask(id: string) { return apiFetch<Task>(`/api/tasks/${id}`); }
export function createTask(data: Partial<Task>) { return apiFetch<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }); }
export function updateTask(id: string, data: Partial<Task>) { return apiFetch<Task>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export function deleteTask(id: string) { return apiFetch<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }); }
export function createTaskFromAssignment(assignmentId: string) { return apiFetch<Task>('/api/tasks/from-assignment', { method: 'POST', body: JSON.stringify({ assignment_id: assignmentId }) }); }

// Sessions
export function getSessions(filters?: Record<string, string>) { const p = filters ? '?' + new URLSearchParams(filters).toString() : ''; return apiFetch<Session[]>(`/api/sessions${p}`); }
export function getActiveSession() { return apiFetch<Session | null>('/api/sessions/active'); }
export function startSession(taskId: string, energyBefore: EnergyLevel) { return apiFetch<Session>('/api/sessions/start', { method: 'POST', body: JSON.stringify({ task_id: taskId, energy_before: energyBefore }) }); }
export function endSession(id: string, data: { energy_after: EnergyLevel; focus_rating: number; notes?: string }) { return apiFetch<Session>(`/api/sessions/${id}/end`, { method: 'PUT', body: JSON.stringify(data) }); }
export function getSessionStats() { return apiFetch<SessionStats>('/api/sessions/stats'); }

// Metrics
export function getRealityScore() { return apiFetch<RealityScore>('/api/metrics/reality-score'); }
export function getSmoothWeek() { return apiFetch<{ probability: number; components: Record<string, number> }>('/api/metrics/smooth-week'); }
export function getMomentum() { return apiFetch<MomentumData & { trend: string }>('/api/metrics/momentum'); }
export function getProcrastination(taskId: string) { return apiFetch<ProcrastinationPrediction>(`/api/metrics/procrastination/${taskId}`); }
export function getWorkloadHeatmap() { return apiFetch<{ semesterStart: string; semesterEnd: string; weeks: WorkloadWeek[] }>('/api/metrics/workload-heatmap'); }
export function getWeeklySummary() { return apiFetch<WeeklyMetrics>('/api/metrics/weekly-summary'); }
export function recalculateMetrics() { return apiFetch<{ success: boolean }>('/api/metrics/recalculate', { method: 'POST' }); }
export function getEnergyProfile() { return apiFetch<EnergyProfile[]>('/api/metrics/energy-profile'); }
