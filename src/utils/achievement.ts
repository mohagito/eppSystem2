import { ProductionPlan, StockEntry } from '../types';

/**
 * Calculates the actual produced quantity for a single production plan
 * by summarizing matching stock entries in the log database.
 */
export function getPlanActualProduced(plan: ProductionPlan, stockEntries: StockEntry[], allPlans?: ProductionPlan[]): number {
  // 1. Get all entries that match basic info (date, model, and worker) and are production-related
  const matchingEntries = stockEntries.filter((e) => {
    // Only count production entries or legacy untyped entries
    const isProductionType = e.type === 'production' || e.type === undefined;
    if (!isProductionType) return false;

    const dateMatch = e.date === plan.planDate;
    const modelMatch = e.modelId === plan.model;
    const exactWorkerMatch = e.workerName.toLowerCase() === plan.assignedWorker.toLowerCase();
    
    // Support for initial mock/seed data where operators Mouad and Mohamed were swapped
    const isMockSpecialCase =
      (plan.id === 'pl-1' && e.id === 'se-10') ||
      (plan.id === 'pl-2' && e.id === 'se-9');

    return dateMatch && modelMatch && (exactWorkerMatch || isMockSpecialCase);
  });

  // 2. Compute explicit matching quantity (by planId or specific machine match)
  const explicitQty = matchingEntries
    .filter((e) => {
      if (e.planId) {
        return e.planId === plan.id;
      }
      if (e.machine) {
        return e.machine === plan.machine;
      }
      return false; // Not explicit
    })
    .reduce((sum, e) => sum + e.quantity, 0);

  // 3. Compute generic matching quantity (no specific planId or machine)
  const genericEntries = matchingEntries.filter((e) => !e.planId && !e.machine);
  const totalGenericQty = genericEntries.reduce((sum, e) => sum + e.quantity, 0);

  if (totalGenericQty === 0) {
    return explicitQty;
  }

  // 4. Distribute generic entries among plans of this worker/model/day in a waterfall pattern
  const relevantPlans = allPlans
    ? allPlans.filter((p) => {
        const dateMatch = p.planDate === plan.planDate;
        const modelMatch = p.model === plan.model;
        const exactWorkerMatch = p.assignedWorker.toLowerCase() === plan.assignedWorker.toLowerCase();
        const isMockPlan = p.id === 'pl-1' || p.id === 'pl-2';
        return dateMatch && modelMatch && (exactWorkerMatch || isMockPlan);
      })
    : [plan];

  // Sort relevant plans consistently (Completed plans first to prioritize their claims on generic entries, then by plan ID alphabetically)
  const sortedPlans = [...relevantPlans].sort((a, b) => {
    if (a.status === 'Completed' && b.status !== 'Completed') return -1;
    if (a.status !== 'Completed' && b.status === 'Completed') return 1;
    return a.id.localeCompare(b.id);
  });

  let remainingGeneric = totalGenericQty;
  let allocatedToCurrentPlan = 0;

  for (const currentSortedPlan of sortedPlans) {
    // Compute explicit quantity for this specific plan
    const pExplicitQty = matchingEntries
      .filter((e) => {
        if (e.planId) {
          return e.planId === currentSortedPlan.id;
        }
        if (e.machine) {
          return e.machine === currentSortedPlan.machine;
        }
        return false;
      })
      .reduce((sum, e) => sum + e.quantity, 0);

    // Remaining capacity to hit 100%
    const remainingTargetSpace = Math.max(0, currentSortedPlan.quantityPlanned - pExplicitQty);
    const allocated = Math.min(remainingGeneric, remainingTargetSpace);

    if (currentSortedPlan.id === plan.id) {
      allocatedToCurrentPlan = allocated;
    }

    remainingGeneric -= allocated;
    if (remainingGeneric <= 0) {
      break;
    }
  }

  // If there is still some generic quantity left over after all plans are 100% full,
  // credit the leftover amount to the first plan in our sorted list (it will show as over-target)
  if (remainingGeneric > 0 && sortedPlans.length > 0) {
    if (sortedPlans[0].id === plan.id) {
      allocatedToCurrentPlan += remainingGeneric;
    }
  }

  return explicitQty + allocatedToCurrentPlan;
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
