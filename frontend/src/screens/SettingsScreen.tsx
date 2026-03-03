import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { useAppStore } from '../store';
import * as api from '../services/api';

export default function SettingsScreen() {
  const canvasConnected = useAppStore((s) => s.canvasConnected);
  const setCanvasConnected = useAppStore((s) => s.setCanvasConnected);
  const syncing = useAppStore((s) => s.syncing);
  const setSyncing = useAppStore((s) => s.setSyncing);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const setLastSyncAt = useAppStore((s) => s.setLastSyncAt);

  const [canvasUrl, setCanvasUrl] = useState('');
  const [canvasToken, setCanvasToken] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('cf_api_key') ?? '');

  useEffect(() => {
    api.getCanvasStatus().then((s) => { setCanvasConnected(s.connected); setLastSyncAt(s.lastSync ?? null); }).catch(() => {});
  }, [setCanvasConnected, setLastSyncAt]);

  const handleConnect = async () => {
    if (!canvasUrl.trim() || !canvasToken.trim()) { setConnectError('Both URL and token required.'); return; }
    setConnecting(true); setConnectError(null);
    try { await api.connectCanvas(canvasUrl.trim(), canvasToken.trim()); setCanvasConnected(true); setCanvasUrl(''); setCanvasToken(''); }
    catch (err) { setConnectError(err instanceof Error ? err.message : 'Failed to connect'); }
    finally { setConnecting(false); }
  };

  const handleDisconnect = async () => { try { await api.disconnectCanvas(); setCanvasConnected(false); setLastSyncAt(null); } catch { /* ignore */ } };

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null);
    try { const r = await api.syncCanvas(); setSyncResult(`Synced ${r.coursesSynced} courses, ${r.assignmentsSynced} assignments`); setLastSyncAt(new Date().toISOString()); }
    catch (err) { setSyncResult(err instanceof Error ? err.message : 'Sync failed'); }
    finally { setSyncing(false); }
  };

  const handleSaveApiKey = () => { if (apiKey.trim()) localStorage.setItem('cf_api_key', apiKey.trim()); else localStorage.removeItem('cf_api_key'); setSyncResult('API key saved'); };
  const handleRecalculate = async () => { try { await api.recalculateMetrics(); setSyncResult('Analytics recalculated'); } catch { setSyncResult('Failed'); } };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-surface-900">Settings</h1>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-surface-400">Canvas Connection</h2>
        {canvasConnected ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <div>
                <p className="text-sm font-medium text-surface-900">Connected to Canvas</p>
                {lastSyncAt && <p className="text-xs text-surface-400">Last synced {format(parseISO(lastSyncAt), 'MMM d, yyyy h:mm a')}</p>}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSync} disabled={syncing} className="rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50">{syncing ? 'Syncing...' : 'Sync Now'}</button>
              <button onClick={handleDisconnect} className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100">Disconnect</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-surface-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">How to get your Canvas token</p>
              <ol className="space-y-1 text-sm text-surface-600">
                <li>1. Log into Canvas → Account → Settings</li>
                <li>2. Scroll to "Approved Integrations"</li>
                <li>3. Click "+ New Access Token"</li>
                <li>4. Copy the token and paste below</li>
              </ol>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Canvas URL</label>
              <input value={canvasUrl} onChange={(e) => setCanvasUrl(e.target.value)} placeholder="https://your-school.instructure.com"
                className="mt-1 w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Access Token</label>
              <input type="password" value={canvasToken} onChange={(e) => setCanvasToken(e.target.value)} placeholder="Paste your Canvas token"
                className="mt-1 w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100" />
            </div>
            {connectError && <p className="text-sm text-red-500">{connectError}</p>}
            <button onClick={handleConnect} disabled={connecting} className="rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50">{connecting ? 'Connecting...' : 'Connect'}</button>
          </div>
        )}
        {syncResult && <p className="mt-3 text-sm text-surface-500">{syncResult}</p>}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-surface-400">API Key</h2>
        <p className="mt-1 text-xs text-surface-400">Stored in your browser only. Must match API_SECRET in .env.</p>
        <div className="mt-3 flex gap-3">
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Your API secret" className="flex-1 rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm outline-none focus:border-accent-400" />
          <button onClick={handleSaveApiKey} className="rounded-xl bg-surface-100 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-200">Save</button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-surface-400">Data</h2>
        <button onClick={handleRecalculate} className="mt-3 rounded-xl bg-surface-100 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-200">Recalculate Analytics</button>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-surface-400">About</h2>
        <p className="mt-2 text-sm font-semibold text-surface-900">Canvas Flow v1.0.0</p>
        <p className="mt-1 text-sm text-surface-500">A calm, intelligent task manager that connects to Canvas LMS.</p>
      </section>
    </motion.div>
  );
}
