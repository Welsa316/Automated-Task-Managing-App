import type { EnergyLevel } from '../types';

export function energyLabel(level: EnergyLevel): string {
  return level === 'HIGH' ? 'High Energy' : level === 'MEDIUM' ? 'Medium Energy' : 'Low Energy';
}

export function energyColor(level: EnergyLevel): string {
  return level === 'HIGH' ? 'text-emerald-600' : level === 'MEDIUM' ? 'text-amber-600' : 'text-surface-500';
}

export function energyBgColor(level: EnergyLevel): string {
  return level === 'HIGH' ? 'bg-emerald-100' : level === 'MEDIUM' ? 'bg-amber-100' : 'bg-surface-200';
}
