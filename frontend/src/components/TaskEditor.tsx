import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import * as api from '../services/api';
import type { EnergyLevel, Priority, Course } from '../types';

const ENERGY_LEVELS: EnergyLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

export default function TaskEditor() {
  const closeModal = useAppStore((s) => s.closeModal);
  const editingTaskId = useAppStore((s) => s.editingTaskId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [energy, setEnergy] = useState<EnergyLevel>('MEDIUM');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [dueDate, setDueDate] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCourses().then(setCourses).catch(() => {});
    if (editingTaskId) {
      api.getTask(editingTaskId).then((task) => {
        setTitle(task.title);
        setDescription(task.description || '');
        setPriority(task.priority);
        setEnergy(task.energy_required);
        setEstimatedMinutes(task.estimated_minutes);
        setDueDate(task.due_date?.split('T')[0] || '');
        setScheduledDate(task.scheduled_date || '');
        setCourseId(task.course_id || '');
      }).catch(() => {});
    }
  }, [editingTaskId]);

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError(null);
    try {
      const data = { title: title.trim(), description: description.trim() || undefined, priority, energy_required: energy, estimated_minutes: estimatedMinutes, due_date: dueDate || undefined, scheduled_date: scheduledDate || undefined, course_id: courseId || undefined };
      if (editingTaskId) await api.updateTask(editingTaskId, data);
      else await api.createTask(data);
      closeModal();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!editingTaskId) return;
    try { await api.deleteTask(editingTaskId); closeModal(); }
    catch { setError('Failed to delete task'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={closeModal} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-surface-900">{editingTaskId ? 'Edit Task' : 'New Task'}</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-500">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?"
              className="w-full rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-900 outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-surface-500">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-900 outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-500">Priority</label>
              <div className="flex gap-1">
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => setPriority(p)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium capitalize ${priority === p ? (p === 'high' ? 'bg-red-100 text-red-700' : p === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-surface-200 text-surface-700') : 'bg-surface-100 text-surface-400'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-500">Energy</label>
              <div className="flex gap-1">
                {ENERGY_LEVELS.map(e => (
                  <button key={e} onClick={() => setEnergy(e)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${energy === e ? (e === 'HIGH' ? 'bg-emerald-100 text-emerald-700' : e === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-surface-200 text-surface-700') : 'bg-surface-100 text-surface-400'}`}>
                    {e.charAt(0) + e.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-500">Est. Minutes</label>
              <input type="number" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 0)} min={5} step={5}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-500">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-500">Scheduled</label>
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400" />
            </div>
          </div>

          {courses.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-500">Course</label>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent-400">
                <option value="">No course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <div>{editingTaskId && <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-600">Delete</button>}</div>
            <div className="flex gap-2">
              <button onClick={closeModal} className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-500 hover:bg-surface-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-xl bg-accent-500 px-5 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50">
                {saving ? 'Saving...' : editingTaskId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
