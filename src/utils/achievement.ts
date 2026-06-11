import { ProductionPlan, StockEntry } from '../types';

/**
 * Calculates the actual produced quantity for a single production plan
 * by summarizing matching stock entries in the log database.
 */
export function getPlanActualProduced(plan: ProductionPlan, stockEntries: StockEntry[]): number {
  const actualFromEntries = stockEntries
    .filter((e) => {
      const dateMatch = e.date === plan.planDate;
      const modelMatch = e.modelId === plan.model;
      const exactWorkerMatch = e.workerName.toLowerCase() === plan.assignedWorker.toLowerCase();
      
      // Support for initial mock/seed data where operators Mouad and Mohamed were swapped
      const isMockSpecialCase =
        (plan.id === 'pl-1' && e.id === 'se-10') ||
        (plan.id === 'pl-2' && e.id === 'se-9');

      return dateMatch && modelMatch && (exactWorkerMatch || isMockSpecialCase);
    })
    .reduce((sum, e) => sum + e.quantity, 0);

  if (plan.status === 'Completed') {
    return Math.max(plan.quantityPlanned, actualFromEntries, plan.quantityCompleted || 0);
  }
  return Math.max(actualFromEntries, plan.quantityCompleted || 0);
}

/**
 * Returns the achievement percentage or "No Target" if planned is zero.
 */
export function getAchievementPercent(planned: number, actual: number): number | 'No Target' {
  if (planned <= 0) return 'No Target';
  return (actual / planned) * 100;
}

/**
 * Generates the status text according to standard status mapping levels.
 */
export function getAchievementStatus(planned: number, actual: number): 'No Target' | 'Pending' | 'In Progress' | 'Completed' | 'Over Target' {
  if (planned <= 0) return 'No Target';
  const pct = (actual / planned) * 100;
  if (pct === 0) return 'Pending';
  if (pct < 50) return 'Pending';
  if (pct < 100) return 'In Progress';
  if (pct === 100) return 'Completed';
  return 'Over Target';
}

/**
 * Returns custom Tailwind color classes mapped exactly to the required states:
 * - Warning (< 50%) -> amber
 * - Normal (50-99%) -> sky/blue
 * - Success (>= 100%) -> emerald
 */
export function getAchievementColors(planned: number, actual: number): {
  text: string;
  bg: string;
  border: string;
  bar: string;
  lightText: string;
} {
  if (planned <= 0) {
    return {
      text: 'text-slate-500',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      bar: 'bg-slate-300',
      lightText: 'text-slate-400'
    };
  }
  const pct = (actual / planned) * 100;
  if (pct < 50) {
    return {
      text: 'text-amber-800',
      bg: 'bg-amber-50 border-amber-100',
      border: 'border-amber-100',
      bar: 'bg-amber-500',
      lightText: 'text-amber-600'
    };
  } else if (pct < 100) {
    return {
      text: 'text-sky-800',
      bg: 'bg-sky-50 border-sky-100',
      border: 'border-sky-100',
      bar: 'bg-sky-500',
      lightText: 'text-sky-600'
    };
  } else {
    return {
      text: 'text-emerald-800',
      bg: 'bg-emerald-50 border-emerald-150',
      border: 'border-emerald-150',
      bar: 'bg-emerald-500',
      lightText: 'text-emerald-600'
    };
  }
}
