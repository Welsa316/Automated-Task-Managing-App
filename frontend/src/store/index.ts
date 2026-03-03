import { create } from 'zustand';
import type { EnergyLevel, ScreenName } from '../types';

interface AppState {
  activeScreen: ScreenName;
  canvasConnected: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  currentEnergy: EnergyLevel;
  modalOpen: string | null;
  editingTaskId: string | null;

  setActiveScreen: (screen: ScreenName) => void;
  setCanvasConnected: (connected: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncAt: (date: string | null) => void;
  setCurrentEnergy: (energy: EnergyLevel) => void;
  openModal: (modal: string, taskId?: string) => void;
  closeModal: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeScreen: 'today',
  canvasConnected: false,
  syncing: false,
  lastSyncAt: null,
  currentEnergy: 'MEDIUM',
  modalOpen: null,
  editingTaskId: null,

  setActiveScreen: (screen) => set({ activeScreen: screen }),
  setCanvasConnected: (connected) => set({ canvasConnected: connected }),
  setSyncing: (syncing) => set({ syncing }),
  setLastSyncAt: (date) => set({ lastSyncAt: date }),
  setCurrentEnergy: (energy) => set({ currentEnergy: energy }),
  openModal: (modal, taskId) => set({ modalOpen: modal, editingTaskId: taskId ?? null }),
  closeModal: () => set({ modalOpen: null, editingTaskId: null }),
}));
