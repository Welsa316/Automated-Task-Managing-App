import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store';
import { getCanvasStatus } from './services/api';
import NavBar from './components/NavBar';
import TodayScreen from './screens/TodayScreen';
import WeekScreen from './screens/WeekScreen';
import SemesterScreen from './screens/SemesterScreen';
import InsightsScreen from './screens/InsightsScreen';
import SettingsScreen from './screens/SettingsScreen';
import TaskEditor from './components/TaskEditor';
import SessionTimer from './components/SessionTimer';

export default function App() {
  const modalOpen = useAppStore((s) => s.modalOpen);
  const setCanvasConnected = useAppStore((s) => s.setCanvasConnected);
  const setLastSyncAt = useAppStore((s) => s.setLastSyncAt);

  useEffect(() => {
    getCanvasStatus()
      .then((status) => {
        setCanvasConnected(status.connected);
        setLastSyncAt(status.lastSync ?? null);
      })
      .catch(() => setCanvasConnected(false));
  }, [setCanvasConnected, setLastSyncAt]);

  return (
    <div className="min-h-screen bg-surface-50">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayScreen />} />
          <Route path="/week" element={<WeekScreen />} />
          <Route path="/semester" element={<SemesterScreen />} />
          <Route path="/insights" element={<InsightsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </main>
      {modalOpen === 'task-editor' && <TaskEditor />}
      {modalOpen === 'session-timer' && <SessionTimer />}
    </div>
  );
}
