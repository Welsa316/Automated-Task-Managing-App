import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as api from '../services/api';
import type { RealityScore, EnergyProfile, WeeklyMetrics } from '../types';
import { realityWarning } from '../utils/reality';

function ProgressRing({ value, size = 120, color }: { value: number; size?: number; color: string }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, value) / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e5e5" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-surface-900">{Math.round(value)}</span>
      </div>
    </div>
  );
}

export default function InsightsScreen() {
  const [realityScore, setRealityScore] = useState<RealityScore | null>(null);
  const [smoothWeek, setSmoothWeek] = useState<{ probability: number; components: Record<string, number> } | null>(null);
  const [momentum, setMomentum] = useState<{ rolling7: number; consistency: number; focusDensity: number; trend: string } | null>(null);
  const [sessionStats, setSessionStats] = useState<{ totalSessions: number; totalMinutes: number; avgFocus: number } | null>(null);
  const [weeklyMetrics, setWeeklyMetrics] = useState<WeeklyMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rs, sw, mom, ss, ws] = await Promise.all([api.getRealityScore(), api.getSmoothWeek(), api.getMomentum(), api.getSessionStats(), api.getWeeklySummary()]);
      setRealityScore(rs); setSmoothWeek(sw); setMomentum(mom); setSessionStats(ss); setWeeklyMetrics(ws);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const warning = realityScore ? realityWarning(realityScore.overall) : null;
  const realityColor = realityScore ? (realityScore.overall >= 70 ? '#22c55e' : realityScore.overall >= 40 ? '#f59e0b' : '#ef4444') : '#a3a3a3';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-surface-900">Insights</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-surface-400">Reality Score</p>
          {!loading && realityScore ? (
            <>
              <ProgressRing value={realityScore.overall} color={realityColor} />
              {warning && <p className="mt-3 text-center text-xs text-amber-600">{warning}</p>}
              <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-semibold text-surface-900">{realityScore.daily}</p><p className="text-2xs text-surface-400">Daily</p></div>
                <div><p className="text-lg font-semibold text-surface-900">{realityScore.weekly}</p><p className="text-2xs text-surface-400">Weekly</p></div>
                <div><p className="text-lg font-semibold text-surface-900">{realityScore.calibration}</p><p className="text-2xs text-surface-400">Accuracy</p></div>
              </div>
            </>
          ) : <div className="h-32 w-32 animate-pulse rounded-full bg-surface-100" />}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-surface-400">Smooth Week</p>
          {!loading && smoothWeek ? (
            <>
              <p className="text-4xl font-bold tracking-tight text-surface-900">{Math.round(smoothWeek.probability)}%</p>
              <p className="mt-1 text-sm text-surface-400">{smoothWeek.probability >= 80 ? 'Looking good' : smoothWeek.probability >= 60 ? 'Manageable' : smoothWeek.probability >= 40 ? 'Tight' : 'Challenging'}</p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-100"><div className="h-full rounded-full bg-accent-500 transition-all duration-700" style={{ width: `${smoothWeek.probability}%` }} /></div>
            </>
          ) : <div className="h-24 animate-pulse rounded-xl bg-surface-100" />}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-surface-400">Momentum</p>
          {!loading && momentum ? (
            <>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold tracking-tight text-surface-900">{Math.round(momentum.rolling7)}</p>
                <span className={`text-sm font-medium ${momentum.trend === 'rising' ? 'text-emerald-500' : momentum.trend === 'falling' ? 'text-red-400' : 'text-surface-400'}`}>
                  {momentum.trend === 'rising' ? '↑' : momentum.trend === 'falling' ? '↓' : '→'}
                </span>
              </div>
              <p className="mt-1 text-sm text-surface-400">7-day rolling</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div><p className="text-sm font-semibold text-surface-700">{Math.round(momentum.consistency)}</p><p className="text-2xs text-surface-400">Consistency</p></div>
                <div><p className="text-sm font-semibold text-surface-700">{Math.round(momentum.focusDensity * 100)}%</p><p className="text-2xs text-surface-400">Focus</p></div>
              </div>
            </>
          ) : <div className="h-24 animate-pulse rounded-xl bg-surface-100" />}
        </div>
      </div>

      {!loading && sessionStats && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-surface-400">Session Stats</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-2xl font-bold text-surface-900">{sessionStats.totalSessions}</p><p className="text-xs text-surface-400">Sessions</p></div>
            <div><p className="text-2xl font-bold text-surface-900">{sessionStats.totalMinutes >= 60 ? `${Math.round(sessionStats.totalMinutes / 60)}h` : `${sessionStats.totalMinutes}m`}</p><p className="text-xs text-surface-400">Total Time</p></div>
            <div><p className="text-2xl font-bold text-surface-900">{sessionStats.avgFocus}/5</p><p className="text-xs text-surface-400">Avg Focus</p></div>
          </div>
        </div>
      )}

      {!loading && weeklyMetrics && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-surface-400">This Week</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><p className="text-xl font-bold text-surface-900">{weeklyMetrics.planned_tasks}</p><p className="text-xs text-surface-400">Planned</p></div>
            <div><p className="text-xl font-bold text-surface-900">{weeklyMetrics.completed_tasks}</p><p className="text-xs text-surface-400">Completed</p></div>
            <div><p className="text-xl font-bold text-surface-900">{weeklyMetrics.total_estimated_minutes > 0 ? `${Math.round(weeklyMetrics.total_estimated_minutes / 60)}h` : '0h'}</p><p className="text-xs text-surface-400">Est. Time</p></div>
            <div><p className="text-xl font-bold text-surface-900">{weeklyMetrics.total_actual_minutes > 0 ? `${Math.round(weeklyMetrics.total_actual_minutes / 60)}h` : '0h'}</p><p className="text-xs text-surface-400">Actual Time</p></div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
