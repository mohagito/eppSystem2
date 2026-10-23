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

import { RollEntry, StockEntry } from '../types';
import { 
  calculateRollProductionMetrics, 
  normalizeRollStatus,
  formatEuroCurrency 
} from './financialCalculations';
import { getMoroccoDateStr, formatMoroccoDate } from './timeZone';

export interface WorkerCostConfig {
  workersCount: number;         // default: 3
  hoursPerDay: number;          // default: 8
  ratePerMinuteEur: number;     // default: 0.055 (€/min: comprehensive company rate including base salary, tax, prima, transport & overhead)
  hourlyRateEur?: number;       // default: 3.30 (€/hour: 0.055 * 60)
  baseWageDailyDH: number;      // equivalent: 225.12 DH
  primaDailyDH: number;         // default: 60.00 DH
  workingDaysPerWeek: number;   // default: 6 (Mon-Sat)
  eurToDhRate: number;          // default: 10.80 DH / EUR
}

export const DEFAULT_WORKER_COST_CONFIG: WorkerCostConfig = {
  workersCount: 3,
  hoursPerDay: 8,
  ratePerMinuteEur: 0.055,      // 0.055 € per minute
  hourlyRateEur: 3.30,          // 0.055 * 60 = 3.30 € per hour
  baseWageDailyDH: 225.12,      // 285.12 DH - 60 DH prima
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
      // Upgrade from old legacy settings (143.36 DH / ~55.41 EUR) to the updated general settings (0.055 €/min = 79.20 €/day)
      const isLegacy = parsed.ratePerMinuteEur === undefined || parsed.baseWageDailyDH === 143.36;
      if (isLegacy) {
        const upgraded: WorkerCostConfig = {
          ...DEFAULT_WORKER_COST_CONFIG,
          workersCount: Number(parsed.workersCount) || 3,
          hoursPerDay: Number(parsed.hoursPerDay) || 8,
          ratePerMinuteEur: 0.055,
          hourlyRateEur: 3.30,
          primaDailyDH: 60.00,
          workingDaysPerWeek: Number(parsed.workingDaysPerWeek) || 6,
          eurToDhRate: Number(parsed.eurToDhRate) || 10.80
        };
        saveWorkerCostConfig(upgraded);
        return upgraded;
      }
      return {
        workersCount: Number(parsed.workersCount) || DEFAULT_WORKER_COST_CONFIG.workersCount,
        hoursPerDay: Number(parsed.hoursPerDay) || DEFAULT_WORKER_COST_CONFIG.hoursPerDay,
        ratePerMinuteEur: Number(parsed.ratePerMinuteEur) !== undefined ? Number(parsed.ratePerMinuteEur) : DEFAULT_WORKER_COST_CONFIG.ratePerMinuteEur,
        hourlyRateEur: Number(parsed.hourlyRateEur) || 3.30,
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
 * Calculates single worker daily and weekly cost based on comprehensive rate
 * Rate: 0.055 €/min * 60 min = 3.30 €/h * 8h = 26.40 €/operator/day
 */
export function getSingleWorkerCost(config: WorkerCostConfig) {
  const ratePerMin = config.ratePerMinuteEur !== undefined ? Number(config.ratePerMinuteEur) : 0.055;
  const hours = config.hoursPerDay || 8;
  const hourlyEur = Math.round(ratePerMin * 60 * 100) / 100; // 0.055 * 60 = 3.30 €
  const dailyEur = Math.round(hourlyEur * hours * 100) / 100; // 3.30 * 8 = 26.40 €
  const weeklyEur = Math.round(dailyEur * (config.workingDaysPerWeek || 6) * 100) / 100;

  const rate = config.eurToDhRate || 10.80;
  const dailyDH = Math.round(dailyEur * rate * 100) / 100; // 26.40 * 10.80 = 285.12 DH
  const weeklyDH = Math.round(weeklyEur * rate * 100) / 100;

  return {
    ratePerMin,
    hourlyEur,
    dailyEur,
    weeklyEur,
    daily: dailyDH,
    weekly: weeklyDH
  };
}

/**
 * Calculates total workforce daily and weekly cost
 * Total for 3 operators: 3 * 26.40 € = 79.20 €/day
 */
export function getTotalWorkforceCost(config: WorkerCostConfig) {
  const single = getSingleWorkerCost(config);
  const workers = config.workersCount || 3;
  const totalDailyEur = Math.round(single.dailyEur * workers * 100) / 100; // 79.20 €
  const totalWeeklyEur = Math.round(single.weeklyEur * workers * 100) / 100; // 475.20 €
  const totalDailyDH = Math.round(single.daily * workers * 100) / 100; // 855.36 DH
  const totalWeeklyDH = Math.round(single.weekly * workers * 100) / 100;

  return {
    singleWorkerDaily: single.daily,
    singleWorkerWeekly: single.weekly,
    singleWorkerDailyEur: single.dailyEur,
    singleWorkerWeeklyEur: single.weeklyEur,
    totalDaily: totalDailyDH,
    totalWeekly: totalWeeklyDH,
    totalDailyEur,
    totalWeeklyEur
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
 * Finds the date string (YYYY-MM-DD) of the first roll opened with efficiency calculation.
 * Defaults to '2026-10-02' (2 Oct 2026) as factory efficiency start date.
 */
export function getFirstEfficiencyRollDateStr(rolls: RollEntry[]): string {
  let earliestDateStr: string | null = null;

  rolls.forEach((r) => {
    const status = normalizeRollStatus(r.status);
    if (status === 'IN PRODUCTION' || status === 'CLOSED' || r.openedAt || r.materialEfficiency !== undefined) {
      const candidates = [r.openedAt, r.date, r.createdAt].filter(Boolean);
      candidates.forEach((c) => {
        const dStr = typeof c === 'string' ? c.slice(0, 10) : '';
        if (dStr && dStr.length === 10 && dStr.startsWith('202')) {
          if (!earliestDateStr || dStr < earliestDateStr) {
            earliestDateStr = dStr;
          }
        }
      });
    }
  });

  return earliestDateStr || '2026-10-02';
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
  const workforce = getTotalWorkforceCost(config);
  
  const totalLaborCostEur = Math.round(workingDays * workforce.totalDailyEur * 100) / 100;
  const totalLaborCostDH = Math.round(workingDays * workforce.totalDaily * 100) / 100;

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

    let inRange = false;
    const rollTime = new Date(dateCandidate).getTime();
    if (!isNaN(rollTime) && rollTime >= startMs && rollTime <= endMs) {
      inRange = true;
    } else {
      const candStr = typeof dateCandidate === 'string' ? dateCandidate.slice(0, 10) : '';
      if (candStr && candStr.length === 10) {
        const startStr = getMoroccoDateStr(startDate);
        const endStr = getMoroccoDateStr(endDate);
        if (startStr && endStr && candStr >= startStr && candStr <= endStr) {
          inRange = true;
        }
      }
    }

    // Check if roll falls within [startDate, endDate]
    if (inRange) {
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
    operatorDailyCostDH: workforce.singleWorkerDaily,
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

/**
 * Calculates profit for any custom dynamic date range (e.g. 02-Oct to 12-Oct or single day)
 */
export function calculateDynamicRangeProfit(
  startDateStr: string,
  endDateStr: string,
  workingDays: number,
  rolls: RollEntry[],
  config: WorkerCostConfig,
  workersCountOverride?: number,
  stockEntries: any[] = []
): PeriodProfitResult {
  const [sY, sM, sD] = startDateStr.split('-').map(Number);
  const [eY, eM, eD] = endDateStr.split('-').map(Number);
  const startDate = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
  const endDate = new Date(eY, eM - 1, eD, 23, 59, 59, 999);

  const effectiveConfig = workersCountOverride && workersCountOverride > 0
    ? { ...config, workersCount: workersCountOverride }
    : config;

  const isSingleDay = startDateStr === endDateStr;
  const periodId = isSingleDay ? `DAY-${startDateStr}` : `CUSTOM-${startDateStr}_${endDateStr}`;
  const periodLabel = isSingleDay
    ? formatMoroccoDate(startDate)
    : `${formatMoroccoDate(startDate)} – ${formatMoroccoDate(endDate)}`;
  const shortLabel = isSingleDay
    ? `Single Day (${workingDays}d · ${effectiveConfig.workersCount} ops)`
    : `Custom Range (${workingDays}d · ${effectiveConfig.workersCount} ops)`;

  return calculatePeriodProfit(
    periodId,
    periodLabel,
    shortLabel,
    startDate,
    endDate,
    Math.max(1, workingDays),
    rolls,
    effectiveConfig,
    stockEntries
  );
}

/**
 * Daily Profit Breakdown for Day-by-Day performance analysis:
 * Calculates Gross Profit for the day minus (Operators count * 1 day daily cost)
 */
export interface DailyProfitDetail {
  dateStr: string;           // "2026-10-12"
  displayDate: string;       // "12 Oct 2026"
  dayOfWeek: string;         // "Monday"
  isToday: boolean;
  workingDays: number;       // 1 day
  rollsCount: number;
  totalProducedPieces: number;
  totalRollCostEur: number;
  totalProductionValueEur: number;
  grossProfitEur: number;
  grossProfitDH: number;
  workersCount: number;      // e.g. 3
  dailyLaborCostEur: number; // e.g. 3 * 203.36 / 10.80 = €56.49
  dailyLaborCostDH: number;  // 610.08 DH
  netProfitEur: number;      // grossProfitEur - dailyLaborCostEur
  netProfitDH: number;       // grossProfitDH - dailyLaborCostDH
  netProfitMarginPercent: number;
  avgMaterialEfficiency?: number;
  rolls: RollPeriodProfitDetail[];
}

export function calculateDailyProfitBreakdown(
  rolls: RollEntry[],
  config: WorkerCostConfig,
  stockEntries: any[] = []
): DailyProfitDetail[] {
  const workforce = getTotalWorkforceCost(config);
  const dailyLaborDH = workforce.totalDaily;
  const dailyLaborEur = workforce.totalDailyEur;

  const dateMap = new Map<string, RollEntry[]>();
  const todayStr = getMoroccoDateStr();
  dateMap.set(todayStr, []);

  // Collect all dates that have active or closed rolls
  rolls.forEach((r) => {
    const status = normalizeRollStatus(r.status);
    if (status !== 'IN PRODUCTION' && status !== 'CLOSED' && !r.openedAt) return;
    const cand = r.openedAt || r.date || r.createdAt;
    if (!cand) return;
    const dStr = typeof cand === 'string' ? cand.slice(0, 10) : '';
    if (dStr && dStr.length === 10) {
      if (!dateMap.has(dStr)) {
        dateMap.set(dStr, []);
      }
      dateMap.get(dStr)!.push(r);
    }
  });

  const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return sortedDates.map((dateStr) => {
    const dayRolls = dateMap.get(dateStr) || [];
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    const isToday = dateStr === todayStr;
    const dayOfWeek = dayNames[dateObj.getDay()] || '';
    const displayDate = `${d} ${monthNames[m - 1]} ${y}`;

    let totalProducedPieces = 0;
    let totalRollCostEur = 0;
    let totalProductionValueEur = 0;
    let grossProfitEur = 0;
    const periodRolls: RollPeriodProfitDetail[] = [];

    dayRolls.forEach((roll) => {
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
    });

    totalRollCostEur = Math.round(totalRollCostEur * 100) / 100;
    totalProductionValueEur = Math.round(totalProductionValueEur * 100) / 100;
    grossProfitEur = Math.round(grossProfitEur * 100) / 100;
    const grossProfitDH = Math.round(grossProfitEur * config.eurToDhRate * 100) / 100;

    // NET PROFIT = Gross Profit - Daily Labor (e.g. 3 operators in 1 day)
    const netProfitDH = Math.round((grossProfitDH - dailyLaborDH) * 100) / 100;
    const netProfitEur = config.eurToDhRate > 0
      ? Math.round((netProfitDH / config.eurToDhRate) * 100) / 100
      : 0;

    const netProfitMarginPercent = grossProfitDH !== 0
      ? Math.round((netProfitDH / Math.abs(grossProfitDH)) * 10000) / 100
      : 0;

    const avgMaterialEfficiency = periodRolls.length > 0
      ? Math.round(
          (periodRolls.reduce((sum, r) => sum + (r.materialEfficiency || 0), 0) / periodRolls.length) * 100
        ) / 100
      : 0;

    return {
      dateStr,
      displayDate,
      dayOfWeek,
      isToday,
      workingDays: 1,
      rollsCount: periodRolls.length,
      totalProducedPieces,
      totalRollCostEur,
      totalProductionValueEur,
      grossProfitEur,
      grossProfitDH,
      workersCount: config.workersCount,
      dailyLaborCostEur: dailyLaborEur,
      dailyLaborCostDH: dailyLaborDH,
      netProfitEur,
      netProfitDH,
      netProfitMarginPercent,
      avgMaterialEfficiency,
      rolls: periodRolls
    };
  });
}

/**
 * Roll Profit Summary with Backend Labor Cost Allocation:
 * ROLL => open date => working days based on the production records => close date => gross profit - workers cost
 * 
 * Rules:
 * - Always 3 operators with 60 DH prima each (default: 3 * 203.36 DH = 610.08 DH/day ≈ €56.49/day)
 * - If multiple rolls were worked on during the same day, labor cost is allocated proportionally/split to reduce operator cost
 * - Detects working days from production records, stock movements, and open/close timestamps
 * - Net Profit = Gross Profit - Workers Cost
 */
export interface RollProfitSummary {
  roll: RollEntry;
  barcode: string;
  material: string;
  referenceId: string;
  openedDateStr: string;
  closedDateStr: string;
  isClosed: boolean;
  workingDays: number;
  activeDates: string[];
  producedPieces: number;
  expectedPieces: number;
  materialEfficiency: number;
  rollCostEur: number;
  productionValueEur: number;
  grossProfitEur: number;
  grossProfitDH: number;
  laborCostEur: number;
  laborCostDH: number;
  netProfitEur: number;
  netProfitDH: number;
  netProfitMarginPercent: number;
}

export interface RollsProfitLedgerResult {
  rolls: RollProfitSummary[];
  totalRollsCount: number;
  totalProducedPieces: number;
  totalRollCostEur: number;
  totalProductionValueEur: number;
  totalGrossProfitEur: number;
  totalGrossProfitDH: number;
  totalLaborCostEur: number;
  totalLaborCostDH: number;
  totalNetProfitEur: number;
  totalNetProfitDH: number;
  totalNetProfitMarginPercent: number;
  totalWorkingDays: number;
  workersCount: number;
  dailyLaborCostEur: number;
}

/**
 * Industrial Half-Day Shift Rounding Rule:
 * Matches workshop scheduling (full shifts vs half shifts):
 * - Decimal fraction 0.00 - 0.15: rounds down to whole day (.0) (minor startup/overlap, e.g. 3.07 -> 3, 4.0 -> 4)
 * - Decimal fraction 0.16 - 0.75: rounds to half day (.5) (e.g. 1.33 -> 1.5, 1.53 -> 1.5, 2.45 -> 2.5, 2.75 -> 2.5)
 * - Decimal fraction 0.76 - 0.99: rounds up to next whole day (e.g. 1.88 -> 2, 1.99 -> 2)
 * - Minimum 0.5 day for any opened/worked roll.
 */
export function roundToShiftDays(days: number): number {
  if (days <= 0) return 0;
  const whole = Math.floor(days);
  const frac = Math.round((days - whole) * 100) / 100;

  if (frac <= 0.15) {
    return whole === 0 ? 0.5 : whole;
  }
  if (frac <= 0.75) {
    return whole + 0.5;
  }
  return whole + 1.0;
}

export function calculateRollsWithLaborProfit(
  rolls: RollEntry[],
  config: WorkerCostConfig = DEFAULT_WORKER_COST_CONFIG,
  stockEntries: StockEntry[] = []
): RollsProfitLedgerResult {
  const workforce = getTotalWorkforceCost(config);
  const dailyLaborEur = workforce.totalDailyEur;
  const dailyLaborDH = workforce.totalDaily;

  const getCandDateStr = (cand: any): string => {
    if (!cand) return '';
    if (typeof cand === 'string') {
      const s = cand.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(cand);
      if (!isNaN(d.getTime())) return getMoroccoDateStr(d);
    } else if (cand instanceof Date) {
      return getMoroccoDateStr(cand);
    }
    return '';
  };

  // 1. Filter rolls to only those opened / in production / closed
  const relevantRolls: {
    roll: RollEntry;
    barcode: string;
    metrics: any;
    openedDateStr: string;
    closedDateStr: string;
    isClosed: boolean;
    workDatesMap: Map<string, number>;
  }[] = [];

  rolls.forEach((r) => {
    const status = normalizeRollStatus(r.status);
    if (status !== 'IN PRODUCTION' && status !== 'CLOSED' && !r.openedAt && !r.reconciliation) {
      return;
    }

    const metrics = calculateRollProductionMetrics(r, undefined, undefined, stockEntries);
    const barcode = r.barcode || r.id;
    const isClosed = metrics.status === 'CLOSED';

    const openedDateStr = getCandDateStr(r.openedAt) || getCandDateStr(r.date) || getCandDateStr(r.createdAt) || '2026-10-02';
    let closedDateStr = '';
    if (isClosed) {
      closedDateStr = getCandDateStr(r.closedAt) || 
        getCandDateStr(r.reconciliation?.closedAt) || 
        getCandDateStr((r as any).evaluatedAt) || 
        openedDateStr;
    }

    // Collect daily production quantities for this roll
    const workDatesMap = new Map<string, number>();

    // From roll's own production records
    if (Array.isArray(r.productionRecords)) {
      r.productionRecords.forEach((rec) => {
        const d = getCandDateStr(rec.date) || getCandDateStr(rec.createdAt);
        if (d && d.length === 10) {
          workDatesMap.set(d, (workDatesMap.get(d) || 0) + (Number(rec.quantity) || 1));
        }
      });
    }

    // From stock entries attributed to this roll
    if (Array.isArray(stockEntries)) {
      stockEntries.forEach((entry) => {
        const isThisRoll = 
          entry.rollBarcode === barcode || 
          entry.rollId === r.id || 
          (barcode && entry.notes && entry.notes.includes(barcode)) ||
          (barcode === '43968015' && entry.rollBarcode === '43968015');

        if (isThisRoll && (entry.type === 'production' || !entry.type)) {
          const d = getCandDateStr(entry.date) || getCandDateStr(entry.createdAt);
          if (d && d.length === 10) {
            workDatesMap.set(d, (workDatesMap.get(d) || 0) + (Number(entry.quantity) || 1));
          }
        }
      });
    }

    // If no granular records exist, extrapolate from open date and close date
    if (workDatesMap.size === 0) {
      if (openedDateStr) {
        if (closedDateStr && closedDateStr !== openedDateStr) {
          try {
            const [sY, sM, sD] = openedDateStr.split('-').map(Number);
            const [eY, eM, eD] = closedDateStr.split('-').map(Number);
            const s = new Date(sY, sM - 1, sD, 12, 0, 0);
            const e = new Date(eY, eM - 1, eD, 12, 0, 0);
            const cur = new Date(s);
            while (cur <= e) {
              if (cur.getDay() !== 0) { // Mon to Sat
                workDatesMap.set(getMoroccoDateStr(cur), 1);
              }
              cur.setDate(cur.getDate() + 1);
            }
          } catch {
            workDatesMap.set(openedDateStr, metrics.producedPieces || 1);
          }
        } else {
          workDatesMap.set(openedDateStr, metrics.producedPieces || 1);
        }
      }
    }

    relevantRolls.push({
      roll: r,
      barcode,
      metrics,
      openedDateStr,
      closedDateStr,
      isClosed,
      workDatesMap
    });
  });

  // 2. Map every work date to all rolls active on that day to distribute labor cost
  const dayToRollsMap = new Map<string, { barcode: string; pieces: number }[]>();
  relevantRolls.forEach((item) => {
    item.workDatesMap.forEach((pieces, dStr) => {
      if (!dayToRollsMap.has(dStr)) {
        dayToRollsMap.set(dStr, []);
      }
      dayToRollsMap.get(dStr)!.push({ barcode: item.barcode, pieces });
    });
  });

  // 3. Calculate working days and labor cost for each roll
  let totalProducedPieces = 0;
  let totalRollCostEur = 0;
  let totalProductionValueEur = 0;
  let totalGrossProfitEur = 0;
  let totalLaborCostEur = 0;
  let totalLaborCostDH = 0;

  const resultRolls: RollProfitSummary[] = relevantRolls.map((item) => {
    let effectiveWorkingDays = 0;
    const activeDatesList: string[] = [];

    item.workDatesMap.forEach((pieces, dStr) => {
      activeDatesList.push(dStr);
      const dayRolls = dayToRollsMap.get(dStr) || [];
      if (dayRolls.length <= 1) {
        effectiveWorkingDays += 1;
      } else {
        // Multi-roll day: distribute the day's labor cost
        const dayTotalPieces = dayRolls.reduce((sum, r) => sum + Math.max(0, r.pieces), 0);
        if (dayTotalPieces > 0 && pieces > 0) {
          effectiveWorkingDays += pieces / dayTotalPieces;
        } else {
          effectiveWorkingDays += 1 / dayRolls.length;
        }
      }
    });

    // Apply industrial half-day shift rounding rule (e.g. 1.33 -> 1.5, 1.53 -> 1.5, 1.88 -> 2, 2.75 -> 2.5, 3.07 -> 3)
    effectiveWorkingDays = roundToShiftDays(effectiveWorkingDays);

    const rollLaborEur = Math.round(effectiveWorkingDays * dailyLaborEur * 100) / 100;
    const rollLaborDH = Math.round(effectiveWorkingDays * dailyLaborDH * 100) / 100;

    const gProfitEur = item.metrics.grossProfit;
    const gProfitDH = Math.round(gProfitEur * config.eurToDhRate * 100) / 100;

    // NET PROFIT = Gross Profit - Workers Cost
    const nProfitEur = Math.round((gProfitEur - rollLaborEur) * 100) / 100;
    const nProfitDH = Math.round((gProfitDH - rollLaborDH) * 100) / 100;
    const nMarginPercent = gProfitEur !== 0
      ? Math.round((nProfitEur / Math.abs(gProfitEur)) * 10000) / 100
      : 0;

    totalProducedPieces += item.metrics.producedPieces;
    totalRollCostEur += item.metrics.rollCost;
    totalProductionValueEur += item.metrics.productionValue;
    totalGrossProfitEur += gProfitEur;
    totalLaborCostEur += rollLaborEur;
    totalLaborCostDH += rollLaborDH;

    return {
      roll: item.roll,
      barcode: item.barcode,
      material: item.metrics.material,
      referenceId: item.barcode === '2600056310' || (item.metrics.referenceId && item.metrics.referenceId.includes('CADDY') && item.metrics.referenceId.includes('CRAFTER'))
        ? 'CRAFTER'
        : item.metrics.referenceId,
      openedDateStr: item.openedDateStr,
      closedDateStr: item.closedDateStr,
      isClosed: item.isClosed,
      workingDays: effectiveWorkingDays,
      activeDates: activeDatesList.sort(),
      producedPieces: item.metrics.producedPieces,
      expectedPieces: item.metrics.expectedPieces,
      materialEfficiency: item.metrics.materialEfficiency,
      rollCostEur: item.metrics.rollCost,
      productionValueEur: item.metrics.productionValue,
      grossProfitEur: gProfitEur,
      grossProfitDH: gProfitDH,
      laborCostEur: rollLaborEur,
      laborCostDH: rollLaborDH,
      netProfitEur: nProfitEur,
      netProfitDH: nProfitDH,
      netProfitMarginPercent: nMarginPercent
    };
  });

  // Sort from OLD to NEW (chronological: oldest open date first, up to newest)
  resultRolls.sort((a, b) => {
    const comp = a.openedDateStr.localeCompare(b.openedDateStr);
    if (comp !== 0) return comp;
    return a.barcode.localeCompare(b.barcode);
  });

  totalRollCostEur = Math.round(totalRollCostEur * 100) / 100;
  totalProductionValueEur = Math.round(totalProductionValueEur * 100) / 100;
  totalGrossProfitEur = Math.round(totalGrossProfitEur * 100) / 100;
  totalLaborCostEur = Math.round(totalLaborCostEur * 100) / 100;
  totalLaborCostDH = Math.round(totalLaborCostDH * 100) / 100;

  const totalGrossProfitDH = Math.round(totalGrossProfitEur * config.eurToDhRate * 100) / 100;
  const totalNetProfitEur = Math.round((totalGrossProfitEur - totalLaborCostEur) * 100) / 100;
  const totalNetProfitDH = Math.round((totalGrossProfitDH - totalLaborCostDH) * 100) / 100;
  const totalNetProfitMarginPercent = totalGrossProfitEur !== 0
    ? Math.round((totalNetProfitEur / Math.abs(totalGrossProfitEur)) * 10000) / 100
    : 0;

  const totalWorkingDays = Math.round(resultRolls.reduce((s, r) => s + r.workingDays, 0) * 10) / 10;

  return {
    rolls: resultRolls,
    totalRollsCount: resultRolls.length,
    totalProducedPieces,
    totalRollCostEur,
    totalProductionValueEur,
    totalGrossProfitEur,
    totalGrossProfitDH,
    totalLaborCostEur,
    totalLaborCostDH,
    totalNetProfitEur,
    totalNetProfitDH,
    totalNetProfitMarginPercent,
    totalWorkingDays,
    workersCount: config.workersCount,
    dailyLaborCostEur: dailyLaborEur
  };
}
