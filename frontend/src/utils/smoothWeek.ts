export function smoothWeekColor(probability: number): string {
  if (probability >= 80) return 'text-emerald-600';
  if (probability >= 60) return 'text-amber-600';
  return 'text-red-500';
}

export function smoothWeekLabel(probability: number): string {
  if (probability >= 80) return 'Smooth';
  if (probability >= 60) return 'Manageable';
  if (probability >= 40) return 'Tight';
  return 'Overloaded';
}
