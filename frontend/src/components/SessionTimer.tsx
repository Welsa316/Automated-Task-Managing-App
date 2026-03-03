import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import * as api from '../services/api';
import type { EnergyLevel, Task } from '../types';

export default function SessionTimer() {
  const closeModal = useAppStore((s) => s.closeModal);
  const editingTaskId = useAppStore((s) => s.editingTaskId);

  const [task, setTask] = useState<Task | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [energyBefore, setEnergyBefore] = useState<EnergyLevel>('MEDIUM');
  const [energyAfter, setEnergyAfter] = useState<EnergyLevel>('MEDIUM');
  const [focusRating, setFocusRating] = useState(3);
  const [phase, setPhase] = useState<'setup' | 'running' | 'review'>('setup');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (editingTaskId) api.getTask(editingTaskId).then(setTask).catch(() => {});
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [editingTaskId]);

  const handleStart = async () => {
    if (!editingTaskId) return;
    try {
      const session = await api.startSession(editingTaskId, energyBefore);
      setSessionId(session.id);
      setRunning(true);
      setPhase('running');
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch { /* ignore */ }
  };

  const handleStop = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('review');
  };

  const handleFinish = async () => {
    if (!sessionId) return;
    try {
      await api.endSession(sessionId, { energy_after: energyAfter, focus_rating: focusRating });
      closeModal();
    } catch { /* ignore */ }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={phase !== 'running' ? closeModal : undefined} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-surface-900">
          {phase === 'setup' ? 'Start Session' : phase === 'running' ? 'Working...' : 'Session Complete'}
        </h2>
        {task && <p className="mt-1 text-sm text-surface-400">{task.title}</p>}

        {phase === 'setup' && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-surface-500">How's your energy right now?</label>
              <div className="flex gap-2">
                {(['LOW', 'MEDIUM', 'HIGH'] as EnergyLevel[]).map(e => (
                  <button key={e} onClick={() => setEnergyBefore(e)}
                    className={`flex-1 rounded-xl py-3 text-sm font-medium ${energyBefore === e ? (e === 'HIGH' ? 'bg-emerald-100 text-emerald-700' : e === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-surface-200 text-surface-700') : 'bg-surface-100 text-surface-400'}`}>
                    {e === 'HIGH' ? 'Energized' : e === 'MEDIUM' ? 'Okay' : 'Tired'}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleStart} className="w-full rounded-xl bg-accent-500 py-3 text-sm font-medium text-white hover:bg-accent-600">
              Start Timer
            </button>
          </div>
        )}

        {phase === 'running' && (
          <div className="mt-6 text-center">
            <p className="font-mono text-6xl font-bold tracking-tight text-surface-900">{formatTime(elapsed)}</p>
            <p className="mt-2 text-sm text-surface-400">{Math.round(elapsed / 60)} minutes</p>
            <button onClick={handleStop} className="mt-8 w-full rounded-xl bg-red-500 py-3 text-sm font-medium text-white hover:bg-red-600">
              Stop Session
            </button>
          </div>
        )}

        {phase === 'review' && (
          <div className="mt-4 space-y-4">
            <p className="text-center text-2xl font-bold text-surface-900">{formatTime(elapsed)}</p>
            <div>
              <label className="mb-2 block text-xs font-medium text-surface-500">Energy after session</label>
              <div className="flex gap-2">
                {(['LOW', 'MEDIUM', 'HIGH'] as EnergyLevel[]).map(e => (
                  <button key={e} onClick={() => setEnergyAfter(e)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${energyAfter === e ? (e === 'HIGH' ? 'bg-emerald-100 text-emerald-700' : e === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-surface-200 text-surface-700') : 'bg-surface-100 text-surface-400'}`}>
                    {e === 'HIGH' ? 'Good' : e === 'MEDIUM' ? 'Okay' : 'Drained'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-surface-500">Focus rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(r => (
                  <button key={r} onClick={() => setFocusRating(r)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${focusRating === r ? 'bg-accent-100 text-accent-700' : 'bg-surface-100 text-surface-400'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleFinish} className="w-full rounded-xl bg-accent-500 py-3 text-sm font-medium text-white hover:bg-accent-600">
              Save & Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
