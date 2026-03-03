import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useAppStore } from '../store';
import * as api from '../services/api';
import type { Task, MomentumData, EnergyLevel } from '../types';
import { smoothWeekColor } from '../utils/smoothWeek';
import { energyLabel, energyColor } from '../utils/energy';

function StatCard({ label, value, colorClass }: { label: string; value: string | number; colorClass?: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${colorClass ?? 'text-surface-900'}`}>{value}</p>
    </div>
  );
}

const ENERGY_LEVELS: EnergyLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

function InlineEnergySelector() {
  const currentEnergy = useAppStore((s) => s.currentEnergy);
  const setCurrentEnergy = useAppStore((s) => s.setCurrentEnergy);
  return (
    <div className="flex items-center gap-1.5">
      {ENERGY_LEVELS.map((level) => {
        const active = level === currentEnergy;
        return (
          <button key={level} onClick={() => setCurrentEnergy(level)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? (level === 'LOW' ? 'bg-surface-200 text-surface-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700') : 'bg-surface-100 text-surface-400 hover:bg-surface-200'}`}>
            {energyLabel(level).replace(' Energy', '')}
          </button>
        );
      })}
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (t: Task) => void }) {
  const openModal = useAppStore((s) => s.openModal);
  const isCompleted = task.status === 'completed';
  const priorityDot = task.priority === 'high' ? 'bg-red-400' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-surface-300';
  return (
    <div className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-surface-50 ${isCompleted ? 'opacity-50' : ''}`}>
      <button onClick={() => onToggle(task)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isCompleted ? 'border-accent-500 bg-accent-500' : 'border-surface-300 hover:border-accent-400'}`}>
        {isCompleted && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
      </button>
      <button onClick={() => openModal('task-editor', task.id)} className="flex flex-1 items-center gap-3 text-left">
        <div className={`h-2 w-2 shrink-0 rounded-full ${priorityDot}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${isCompleted ? 'text-surface-400 line-through' : 'text-surface-900'}`}>{task.title}</p>
          {task.course_name && <p className="truncate text-xs text-surface-400">{task.course_name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${energyColor(task.energy_required)}`}>{task.energy_required.charAt(0)}</span>
          {task.estimated_minutes > 0 && <span className="text-xs text-surface-400">{task.estimated_minutes}m</span>}
        </div>
      </button>
    </div>
  );
}

export default function TodayScreen() {
  const canvasConnected = useAppStore((s) => s.canvasConnected);
  const openModal = useAppStore((s) => s.openModal);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [suggestedTasks, setSuggestedTasks] = useState<Task[]>([]);
  const [smoothWeek, setSmoothWeek] = useState<{ probability: number } | null>(null);
  const [momentum, setMomentum] = useState<MomentumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasks, sugRes, sw, mom] = await Promise.all([api.getTodayTasks(), api.getSuggestedTasks(), api.getSmoothWeek(), api.getMomentum()]);
      setTodayTasks(tasks);
      setSuggestedTasks(Array.isArray(sugRes) ? sugRes : sugRes.tasks);
      setSmoothWeek(sw);
      setMomentum(mom);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try { await api.updateTask(task.id, { status: newStatus } as any); await loadData(); } catch { /* ignore */ }
  };

  const inProgress = todayTasks.filter((t) => t.status === 'in_progress');
  const pending = todayTasks.filter((t) => t.status === 'pending');
  const completed = todayTasks.filter((t) => t.status === 'completed');
  const remainingCount = inProgress.length + pending.length;

  if (!loading && todayTasks.length === 0 && suggestedTasks.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div><h1 className="text-3xl font-bold tracking-tight text-surface-900">Today</h1><p className="mt-1 text-base text-surface-400">{format(new Date(), 'EEEE, MMMM d')}</p></div>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 shadow-sm">
          <h2 className="text-lg font-semibold text-surface-900">Welcome to Canvas Flow</h2>
          <p className="mt-2 max-w-sm text-center text-sm text-surface-500">{canvasConnected ? 'Your Canvas account is connected. Add your first task to get started.' : 'Connect your Canvas account in Settings to get started, or add your first task.'}</p>
          <button onClick={() => openModal('task-editor')} className="mt-6 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-600">Add your first task</button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-start justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight text-surface-900">Today</h1><p className="mt-1 text-base text-surface-400">{format(new Date(), 'EEEE, MMMM d')}</p></div>
        <InlineEnergySelector />
      </div>

      {!loading && (
        <div className="flex gap-4">
          <StatCard label="Remaining" value={remainingCount} />
          <StatCard label="Smooth Week" value={smoothWeek ? `${Math.round(smoothWeek.probability)}%` : '--'} colorClass={smoothWeek ? smoothWeekColor(smoothWeek.probability) : undefined} />
          <StatCard label="Momentum" value={momentum ? Math.round(momentum.rolling7) : '--'} />
        </div>
      )}

      {suggestedTasks.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-surface-400">Suggested for now</h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {suggestedTasks.slice(0, 3).map((task) => <TaskRow key={task.id} task={task} onToggle={handleToggle} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-surface-400">All tasks today</h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {inProgress.map((task) => <TaskRow key={task.id} task={task} onToggle={handleToggle} />)}
          {pending.map((task) => <TaskRow key={task.id} task={task} onToggle={handleToggle} />)}
          {completed.length > 0 && (
            <div className="border-t border-surface-100">
              <button onClick={() => setCompletedExpanded((v) => !v)} className="flex w-full items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-surface-400">Completed ({completed.length})</span>
                <svg className={`h-4 w-4 text-surface-400 transition-transform ${completedExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {completedExpanded && completed.map((task) => <TaskRow key={task.id} task={task} onToggle={handleToggle} />)}
            </div>
          )}
          {todayTasks.length === 0 && <div className="px-6 py-8 text-center"><p className="text-sm text-surface-400">No tasks scheduled for today.</p></div>}
        </div>
      </section>

      <button onClick={() => openModal('task-editor')} className="fixed bottom-8 right-8 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white shadow-lg hover:scale-105 hover:bg-accent-600 active:scale-95" aria-label="Add task">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
      </button>
    </motion.div>
  );
}
