import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserProfile, 
  RollEntry, 
  StockEntry, 
  DeliveryEntry,
  FinishedPiecePrice,
  ExpectedYieldConfig
} from '../types';
import { 
  getSavedWorkerCostConfig,
  saveWorkerCostConfig,
  DEFAULT_WORKER_COST_CONFIG,
  WorkerCostConfig,
  getSingleWorkerCost,
  getTotalWorkforceCost,
  getFirstRollOpenedDate,
  generateCompanyMonthsFromFirstRoll,
  generateIsoWeeksFromFirstRoll,
  calculatePeriodProfit,
  getCompanyMonthForDate,
  getIsoWeekForDate,
  getSavedWorkingDaysOverrides,
  saveWorkingDaysOverride,
  CompanyMonthPeriod,
  IsoWeekPeriod,
  PeriodProfitResult
} from '../utils/profitCalculations';
import { 
  formatEuroCurrency, 
  formatEfficiencyPercent 
} from '../utils/financialCalculations';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar, 
  Clock, 
  SlidersHorizontal, 
  RefreshCw, 
  CheckCircle2, 
  Info, 
  ChevronRight, 
  ChevronLeft, 
  Layers, 
  Scroll, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Percent, 
  X, 
  Coins,
  Edit2
} from 'lucide-react';

interface ProfitDashboardProps {
  currentUser: UserProfile;
  rolls: RollEntry[];
  stockEntries?: StockEntry[];
  deliveries?: DeliveryEntry[];
  piecePrices?: FinishedPiecePrice[];
  expectedYields?: ExpectedYieldConfig[];
  onNavigateToRolls?: () => void;
  onNavigateToFinancial?: () => void;
}

type ViewPeriodType = 'month' | 'week';

export default function ProfitDashboard({
  currentUser,
  rolls,
  stockEntries = [],
  deliveries = [],
  onNavigateToRolls,
  onNavigateToFinancial
}: ProfitDashboardProps) {
  // Configuration for worker costs and currency
  const [config, setConfig] = useState<WorkerCostConfig>(getSavedWorkerCostConfig);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Form draft state for configuration modal (DH inputs configured here)
  const [draftWorkersCount, setDraftWorkersCount] = useState<number>(config.workersCount);
  const [draftBaseWage, setDraftBaseWage] = useState<number>(config.baseWageDailyDH);
  const [draftPrima, setDraftPrima] = useState<number>(config.primaDailyDH);
  const [draftWorkingDays, setDraftWorkingDays] = useState<number>(config.workingDaysPerWeek);
  const [draftRate, setDraftRate] = useState<number>(config.eurToDhRate);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);

  // Period View Mode: strictly 2 buttons ('month' 26th-25th | 'week' ISO weeks)
  const [viewType, setViewType] = useState<ViewPeriodType>('month');

  // Currently selected period index or ID
  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');

  // Expanded roll details in table
  const [expandedRollBarcode, setExpandedRollBarcode] = useState<string | null>(null);

  // First roll opened date
  const firstRollDate = useMemo(() => {
    return getFirstRollOpenedDate(rolls);
  }, [rolls]);

  // Generate all company months from first roll
  const companyMonths = useMemo(() => {
    return generateCompanyMonthsFromFirstRoll(firstRollDate, new Date());
  }, [firstRollDate]);

  // Generate all ISO weeks from first roll
  const isoWeeks = useMemo(() => {
    return generateIsoWeeksFromFirstRoll(firstRollDate, new Date());
  }, [firstRollDate]);

  // Initialize selected periods
  useEffect(() => {
    if (companyMonths.length > 0 && !selectedMonthId) {
      setSelectedMonthId(companyMonths[0].id);
    }
  }, [companyMonths, selectedMonthId]);

  useEffect(() => {
    if (isoWeeks.length > 0 && !selectedWeekId) {
      setSelectedWeekId(isoWeeks[0].id);
    }
  }, [isoWeeks, selectedWeekId]);

  // Handle configuration open
  const openConfigModal = () => {
    setDraftWorkersCount(config.workersCount);
    setDraftBaseWage(config.baseWageDailyDH);
    setDraftPrima(config.primaDailyDH);
    setDraftWorkingDays(config.workingDaysPerWeek);
    setDraftRate(config.eurToDhRate);
    setConfigSaveSuccess(false);
    setIsConfigOpen(true);
  };

  const handleSaveConfig = () => {
    const newConfig: WorkerCostConfig = {
      workersCount: Math.max(1, Math.round(Number(draftWorkersCount) || 3)),
      hoursPerDay: 8,
      baseWageDailyDH: Math.max(0, Number(draftBaseWage) || 143.36),
      primaDailyDH: Math.max(0, Number(draftPrima) || 60),
      workingDaysPerWeek: Math.max(1, Math.min(7, Math.round(Number(draftWorkingDays) || 6))),
      eurToDhRate: Math.max(0.1, Number(draftRate) || 10.80)
    };
    saveWorkerCostConfig(newConfig);
    setConfig(newConfig);
    setConfigSaveSuccess(true);
    setTimeout(() => {
      setIsConfigOpen(false);
      setConfigSaveSuccess(false);
    }, 700);
  };

  const handleResetConfig = () => {
    saveWorkerCostConfig(DEFAULT_WORKER_COST_CONFIG);
    setConfig(DEFAULT_WORKER_COST_CONFIG);
    setDraftWorkersCount(DEFAULT_WORKER_COST_CONFIG.workersCount);
    setDraftBaseWage(DEFAULT_WORKER_COST_CONFIG.baseWageDailyDH);
    setDraftPrima(DEFAULT_WORKER_COST_CONFIG.primaDailyDH);
    setDraftWorkingDays(DEFAULT_WORKER_COST_CONFIG.workingDaysPerWeek);
    setDraftRate(DEFAULT_WORKER_COST_CONFIG.eurToDhRate);
  };

  // Working days overrides (strictly 8 days for CM-2026-10: 2 Oct to 10 Oct minus 1 Sunday)
  const [workingDaysOverrides, setWorkingDaysOverrides] = useState<Record<string, number>>(getSavedWorkingDaysOverrides);
  const [editingDaysPeriodId, setEditingDaysPeriodId] = useState<string | null>(null);
  const [draftWorkingDaysInput, setDraftWorkingDaysInput] = useState<number>(8);

  const getPeriodEffectiveDays = (periodId: string, defaultDays: number) => {
    if (periodId.includes('2026-10')) {
      return workingDaysOverrides[periodId] || 8; // Exactly 8 days (2 Oct - 10 Oct minus 1 Sunday)
    }
    if (workingDaysOverrides[periodId] !== undefined && workingDaysOverrides[periodId] > 0) {
      return workingDaysOverrides[periodId];
    }
    return defaultDays;
  };

  const handleUpdatePeriodWorkingDays = (periodId: string, days: number) => {
    const valid = Math.max(1, Math.min(31, Math.round(Number(days) || 8)));
    saveWorkingDaysOverride(periodId, valid);
    setWorkingDaysOverrides(prev => ({ ...prev, [periodId]: valid }));
    setEditingDaysPeriodId(null);
  };

  // Helper cost numbers (converted to EUR for UI display)
  const singleCost = useMemo(() => getSingleWorkerCost(config), [config]);
  const workforceCost = useMemo(() => getTotalWorkforceCost(config), [config]);

  // Converted EUR values for 1 worker and all workers
  const singleWorkerDailyEur = useMemo(() => {
    return config.eurToDhRate > 0 ? singleCost.daily / config.eurToDhRate : 0;
  }, [singleCost, config.eurToDhRate]);

  const singleWorkerWeeklyEur = useMemo(() => {
    return config.eurToDhRate > 0 ? singleCost.weekly / config.eurToDhRate : 0;
  }, [singleCost, config.eurToDhRate]);

  const workforceDailyEur = useMemo(() => {
    return config.eurToDhRate > 0 ? workforceCost.totalDaily / config.eurToDhRate : 0;
  }, [workforceCost, config.eurToDhRate]);

  const workforceWeeklyEur = useMemo(() => {
    return config.eurToDhRate > 0 ? workforceCost.totalWeekly / config.eurToDhRate : 0;
  }, [workforceCost, config.eurToDhRate]);

  // Selected period evaluation
  const activePeriodProfit = useMemo<PeriodProfitResult>(() => {
    if (viewType === 'month') {
      const selected = companyMonths.find(m => m.id === selectedMonthId) || companyMonths[0];
      if (selected) {
        const days = getPeriodEffectiveDays(selected.id, selected.workingDays);
        return calculatePeriodProfit(
          selected.id,
          selected.label,
          selected.shortLabel,
          selected.startDate,
          selected.endDate,
          days,
          rolls,
          config,
          stockEntries
        );
      }
    } else {
      const selected = isoWeeks.find(w => w.id === selectedWeekId) || isoWeeks[0];
      if (selected) {
        const days = getPeriodEffectiveDays(selected.id, selected.workingDays);
        return calculatePeriodProfit(
          selected.id,
          selected.label,
          `Week ${selected.weekNumber}`,
          selected.startDate,
          selected.endDate,
          days,
          rolls,
          config,
          stockEntries
        );
      }
    }

    // Fallback safety
    const curMonth = getCompanyMonthForDate(new Date());
    const days = getPeriodEffectiveDays(curMonth.id, curMonth.workingDays);
    return calculatePeriodProfit(
      curMonth.id,
      curMonth.label,
      curMonth.shortLabel,
      curMonth.startDate,
      curMonth.endDate,
      days,
      rolls,
      config,
      stockEntries
    );
  }, [viewType, selectedMonthId, selectedWeekId, companyMonths, isoWeeks, rolls, config, stockEntries, workingDaysOverrides]);

  // List of all periods evaluated for historical comparison table
  const allEvaluatedPeriods = useMemo(() => {
    if (viewType === 'month') {
      return companyMonths.map(m => {
        const days = getPeriodEffectiveDays(m.id, m.workingDays);
        return calculatePeriodProfit(
          m.id,
          m.label,
          m.shortLabel,
          m.startDate,
          m.endDate,
          days,
          rolls,
          config,
          stockEntries
        );
      });
    } else {
      return isoWeeks.map(w => {
        const days = getPeriodEffectiveDays(w.id, w.workingDays);
        return calculatePeriodProfit(
          w.id,
          w.label,
          `W${w.weekNumber}`,
          w.startDate,
          w.endDate,
          days,
          rolls,
          config,
          stockEntries
        );
      });
    }
  }, [viewType, companyMonths, isoWeeks, rolls, config, stockEntries, workingDaysOverrides]);

  // Navigation helpers for Prev/Next period
  const handlePrevPeriod = () => {
    if (viewType === 'month') {
      const idx = companyMonths.findIndex(m => m.id === selectedMonthId);
      if (idx !== -1 && idx < companyMonths.length - 1) {
        setSelectedMonthId(companyMonths[idx + 1].id);
      }
    } else {
      const idx = isoWeeks.findIndex(w => w.id === selectedWeekId);
      if (idx !== -1 && idx < isoWeeks.length - 1) {
        setSelectedWeekId(isoWeeks[idx + 1].id);
      }
    }
  };

  const handleNextPeriod = () => {
    if (viewType === 'month') {
      const idx = companyMonths.findIndex(m => m.id === selectedMonthId);
      if (idx > 0) {
        setSelectedMonthId(companyMonths[idx - 1].id);
      }
    } else {
      const idx = isoWeeks.findIndex(w => w.id === selectedWeekId);
      if (idx > 0) {
        setSelectedWeekId(isoWeeks[idx - 1].id);
      }
    }
  };

  const canGoPrev = useMemo(() => {
    if (viewType === 'month') {
      const idx = companyMonths.findIndex(m => m.id === selectedMonthId);
      return idx !== -1 && idx < companyMonths.length - 1;
    }
    const idx = isoWeeks.findIndex(w => w.id === selectedWeekId);
    return idx !== -1 && idx < isoWeeks.length - 1;
  }, [viewType, companyMonths, selectedMonthId, isoWeeks, selectedWeekId]);

  const canGoNext = useMemo(() => {
    if (viewType === 'month') {
      const idx = companyMonths.findIndex(m => m.id === selectedMonthId);
      return idx > 0;
    }
    const idx = isoWeeks.findIndex(w => w.id === selectedWeekId);
    return idx > 0;
  }, [viewType, companyMonths, selectedMonthId, isoWeeks, selectedWeekId]);

  return (
    <div className="space-y-5 animate-fadeIn pb-12" id="profit-dashboard-module">
      
      {/* ULTRA-COMPACT SLIM HEADER BAR (Small height, exactly two period toggle buttons) */}
      <div 
        className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:px-4 sm:py-2.5 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5" 
        id="profit-header-compact"
      >
        {/* Left: Module Title & Currency Pill */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 flex items-center justify-center shrink-0">
            <Coins size={15} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xs sm:text-sm font-black tracking-wider text-slate-900 uppercase font-mono">
              PROFIT DASHBOARD
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              EUR (€)
            </span>
          </div>
        </div>

        {/* Center: Monthly Period Indicator (Weekly section removed) */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl self-center lg:self-auto" id="profit-period-two-buttons">
          <div
            className="px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-xs flex items-center gap-1.5"
            id="profit-tab-month"
          >
            <Calendar size={13} className="text-emerald-600" />
            <span>Monthly (26th – 25th)</span>
          </div>
        </div>

        {/* Right: Period Dropdown Selector & Small Settings Action */}
        <div className="flex items-center gap-1.5 justify-end shrink-0" id="profit-header-controls">
          <button
            onClick={handlePrevPeriod}
            disabled={!canGoPrev}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              canGoPrev
                ? 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-95'
                : 'border-slate-100 text-slate-300 cursor-not-allowed'
            }`}
            title="Previous Period"
          >
            <ChevronLeft size={14} />
          </button>

          <select
            value={selectedMonthId}
            onChange={(e) => setSelectedMonthId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 cursor-pointer shadow-3xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {companyMonths.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.shortLabel})
              </option>
            ))}
          </select>

          <button
            onClick={handleNextPeriod}
            disabled={!canGoNext}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              canGoNext
                ? 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-95'
                : 'border-slate-100 text-slate-300 cursor-not-allowed'
            }`}
            title="Next Period"
          >
            <ChevronRight size={14} />
          </button>

          {/* Quick Settings Button */}
          <button
            onClick={openConfigModal}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ml-1"
            title="Configure operator costs & exchange rate"
          >
            <SlidersHorizontal size={12} className="text-amber-600" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* 4 PRIMARY METRIC CARDS (Clean, Simple, Minimalist) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" id="profit-kpis-summary">
        
        {/* CARD 1: NET PROFIT */}
        <div className={`rounded-2xl p-5 border relative overflow-hidden transition-all shadow-xs ${
          activePeriodProfit.netProfitEur >= 0
            ? 'bg-emerald-50/60 border-emerald-200'
            : 'bg-rose-50/60 border-rose-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Net Profit
            </span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-black px-2 py-0.5 rounded-full ${
              activePeriodProfit.netProfitEur >= 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {activePeriodProfit.netProfitEur >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {activePeriodProfit.netProfitMarginPercent >= 0 ? '+' : ''}{activePeriodProfit.netProfitMarginPercent.toFixed(1)}%
            </span>
          </div>

          <div className="mt-2.5">
            <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
              activePeriodProfit.netProfitEur >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {formatEuroCurrency(activePeriodProfit.netProfitEur)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Company net earnings
            </p>
          </div>
        </div>

        {/* CARD 2: GROSS PROFIT */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Gross Profit
            </span>
            <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
              {activePeriodProfit.rollsCount} Rolls
            </span>
          </div>

          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-700 tracking-tight">
              {formatEuroCurrency(activePeriodProfit.grossProfitEur)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Production value − Roll cost
            </p>
          </div>
        </div>

        {/* CARD 3: OPERATORS LABOR */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Operators Labor
            </span>
            <button
              onClick={() => {
                setEditingDaysPeriodId(activePeriodProfit.periodId);
                setDraftWorkingDaysInput(activePeriodProfit.workingDays);
              }}
              className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition cursor-pointer flex items-center gap-1"
              title="Click to edit working days"
            >
              <span>{activePeriodProfit.workingDays} Days</span>
              <Edit2 size={10} className="text-amber-600" />
            </button>
          </div>

          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
              {formatEuroCurrency(activePeriodProfit.totalLaborCostEur)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {config.workersCount} operators ({activePeriodProfit.workingDays} working days)
            </p>
          </div>
        </div>

        {/* CARD 4: PRODUCED PIECES */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Produced Output
            </span>
            <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
              Pieces
            </span>
          </div>

          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
              {activePeriodProfit.totalProducedPieces.toLocaleString()} pcs
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Finished cut airbags
            </p>
          </div>
        </div>
      </div>

      {/* ROLLS IN ACTIVE PERIOD TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scroll size={15} className="text-emerald-600" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
              Rolls in this Period ({activePeriodProfit.rolls.length})
            </h3>
          </div>

          {onNavigateToRolls && (
            <button
              onClick={onNavigateToRolls}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition cursor-pointer"
            >
              <span>Rolls Module</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        {activePeriodProfit.rolls.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
            No physical rolls were recorded as opened during this period range.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-3 px-4">Roll Barcode</th>
                  <th className="py-3 px-4">Material / Family</th>
                  <th className="py-3 px-4">References</th>
                  <th className="py-3 px-4 text-right">Produced PCS</th>
                  <th className="py-3 px-4 text-right">Yield Efficiency</th>
                  <th className="py-3 px-4 text-right">Fabric Cost (€)</th>
                  <th className="py-3 px-4 text-right">Prod Value (€)</th>
                  <th className="py-3 px-4 text-right">Gross Profit (€)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {activePeriodProfit.rolls.map((r) => {
                  const isExpanded = expandedRollBarcode === r.barcode;
                  return (
                    <React.Fragment key={r.barcode}>
                      <tr 
                        onClick={() => setExpandedRollBarcode(isExpanded ? null : r.barcode)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{r.barcode}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {r.material}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-2xs font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {r.referenceId}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {r.producedPieces.toLocaleString()} pcs
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          {formatEfficiencyPercent(r.materialEfficiency)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {formatEuroCurrency(r.rollCostEur)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-indigo-600 font-bold">
                          {formatEuroCurrency(r.productionValueEur)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-600">
                          {formatEuroCurrency(r.grossProfitEur)}
                        </td>
                      </tr>

                      {/* Expandable detail row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 border-y border-slate-100">
                          <td colSpan={8} className="p-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 text-2xs space-y-2">
                              <div className="font-bold text-slate-700 uppercase tracking-wider font-mono">
                                Detailed Breakdown for Roll {r.barcode}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600 font-mono">
                                <div>
                                  <span className="text-slate-400 block">Opened Date:</span>
                                  <span className="font-bold text-slate-800">{r.openedAt || 'Recorded'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Fabric Cost:</span>
                                  <span className="font-bold text-slate-800">{formatEuroCurrency(r.rollCostEur)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Production Value:</span>
                                  <span className="font-bold text-indigo-600">{formatEuroCurrency(r.productionValueEur)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Gross Profit:</span>
                                  <span className="font-bold text-emerald-600">{formatEuroCurrency(r.grossProfitEur)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HISTORICAL PERIOD COMPARISON TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
            {viewType === 'month' ? 'Monthly History (26th–25th)' : 'Weekly History (ISO Weeks)'}
          </h3>
          <span className="text-2xs font-mono text-slate-400">EUR (€)</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Working Days</th>
                <th className="py-3 px-4 text-center">Rolls Cut</th>
                <th className="py-3 px-4 text-right">Produced PCS</th>
                <th className="py-3 px-4 text-right">Gross Profit (€)</th>
                <th className="py-3 px-4 text-right">Operators Cost (€)</th>
                <th className="py-3 px-4 text-right">NET PROFIT (€)</th>
                <th className="py-3 px-4 text-right">Margin %</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allEvaluatedPeriods.map((p) => {
                const isSelected = viewType === 'month' 
                  ? p.periodId === selectedMonthId 
                  : p.periodId === selectedWeekId;

                return (
                  <tr 
                    key={p.periodId}
                    className={`transition-colors ${
                      isSelected ? 'bg-emerald-50/40 font-bold' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{p.periodLabel}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.shortLabel}</div>
                    </td>
                    
                    {/* Working Days Cell (CSS Selector target: td:nth-of-type(2)) */}
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{p.workingDays} working days</span>
                        {p.periodId.includes('2026-10') && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active production window" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {p.periodId.includes('2026-10')
                          ? '02 Oct – 10 Oct (excl. 1 Sun)'
                          : `${p.workingDays} days (Mon–Sat)`}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      {p.rollsCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-900">
                      {p.totalProducedPieces.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-700">
                      {formatEuroCurrency(p.grossProfitEur)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                      {formatEuroCurrency(p.totalLaborCostEur)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black">
                      <span className={p.netProfitEur >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        {formatEuroCurrency(p.netProfitEur)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      <span className={p.netProfitMarginPercent >= 0 ? 'text-emerald-600' : 'text-rose-500'}>
                        {p.netProfitMarginPercent >= 0 ? '+' : ''}{p.netProfitMarginPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          if (viewType === 'month') setSelectedMonthId(p.periodId);
                          else setSelectedWeekId(p.periodId);
                        }}
                        className={`px-3 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-emerald-600 text-white shadow-2xs' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isSelected ? 'Viewing' : 'Select'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIGURATION MODAL / DRAWER (WHERE DH VALUES ARE STORED AND CONFIGURED) */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div 
            className="fixed inset-0" 
            onClick={() => setIsConfigOpen(false)} 
          />
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 font-mono">
                    OPERATOR LABOR RATES & EXCHANGE CONFIG
                  </h3>
                  <p className="text-xs text-slate-500">
                    Wages configured in Moroccan Dirhams (DH) & converted to EUR (€)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              
              {/* Workers Count */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Active Operators Count (Shift Workforce)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={draftWorkersCount}
                  onChange={(e) => setDraftWorkersCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Factory default: 3 workers (daily total: {(draftWorkersCount * (draftBaseWage + draftPrima)).toFixed(2)} DH ≈ {formatEuroCurrency((draftWorkersCount * (draftBaseWage + draftPrima)) / draftRate)})
                </p>
              </div>

              {/* Wage Breakdown: Base Wage & Prima */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    1 Worker Base Wage (8h)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={draftBaseWage}
                      onChange={(e) => setDraftBaseWage(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-400">DH</span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1">Default: 143.36 DH (≈ {formatEuroCurrency(draftBaseWage / draftRate)})</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    1 Worker Prima (Daily)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={draftPrima}
                      onChange={(e) => setDraftPrima(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-400">DH</span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1">Default: 60.00 DH (≈ {formatEuroCurrency(draftPrima / draftRate)})</p>
                </div>
              </div>

              {/* Working Days per Week & EUR/DH Exchange Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Working Days / Week
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={draftWorkingDays}
                    onChange={(e) => setDraftWorkingDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">Default: 6 days (Mon to Sat)</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    EUR to DH Exchange Rate
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={draftRate}
                      onChange={(e) => setDraftRate(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-400">DH/€</span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1">Default: 10.80 DH per 1 €</p>
                </div>
              </div>

              {/* Formula & Live Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-2xs font-mono">
                <div className="font-bold text-slate-700 uppercase tracking-wider font-sans">
                  Calculated Cost Preview (DH & Converted EUR):
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>1 Worker / Day:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {(draftBaseWage + draftPrima).toFixed(2)} DH <span className="text-emerald-700 font-black">({formatEuroCurrency((draftBaseWage + draftPrima) / draftRate)})</span>
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>1 Worker / Week ({draftWorkingDays} days):</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {((draftBaseWage + draftPrima) * draftWorkingDays).toFixed(2)} DH <span className="text-emerald-700 font-black">({formatEuroCurrency(((draftBaseWage + draftPrima) * draftWorkingDays) / draftRate)})</span>
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5">
                  <span>{draftWorkersCount} Workers / Day:</span>
                  <span className="font-bold text-amber-700 font-mono">
                    {(draftWorkersCount * (draftBaseWage + draftPrima)).toFixed(2)} DH <span className="text-emerald-700 font-black">({formatEuroCurrency((draftWorkersCount * (draftBaseWage + draftPrima)) / draftRate)})</span>
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{draftWorkersCount} Workers / Week ({draftWorkingDays} days):</span>
                  <span className="font-bold text-amber-700 font-mono">
                    {(draftWorkersCount * (draftBaseWage + draftPrima) * draftWorkingDays).toFixed(2)} DH <span className="text-emerald-700 font-black">({formatEuroCurrency((draftWorkersCount * (draftBaseWage + draftPrima) * draftWorkingDays) / draftRate)})</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleResetConfig}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium underline cursor-pointer"
              >
                Reset to Company Defaults
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  {configSaveSuccess ? <Check size={14} /> : null}
                  <span>{configSaveSuccess ? 'Saved!' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INLINE EDIT WORKING DAYS MODAL */}
      {editingDaysPeriodId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 font-mono">
                Adjust Period Working Days
              </h4>
              <p className="text-2xs text-slate-500 mt-0.5">
                Override active factory production working days for this cycle
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Working Days Count
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={draftWorkingDaysInput}
                onChange={(e) => setDraftWorkingDaysInput(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-2xs text-slate-400 mt-1">
                For current period (02 Oct – 10 Oct minus 1 Sun): 8 days
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingDaysPeriodId(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdatePeriodWorkingDays(editingDaysPeriodId, draftWorkingDaysInput)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Save Days
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
