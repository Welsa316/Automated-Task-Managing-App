import type { Task } from '../types';

export function dayOverloadScore(tasks: Task[]): number {
  const totalMinutes = tasks.filter(t => t.status !== 'completed' && t.status !== 'skipped').reduce((sum, t) => sum + (t.estimated_minutes || 30), 0);
  return Math.min(100, (totalMinutes / 360) * 100);
}

export function realityWarning(overall: number): string | null {
  if (overall >= 80) return null;
  if (overall >= 60) return 'Your estimates could use some calibration.';
  if (overall >= 40) return 'You may be overcommitting. Consider reducing your daily load.';
  return 'Warning: your plan significantly exceeds realistic capacity.';
}
