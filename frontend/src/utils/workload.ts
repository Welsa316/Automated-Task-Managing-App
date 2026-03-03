export function getIntensityLevel(totalUnits: number): 0 | 1 | 2 | 3 | 4 {
  if (totalUnits === 0) return 0;
  if (totalUnits <= 4) return 1;
  if (totalUnits <= 8) return 2;
  if (totalUnits <= 14) return 3;
  return 4;
}

export function getIntensityLabel(level: 0 | 1 | 2 | 3 | 4): string {
  return ['Empty', 'Light', 'Moderate', 'Heavy', 'Overloaded'][level];
}
