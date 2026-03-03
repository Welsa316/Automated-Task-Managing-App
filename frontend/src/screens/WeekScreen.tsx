import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { format, startOfWeek, endOfWeek, addWeeks, addDays, isSameDay, parseISO, isToday } from 'date-fns';
import { useAppStore } from '../store';
import * as api from '../services/api';
import type { Task, RealityScore as RealityScoreType } from '../types';
import { dayOverloadScore, realityWarning } from '../utils/reality';
import { energyColor } from '../utils/energy';

function CompactTaskCard({ task, onToggle }: { task: Task; onToggle: (t: Task) => void }) {
  const openModal = useAppStore((s) => s.openModal);
  const isCompleted = task.status === 'completed';
  const priorityBorder = task.priority === 'high' ? 'border-l-red-400' : task.priority === 'medium' ? 'border-l-amber-400' : 'border-l-surface-200';
  return (
    <div className={`group rounded-lg border border-surface-100 border-l-2 ${priorityBorder} bg-white p-2.5 transition-shadow hover:shadow-sm ${isCompleted ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <button onClick={(e) => { e.stopPropagation(); onToggle(task); }}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${isCompleted ? 'border-accent-500 bg-accent-500' : 'border-surface-300 hover:border-accent-400'}`}>
          {isCompleted && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
        </button>
        <button onClick={() => openModal('task-editor', task.id)} className="min-w-0 flex-1 text-left">
          <p className={`text-xs font-medium leading-tight ${isCompleted ? 'text-surface-400 line-through' : 'text-surface-800'}`}>{task.title}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`text-2xs font-medium ${energyColor(task.energy_required)}`}>{task.energy_required.charAt(0)}</span>
            {task.estimated_minutes > 0 && <span className="text-2xs text-surface-400">{task.estimated_minutes}m</span>}
          </div>
        </button>
      </div>
    </div>
  );
}

function DayColumn({ date, tasks, onToggle, onAdd }: { date: Date; tasks: Task[]; onToggle: (t: Task) => void; onAdd: (d: Date) => void }) {
  const today = isToday(date);
  const overload = dayOverloadScore(tasks);
  const barColor = overload <= 50 ? 'bg-emerald-400' : overload <= 80 ? 'bg-amber-400' : 'bg-red-400';
  const barBg = overload <= 50 ? 'bg-emerald-100' : overload <= 80 ? 'bg-amber-100' : 'bg-red-100';
  return (
    <div className={`flex w-40 shrink-0 flex-col rounded-2xl border p-3 ${today ? 'border-accent-200 bg-accent-50/40' : 'border-surface-100 bg-white'}`}>
      <div className="mb-2 text-center">
        <p className={`text-xs font-semibold uppercase tracking-wide ${today ? 'text-accent-600' : 'text-surface-400'}`}>{format(date, 'EEE')}</p>
        <p className={`text-lg font-bold ${today ? 'text-accent-600' : 'text-surface-900'}`}>{format(date, 'd')}</p>
      </div>
      <div className={`mb-3 h-1 w-full rounded-full ${barBg}`}><div className={`h-1 rounded-full ${barColor}`} style={{ width: `${Math.min(100, overload)}%` }} /></div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {tasks.map((task) => <CompactTaskCard key={task.id} task={task} onToggle={onToggle} />)}
        {tasks.length === 0 && <p className="py-4 text-center text-2xs text-surface-300">No tasks</p>}
      </div>
      <button onClick={() => onAdd(date)} className="mt-2 flex w-full items-center justify-center rounded-lg border border-dashed border-surface-200 py-1.5 text-surface-400 hover:border-accent-300 hover:text-accent-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
      </button>
    </div>
  );
}

export default function WeekScreen() {
  const openModal = useAppStore((s) => s.openModal);
  const [weekOffset, setWeekOffset] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [realityScore, setRealityScore] = useState<RealityScoreType | null>(null);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedTasks, rs] = await Promise.all([api.getTasks({ scheduled_date: format(weekStart, 'yyyy-MM-dd') }), api.getRealityScore()]);
      setTasks(fetchedTasks); setRealityScore(rs);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  useEffect(() => { loadData(); }, [loadData]);

  const tasksForDay = (date: Date): Task[] => tasks.filter((t) => t.scheduled_date && isSameDay(parseISO(t.scheduled_date), date));
  const handleToggle = async (task: Task) => {
    try { await api.updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' } as any); await loadData(); } catch { /* ignore */ }
  };

  const warning = realityScore ? realityWarning(realityScore.overall) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight text-surface-900">This Week</h1><p className="mt-1 text-base text-surface-400">{format(weekStart, 'MMM d')} &ndash; {format(weekEnd, 'MMM d')}</p></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-surface-500 shadow-sm hover:bg-surface-50" aria-label="Previous week"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg></button>
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-surface-500 shadow-sm hover:bg-surface-50">Today</button>}
          <button onClick={() => setWeekOffset((w) => w + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-surface-500 shadow-sm hover:bg-surface-50" aria-label="Next week"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></button>
        </div>
      </div>

      {!loading && (
        <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
          {days.map((date) => <DayColumn key={date.toISOString()} date={date} tasks={tasksForDay(date)} onToggle={handleToggle} onAdd={() => openModal('task-editor')} />)}
        </div>
      )}

      {!loading && realityScore && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Reality Score</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-surface-900">{Math.round(realityScore.overall)}</p>
          {warning && <p className="mt-2 text-xs text-amber-600">{warning}</p>}
        </div>
      )}
    </motion.div>
  );
}
