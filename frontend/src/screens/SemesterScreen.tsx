import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, differenceInDays, isFuture } from 'date-fns';
import * as api from '../services/api';
import type { Course, Assignment, WorkloadWeek } from '../types';
import { getIntensityLevel, getIntensityLabel } from '../utils/workload';

function intensityColorClass(level: 0 | 1 | 2 | 3 | 4): string {
  return ['bg-surface-100', 'bg-accent-100', 'bg-accent-300', 'bg-accent-500', 'bg-red-500'][level];
}

function HeatmapCell({ week }: { week: WorkloadWeek }) {
  const level = getIntensityLevel(week.totalUnits);
  const [tip, setTip] = useState(false);
  return (
    <div className="relative">
      <div onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} className={`h-8 w-8 rounded-md ${intensityColorClass(level)}`} />
      {tip && (
        <div className="absolute -top-12 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-surface-800 px-3 py-1.5 text-xs text-white shadow-lg">
          <p className="font-medium">{format(parseISO(week.weekStart), 'MMM d')} &ndash; {format(parseISO(week.weekEnd), 'MMM d')}</p>
          <p className="text-surface-300">{week.totalUnits} units &middot; {getIntensityLabel(level)}</p>
        </div>
      )}
    </div>
  );
}

export default function SemesterScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [heatmapData, setHeatmapData] = useState<WorkloadWeek[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedCourses, heatmapRes] = await Promise.all([api.getCourses(), api.getWorkloadHeatmap()]);
      setCourses(fetchedCourses);
      setHeatmapData(heatmapRes.weeks || []);

      const allAssignments: Assignment[] = [];
      for (const course of fetchedCourses) {
        try {
          const assignments = await api.getCourseAssignments(course.id);
          allAssignments.push(...assignments.map(a => ({ ...a, course })));
        } catch { /* ignore */ }
      }
      setUpcomingDeadlines(allAssignments.filter(a => !a.submitted && a.due_at && isFuture(parseISO(a.due_at))).sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime()).slice(0, 10));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-surface-900">Semester Overview</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-surface-400">Workload Heatmap</h2>
        {!loading && heatmapData.length > 0 ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-4">
              <span className="text-xs text-surface-400">Less</span>
              <div className="flex gap-1">{([0, 1, 2, 3, 4] as const).map(l => <div key={l} className={`h-4 w-4 rounded-sm ${intensityColorClass(l)}`} />)}</div>
              <span className="text-xs text-surface-400">More</span>
            </div>
            <div className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-2">{heatmapData.map(w => <HeatmapCell key={w.weekStart} week={w} />)}</div>
          </div>
        ) : !loading ? (
          <div className="rounded-2xl bg-white px-6 py-8 text-center shadow-sm"><p className="text-sm text-surface-400">No workload data yet. Sync Canvas to see your semester.</p></div>
        ) : <div className="h-32 animate-pulse rounded-2xl bg-surface-100" />}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-surface-400">Upcoming Deadlines</h2>
        {!loading && upcomingDeadlines.length > 0 ? (
          <div className="divide-y divide-surface-100 rounded-2xl bg-white px-5 shadow-sm">
            {upcomingDeadlines.map(a => {
              const dueDate = a.due_at ? parseISO(a.due_at) : null;
              const daysUntil = dueDate ? differenceInDays(dueDate, new Date()) : null;
              const urgency = daysUntil !== null && daysUntil <= 2 ? 'text-red-500' : daysUntil !== null && daysUntil <= 7 ? 'text-amber-500' : 'text-surface-500';
              return (
                <div key={a.id} className="flex items-center gap-4 py-3">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.course?.color ?? '#a3a3a3' }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-900">{a.name}</p>
                    <p className="truncate text-xs text-surface-400">{a.course?.name ?? 'Unknown'}</p>
                  </div>
                  <div className="text-right">
                    {dueDate && <p className={`text-sm font-medium ${urgency}`}>{format(dueDate, 'MMM d')}</p>}
                    <p className="text-xs text-surface-400">{a.workload_units} unit{a.workload_units !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !loading ? (
          <div className="rounded-2xl bg-white px-6 py-8 text-center shadow-sm"><p className="text-sm text-surface-400">No upcoming deadlines.</p></div>
        ) : <div className="h-40 animate-pulse rounded-2xl bg-surface-100" />}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-surface-400">Courses</h2>
        {!loading && courses.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {courses.map(c => (
              <div key={c.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <p className="truncate text-sm font-semibold text-surface-900">{c.name}</p>
                </div>
                {c.code && <p className="mt-1 text-xs text-surface-400">{c.code}</p>}
              </div>
            ))}
          </div>
        ) : !loading ? (
          <div className="rounded-2xl bg-white px-6 py-8 text-center shadow-sm"><p className="text-sm text-surface-400">No courses synced yet. Connect Canvas in Settings.</p></div>
        ) : <div className="grid grid-cols-2 gap-4"><div className="h-24 animate-pulse rounded-2xl bg-surface-100" /><div className="h-24 animate-pulse rounded-2xl bg-surface-100" /></div>}
      </section>
    </motion.div>
  );
}
