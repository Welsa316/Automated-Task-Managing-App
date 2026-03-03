export type EnergyLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type Priority = 'low' | 'medium' | 'high';
export type ScreenName = 'today' | 'week' | 'semester' | 'insights' | 'settings';

export interface Course {
  id: string;
  canvas_id: number | null;
  name: string;
  code: string | null;
  color: string;
  term: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Assignment {
  id: string;
  canvas_id: number | null;
  course_id: string;
  name: string;
  description: string | null;
  assignment_type: string;
  due_at: string | null;
  points_possible: number;
  submitted: boolean;
  workload_units: number;
  course?: Course;
  course_name?: string;
  course_color?: string;
}

export interface Task {
  id: string;
  assignment_id: string | null;
  course_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  energy_required: EnergyLevel;
  estimated_minutes: number;
  actual_minutes: number;
  due_date: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  course_name?: string;
  course_color?: string;
  course?: Course;
}

export interface Session {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  energy_before: EnergyLevel | null;
  energy_after: EnergyLevel | null;
  focus_rating: number;
  notes: string | null;
  task_title?: string;
}

export interface RealityScore {
  daily: number;
  weekly: number;
  calibration: number;
  overall: number;
}

export interface MomentumData {
  rolling7: number;
  consistency: number;
  focusDensity: number;
  trend?: string;
}

export interface ProcrastinationPrediction {
  startDeltaHours: number;
  typicalDelta: number;
  confidence: number;
  warning: boolean;
}

export interface WorkloadWeek {
  weekStart: string;
  weekEnd: string;
  totalUnits: number;
  assignments: Assignment[];
}

export interface SyncSummary {
  coursesSynced: number;
  assignmentsSynced: number;
  errors: string[];
}

export interface SessionStats {
  totalSessions: number;
  totalMinutes: number;
  avgFocus: number;
}

export interface WeeklyMetrics {
  week_start: string;
  planned_tasks: number;
  completed_tasks: number;
  total_estimated_minutes: number;
  total_actual_minutes: number;
  reality_score: number;
  smooth_week_probability: number;
  momentum_score: number;
  consistency_score: number;
}

export interface EnergyProfile {
  id: string;
  day_of_week: number;
  hour: number;
  avg_energy: number;
  avg_focus: number;
  sample_count: number;
}

export interface BehaviorPattern {
  id: string;
  course_id: string | null;
  task_type: string;
  avg_start_delta_hours: number;
  std_dev_hours: number;
  sample_count: number;
  procrastination_score: number;
}
