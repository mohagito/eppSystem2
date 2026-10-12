/**
 * Profit Dashboard Calculations Engine
 * 
 * Company Labor Cost Model:
 * - 1 worker cost/day: 8h = 143.36 DH + 60.00 DH prima = 203.36 DH
 * - 1 worker cost/week (6 days): 6 * 203.36 DH = 1,220.16 DH
 * - 3 workers cost/day: 3 * 203.36 DH = 610.08 DH
 * - 3 workers cost/week (6 days): 3 * 1,220.16 DH = 3,660.48 DH
 * 
 * Calendar & Period Accounting Rules:
 * - Company Month: Starts on the 26th of month M-1 and finishes on the 25th of month M.
 * - Week System: ISO 8601 weeks (Monday to Sunday, 6 working days: Mon-Sat, Sun off).
 * - Period Generation: Starts from the earliest roll opened date in history.
 * - Money Company Makes: Net Profit = Gross Profit (DH) - Operators Cost (DH).
 */

import { RollEntry } from '../types';
import { 
  calculateRollProductionMetrics, 
  normalizeRollStatus,
  formatEuroCurrency 
} from './financialCalculations';

export interface WorkerCostConfig {
  workersCount: number;         // default: 3
  hoursPerDay: number;          // default: 8
  baseWageDailyDH: number;      // default: 143.36 DH
  primaDailyDH: number;         // default: 60.00 DH
  workingDaysPerWeek: number;   // default: 6 (Mon-Sat)
  eurToDhRate: number;          // default: 10.80 DH / EUR
}

export const DEFAULT_WORKER_COST_CONFIG: WorkerCostConfig = {
  workersCount: 3,
  hoursPerDay: 8,
  baseWageDailyDH: 143.36,
  primaDailyDH: 60.00,
  workingDaysPerWeek: 6,
  eurToDhRate: 10.80
};

const STORAGE_KEY_PROFIT_CONFIG = 'epp_profit_worker_cost_config';

export function getSavedWorkerCostConfig(): WorkerCostConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFIT_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        workersCount: Number(parsed.workersCount) || DEFAULT_WORKER_COST_CONFIG.workersCount,
        hoursPerDay: Number(parsed.hoursPerDay) || DEFAULT_WORKER_COST_CONFIG.hoursPerDay,
        baseWageDailyDH: Number(parsed.baseWageDailyDH) || DEFAULT_WORKER_COST_CONFIG.baseWageDailyDH,
        primaDailyDH: Number(parsed.primaDailyDH) !== undefined ? Number(parsed.primaDailyDH) : DEFAULT_WORKER_COST_CONFIG.primaDailyDH,
        workingDaysPerWeek: Number(parsed.workingDaysPerWeek) || DEFAULT_WORKER_COST_CONFIG.workingDaysPerWeek,
        eurToDhRate: Number(parsed.eurToDhRate) || DEFAULT_WORKER_COST_CONFIG.eurToDhRate
      };
    }
  } catch {}
  return DEFAULT_WORKER_COST_CONFIG;
}

export function saveWorkerCostConfig(config: WorkerCostConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROFIT_CONFIG, JSON.stringify(config));
  } catch {}
}

const STORAGE_KEY_WORKING_DAYS = 'epp_profit_working_days_overrides';

export function getSavedWorkingDaysOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORKING_DAYS);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure period CM-2026-10 always defaults to 8 days unless explicitly set
      if (!parsed['CM-2026-10'] || parsed['CM-2026-10'] === 25) {
        parsed['CM-2026-10'] = 8;
      }
      return {
        'CM-2026-10': 8, // Factory actual: 2 Oct to 10 Oct minus 1 Sunday = 8 days
        ...parsed
      };
    }
  } catch {}
  return {
    'CM-2026-10': 8 // Factory actual: 2 Oct to 10 Oct minus 1 Sunday = 8 days
  };
}

export function saveWorkingDaysOverride(periodId: string, days: number): void {
  try {
    const current = getSavedWorkingDaysOverrides();
    current[periodId] = days;
    localStorage.setItem(STORAGE_KEY_WORKING_DAYS, JSON.stringify(current));
  } catch {}
}

/**
 * Calculates single worker daily and weekly cost
 */
export function getSingleWorkerCost(config: WorkerCostConfig) {
  const daily = Math.round((config.baseWageDailyDH + config.primaDailyDH) * 100) / 100;
  const weekly = Math.round(daily * config.workingDaysPerWeek * 100) / 100;
  return { daily, weekly };
}

/**
 * Calculates total workforce daily and weekly cost
 */
export function getTotalWorkforceCost(config: WorkerCostConfig) {
  const single = getSingleWorkerCost(config);
  const daily = Math.round(single.daily * config.workersCount * 100) / 100;
  const weekly = Math.round(single.weekly * config.workersCount * 100) / 100;
  return {
    singleWorkerDaily: single.daily,
    singleWorkerWeekly: single.weekly,
    totalDaily: daily,
    totalWeekly: weekly
  };
}

/**
 * Formats Moroccan Dirham amounts cleanly (e.g. 3,660.48 DH)
 */
export function formatDhCurrency(amount: number, decimals: number = 2): string {
  if (isNaN(amount) || amount === undefined || amount === null) return '0.00 DH';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount);
  return `${formatted} DH`;
}

/**
 * Finds the earliest opened roll date across all active/closed rolls
 */
export function getFirstRollOpenedDate(rolls: RollEntry[]): Date {
  let earliestTimestamp: number | null = null;

  rolls.forEach((r) => {
    const status = normalizeRollStatus(r.status);
    if (status === 'IN PRODUCTION' || status === 'CLOSED' || r.openedAt) {
      const candidates = [r.openedAt, r.date, r.createdAt].filter(Boolean);
      candidates.forEach((c) => {
        const t = new Date(c as string).getTime();
        if (!isNaN(t) && t > 0) {
          if (earliestTimestamp === null || t < earliestTimestamp) {
            earliestTimestamp = t;
          }
        }
      });
    }
  });

  // Default to 29 Sep 2026 (Roll 43968015 first production roll) if no active rolls yet
  if (!earliestTimestamp) {
    return new Date('2026-09-29T10:39:00Z');
  }

  return new Date(earliestTimestamp);
}

/**
 * Company Month Period:
 * Runs from day 26 of month M-1 to day 25 of month M.
 */
export interface CompanyMonthPeriod {
  id: string; // e.g. "CM-2026-10"
  label: string; // e.g. "26 Sep 2026 – 25 Oct 2026"
  shortLabel: string; // e.g. "Oct 2026 Cycle"
  cycleMonth: number; // target month (1-12)
  cycleYear: number;
  startDate: Date; // e.g. 2026-09-26 00:00:00
  endDate: Date; // e.g. 2026-10-25 23:59:59
  workingDays: number; // working days (Mon-Sat) in the range
}

/**
 * Determines the company month period for any given date
 */
export function getCompanyMonthForDate(date: Date): CompanyMonthPeriod {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();

  let startYear = year;
  let startMonth = month;
  let cycleMonth = month + 1; // 1-indexed human month
  let cycleYear = year;

  if (day >= 26) {
    // Current date is 26th or later: period started on the 26th of current calendar month,
    // and ends on 25th of next calendar month.
    startYear = year;
    startMonth = month;
    if (month === 11) {
      cycleMonth = 1;
      cycleYear = year + 1;
    } else {
      cycleMonth = month + 2;
      cycleYear = year;
    }
  } else {
    // Current date is 1st to 25th: period started on the 26th of previous calendar month,
    // and ends on 25th of current calendar month.
    if (month === 0) {
      startYear = year - 1;
      startMonth = 11;
    } else {
      startYear = year;
      startMonth = month - 1;
    }
    cycleMonth = month + 1;
    cycleYear = year;
  }

  const startDate = new Date(startYear, startMonth, 26, 0, 0, 0, 0);
  
  // End date is 25th of the cycle month
  // In JS Date, cycleMonth is 1-indexed, so cycleMonth - 1 is the 0-indexed month
  const endDate = new Date(cycleYear, cycleMonth - 1, 25, 23, 59, 59, 999);
  const id = `CM-${cycleYear}-${String(cycleMonth).padStart(2, '0')}`;

  // Actual factory working days:
  // For period CM-2026-10 (26 Sep - 25 Oct 2026), production is strictly from 2 Oct to 10 Oct minus 1 Sunday = 8 days
  let workingDays = countWorkingDays(startDate, endDate);
  if (id === 'CM-2026-10') {
    workingDays = 8;
  }

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const startStr = `${startDate.getDate()} ${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
  const endStr = `${endDate.getDate()} ${monthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;
  const label = `${startStr} – ${endStr}`;
  const shortLabel = `${fullMonthNames[cycleMonth - 1]} ${cycleYear}`;

  return {
    id,
    label,
    shortLabel,
    cycleMonth,
    cycleYear,
    startDate,
    endDate,
    workingDays
  };
}

/**
 * ISO Week Period:
 * Runs from Monday to Sunday. 6 working days (Monday through Saturday).
 */
export interface IsoWeekPeriod {
  id: string; // e.g. "W41-2026"
  label: string; // e.g. "Week 41 (05 Oct – 11 Oct 2026)"
  weekNumber: number; // 1-53
  year: number;
  startDate: Date; // Monday 00:00:00
  endDate: Date; // Sunday 23:59:59
  workingDays: number; // 6 working days (Mon-Sat)
}

/**
 * Calculates ISO week number and year for a date
 */
export function getIsoWeekDetails(date: Date): { weekNumber: number; year: number } {
  const target = new Date(date.valueOf());
  // ISO week starts on Monday (1). In JS: 0=Sun, 1=Mon, ..., 6=Sat
  const dayNr = (date.getDay() + 6) % 7; // 0=Mon, ..., 6=Sun
  target.setDate(target.getDate() - dayNr + 3); // Nearest Thursday
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { weekNumber, year: new Date(firstThursday).getFullYear() };
}

/**
 * Gets ISO week period for any date
 */
export function getIsoWeekForDate(date: Date): IsoWeekPeriod {
  const { weekNumber, year } = getIsoWeekDetails(date);
  
  // Find Monday of this week
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const mStr = `${String(monday.getDate()).padStart(2, '0')} ${monthNames[monday.getMonth()]}`;
  const sStr = `${String(sunday.getDate()).padStart(2, '0')} ${monthNames[sunday.getMonth()]} ${sunday.getFullYear()}`;
  const label = `Week ${weekNumber} (${mStr} – ${sStr})`;

  return {
    id: `W${String(weekNumber).padStart(2, '0')}-${year}`,
    label,
    weekNumber,
    year,
    startDate: monday,
    endDate: sunday,
    workingDays: 6 // Monday through Saturday
  };
}

/**
 * Counts working days (Monday to Saturday, Sunday excluded) between two dates inclusive
 */
export function countWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const cur = new Date(startDate);
  cur.setHours(12, 0, 0, 0); // avoid DST border issues
  const end = new Date(endDate);
  end.setHours(12, 0, 0, 0);

  while (cur <= end) {
    const day = cur.getDay(); // 0 is Sunday
    if (day !== 0) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Generates all Company Month periods starting from earliest roll open date up to current date + 1
 */
export function generateCompanyMonthsFromFirstRoll(
  firstRollDate: Date,
  currentDate: Date = new Date()
): CompanyMonthPeriod[] {
  const periods: CompanyMonthPeriod[] = [];
  const startPeriod = getCompanyMonthForDate(firstRollDate);
  const endPeriod = getCompanyMonthForDate(currentDate);

  let curYear = startPeriod.startDate.getFullYear();
  let curMonth = startPeriod.startDate.getMonth(); // 0-indexed month of the start date (the 26th)

  // Maximum safeguard 36 months
  for (let i = 0; i < 36; i++) {
    const checkDate = new Date(curYear, curMonth, 27, 12, 0, 0);
    const p = getCompanyMonthForDate(checkDate);
    
    // Avoid duplicates
    if (!periods.some(existing => existing.id === p.id)) {
      periods.push(p);
    }

    if (p.id === endPeriod.id || p.startDate > endPeriod.startDate) {
      break;
    }

    curMonth++;
    if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }
  }

  // Reverse so newest period is first
  return periods.reverse();
}

/**
 * Generates all ISO Week periods starting from earliest roll open date up to current date
 */
export function generateIsoWeeksFromFirstRoll(
  firstRollDate: Date,
  currentDate: Date = new Date()
): IsoWeekPeriod[] {
  const weeks: IsoWeekPeriod[] = [];
  const startWeek = getIsoWeekForDate(firstRollDate);
  const endWeek = getIsoWeekForDate(currentDate);

  let cur = new Date(startWeek.startDate);
  cur.setHours(12, 0, 0, 0);

  const maxDate = new Date(endWeek.endDate);
  maxDate.setHours(23, 59, 59, 999);

  for (let i = 0; i < 156; i++) { // up to 3 years
    const w = getIsoWeekForDate(cur);
    if (!weeks.some(existing => existing.id === w.id)) {
      weeks.push(w);
    }
    if (w.id === endWeek.id || cur > maxDate) {
      break;
    }
    cur.setDate(cur.getDate() + 7);
  }

  return weeks.reverse();
}

/**
 * Detailed Roll Profit Metric inside a period
 */
export interface RollPeriodProfitDetail {
  roll: RollEntry;
  barcode: string;
  material: string;
  referenceId: string;
  openedAt?: string;
  status: string;
  producedPieces: number;
  rollCostEur: number;
  productionValueEur: number;
  grossProfitEur: number;
  grossProfitDH: number;
  materialEfficiency: number;
}

/**
 * Period Financial Evaluation Result (Month, Week, or Cumulative All-Time)
 */
export interface PeriodProfitResult {
  periodId: string;
  periodLabel: string;
  shortLabel: string;
  startDate: Date;
  endDate: Date;
  workingDays: number;
  
  // Workforce Labor Breakdown
  workersCount: number;
  operatorDailyCostDH: number;      // 203.36 DH
  workforceDailyCostDH: number;     // workersCount * 203.36 DH = 610.08 DH
  workforceWeeklyCostDH: number;    // 6 * workforceDailyCostDH = 3,660.48 DH
  totalLaborCostDH: number;         // workingDays * workforceDailyCostDH
  totalLaborCostEur: number;        // totalLaborCostDH / eurToDhRate

  // Roll Production Financials
  rollsCount: number;
  totalProducedPieces: number;
  totalRollCostEur: number;
  totalProductionValueEur: number;
  grossProfitEur: number;
  grossProfitDH: number;
  
  // NET PROFIT (HOW MUCH MONEY THE COMPANY MAKES)
  // Formula: Gross Profit - Operators Cost
  netProfitDH: number;
  netProfitEur: number;
  netProfitMarginPercent: number;    // (netProfitDH / grossProfitDH) * 100
  roiPercent: number;                 // (netProfitDH / (totalLaborCostDH + totalRollCostDH)) * 100

  // Rolls in this period
  rolls: RollPeriodProfitDetail[];
}

/**
 * Calculates financial profit for any date range given rolls and config
 */
export function calculatePeriodProfit(
  periodId: string,
  periodLabel: string,
  shortLabel: string,
  startDate: Date,
  endDate: Date,
  workingDays: number,
  rolls: RollEntry[],
  config: WorkerCostConfig,
  stockEntries: any[] = []
): PeriodProfitResult {
  const single = getSingleWorkerCost(config);
  const workforce = getTotalWorkforceCost(config);
  
  const totalLaborCostDH = Math.round(workingDays * workforce.totalDaily * 100) / 100;
  const totalLaborCostEur = config.eurToDhRate > 0 
    ? Math.round((totalLaborCostDH / config.eurToDhRate) * 100) / 100 
    : 0;

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  // Find rolls that belong to this date range
  const periodRolls: RollPeriodProfitDetail[] = [];
  let totalProducedPieces = 0;
  let totalRollCostEur = 0;
  let totalProductionValueEur = 0;
  let grossProfitEur = 0;

  rolls.forEach((roll) => {
    const status = normalizeRollStatus(roll.status);
    if (status !== 'IN PRODUCTION' && status !== 'CLOSED') {
      return;
    }

    // Determine the effective date of the roll
    const dateCandidate = roll.openedAt || roll.date || roll.createdAt;
    if (!dateCandidate) return;

    const rollTime = new Date(dateCandidate).getTime();
    if (isNaN(rollTime)) return;

    // Check if roll falls within [startDate, endDate]
    if (rollTime >= startMs && rollTime <= endMs) {
      const metrics = calculateRollProductionMetrics(roll, undefined, undefined, stockEntries);
      
      const gProfitEur = metrics.grossProfit;
      const gProfitDH = Math.round(gProfitEur * config.eurToDhRate * 100) / 100;

      totalProducedPieces += metrics.producedPieces;
      totalRollCostEur += metrics.rollCost;
      totalProductionValueEur += metrics.productionValue;
      grossProfitEur += gProfitEur;

      periodRolls.push({
        roll,
        barcode: roll.barcode || roll.id,
        material: metrics.material,
        referenceId: metrics.referenceId,
        openedAt: roll.openedAt || roll.date,
        status: metrics.status,
        producedPieces: metrics.producedPieces,
        rollCostEur: metrics.rollCost,
        productionValueEur: metrics.productionValue,
        grossProfitEur: gProfitEur,
        grossProfitDH: gProfitDH,
        materialEfficiency: metrics.materialEfficiency
      });
    }
  });

  totalRollCostEur = Math.round(totalRollCostEur * 100) / 100;
  totalProductionValueEur = Math.round(totalProductionValueEur * 100) / 100;
  grossProfitEur = Math.round(grossProfitEur * 100) / 100;
  const grossProfitDH = Math.round(grossProfitEur * config.eurToDhRate * 100) / 100;

  // NET PROFIT = Gross Profit (DH) - Operators Cost (DH)
  const netProfitDH = Math.round((grossProfitDH - totalLaborCostDH) * 100) / 100;
  const netProfitEur = config.eurToDhRate > 0
    ? Math.round((netProfitDH / config.eurToDhRate) * 100) / 100
    : 0;

  const netProfitMarginPercent = grossProfitDH !== 0
    ? Math.round((netProfitDH / Math.abs(grossProfitDH)) * 10000) / 100
    : 0;

  const totalCostDH = totalLaborCostDH + (totalRollCostEur * config.eurToDhRate);
  const roiPercent = totalCostDH > 0
    ? Math.round((netProfitDH / totalCostDH) * 10000) / 100
    : 0;

  return {
    periodId,
    periodLabel,
    shortLabel,
    startDate,
    endDate,
    workingDays,
    workersCount: config.workersCount,
    operatorDailyCostDH: single.daily,
    workforceDailyCostDH: workforce.totalDaily,
    workforceWeeklyCostDH: workforce.totalWeekly,
    totalLaborCostDH,
    totalLaborCostEur,
    rollsCount: periodRolls.length,
    totalProducedPieces,
    totalRollCostEur,
    totalProductionValueEur,
    grossProfitEur,
    grossProfitDH,
    netProfitDH,
    netProfitEur,
    netProfitMarginPercent,
    roiPercent,
    rolls: periodRolls
  };
}
