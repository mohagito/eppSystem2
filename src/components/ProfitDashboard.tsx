import React, { useState, useMemo } from 'react';
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
  calculateRollsWithLaborProfit,
  RollProfitSummary
} from '../utils/profitCalculations';
import { 
  formatEuroCurrency, 
  formatEfficiencyPercent 
} from '../utils/financialCalculations';
import { 
  formatMoroccoDate 
} from '../utils/timeZone';
import { 
  TrendingUp, 
  TrendingDown, 
  SlidersHorizontal, 
  ChevronRight, 
  Scroll, 
  Check, 
  X, 
  Coins
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

  // Expanded roll details in table
  const [expandedRollBarcode, setExpandedRollBarcode] = useState<string | null>(null);

  // Backend calculation engine:
  // ROLL => open date => working days based on the production records => close date => gross profit - the workers cost
  const profitLedger = useMemo(() => {
    return calculateRollsWithLaborProfit(rolls, config, stockEntries);
  }, [rolls, config, stockEntries]);

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

  return (
    <div className="space-y-5 animate-fadeIn pb-12" id="profit-dashboard-module">
      
      {/* ULTRA-COMPACT SLIM HEADER BAR */}
      <div 
        className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:px-4 sm:py-2.5 shadow-2xs flex flex-row items-center justify-between gap-2.5" 
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

        {/* Right: Rolls Count & Settings */}
        <div className="flex items-center gap-2 justify-end" id="profit-header-controls">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-mono font-bold">
            <Scroll size={12} className="text-emerald-600" />
            <span>{profitLedger.totalRollsCount} Rolls in this period</span>
          </span>

          <button
            onClick={openConfigModal}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95"
            title="Configure operator costs & exchange rate"
          >
            <SlidersHorizontal size={12} className="text-amber-600" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* 4 PRIMARY METRIC CARDS (Clear, Clean, Direct) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" id="profit-kpis-summary">
        
        {/* CARD 1: NET PROFIT */}
        <div className={`rounded-2xl p-5 border relative overflow-hidden transition-all shadow-xs ${
          profitLedger.totalNetProfitEur >= 0
            ? 'bg-emerald-50/60 border-emerald-200'
            : 'bg-rose-50/60 border-rose-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Net Profit
            </span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-black px-2 py-0.5 rounded-full ${
              profitLedger.totalNetProfitEur >= 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {profitLedger.totalNetProfitEur >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {profitLedger.totalNetProfitMarginPercent >= 0 ? '+' : ''}{profitLedger.totalNetProfitMarginPercent.toFixed(1)}%
            </span>
          </div>

          <div className="mt-2.5">
            <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
              profitLedger.totalNetProfitEur >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {formatEuroCurrency(profitLedger.totalNetProfitEur)}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono font-medium">
              Gross {formatEuroCurrency(profitLedger.totalGrossProfitEur)} − Labor {formatEuroCurrency(profitLedger.totalLaborCostEur)}
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
              {profitLedger.totalRollsCount} Rolls
            </span>
          </div>

          <div className="mt-2.5">
            <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
              profitLedger.totalGrossProfitEur < 0 ? 'text-rose-600' : 'text-indigo-700'
            }`}>
              {formatEuroCurrency(profitLedger.totalGrossProfitEur)}
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
            <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              {profitLedger.totalWorkingDays} Days
            </span>
          </div>

          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
              {formatEuroCurrency(profitLedger.totalLaborCostEur)}
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              {config.workersCount} operators ({profitLedger.totalWorkingDays} {profitLedger.totalWorkingDays === 1 ? 'day' : 'days'})
            </p>
          </div>
        </div>

        {/* CARD 4: PRODUCED OUTPUT */}
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
              {profitLedger.totalProducedPieces.toLocaleString()} pcs
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Finished cut airbags
            </p>
          </div>
        </div>
      </div>

      {/* ROLLS IN THIS PERIOD TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5" id="profit-rolls-period-table">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scroll size={15} className="text-emerald-600" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
              Rolls in this Period ({profitLedger.rolls.length})
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

        {profitLedger.rolls.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
            No active or closed rolls were found in the production records.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-3 px-4">Roll Barcode</th>
                  <th className="py-3 px-4">Open Date</th>
                  <th className="py-3 px-4">Close Date</th>
                  <th className="py-3 px-4 text-center">Working Days</th>
                  <th className="py-3 px-4">Material / Family</th>
                  <th className="py-3 px-4">References</th>
                  <th className="py-3 px-4 text-right">Produced PCS</th>
                  <th className="py-3 px-4 text-right">Yield Efficiency</th>
                  <th className="py-3 px-4 text-right">Fabric Cost (€)</th>
                  <th className="py-3 px-4 text-right">Prod Value (€)</th>
                  <th className="py-3 px-4 text-right">Gross Profit (€)</th>
                  <th className="py-3 px-4 text-right bg-emerald-50/50 text-emerald-800">Net Profit (€)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {profitLedger.rolls.map((r: RollProfitSummary) => {
                  const isExpanded = expandedRollBarcode === r.barcode;
                  return (
                    <React.Fragment key={r.barcode}>
                      <tr 
                        onClick={() => setExpandedRollBarcode(isExpanded ? null : r.barcode)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        {/* Roll Barcode */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap">
                          <span className={`w-1.5 h-1.5 rounded-full ${r.netProfitEur < 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          <span>{r.barcode}</span>
                        </td>

                        {/* Open Date */}
                        <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                          {r.openedDateStr ? formatMoroccoDate(new Date(r.openedDateStr)) : '—'}
                        </td>

                        {/* Close Date */}
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          {r.isClosed && r.closedDateStr ? (
                            <span className="text-slate-700">{formatMoroccoDate(new Date(r.closedDateStr))}</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              In Production
                            </span>
                          )}
                        </td>

                        {/* Working Days based on production records */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200" title={`Production logged across ${r.activeDates.length} recorded dates`}>
                            {r.workingDays} {r.workingDays === 1 ? 'day' : 'days'}
                          </span>
                        </td>

                        {/* Material / Family */}
                        <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                          {r.material}
                        </td>

                        {/* References */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-2xs font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {r.barcode === '2600056310' || (r.referenceId && r.referenceId.includes('CADDY') && r.referenceId.includes('CRAFTER'))
                              ? 'CRAFTER'
                              : r.referenceId}
                          </span>
                        </td>

                        {/* Produced PCS */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {r.producedPieces.toLocaleString()} pcs
                        </td>

                        {/* Yield Efficiency */}
                        <td className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                          r.materialEfficiency < 70
                            ? 'text-rose-600'
                            : r.materialEfficiency <= 90
                            ? 'text-amber-500'
                            : 'text-emerald-600'
                        }`}>
                          {formatEfficiencyPercent(r.materialEfficiency)}
                        </td>

                        {/* Fabric Cost */}
                        <td className="py-3 px-4 text-right font-mono text-slate-500 whitespace-nowrap">
                          {formatEuroCurrency(r.rollCostEur)}
                        </td>

                        {/* Production Value */}
                        <td className="py-3 px-4 text-right font-mono text-indigo-600 font-bold whitespace-nowrap">
                          {formatEuroCurrency(r.productionValueEur)}
                        </td>

                        {/* Gross Profit */}
                        <td className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                          r.grossProfitEur < 0 ? 'text-rose-600' : 'text-slate-900'
                        }`}>
                          {formatEuroCurrency(r.grossProfitEur)}
                        </td>

                        {/* Net Profit (Next to Gross Profit) */}
                        <td className={`py-3 px-4 text-right font-mono font-black whitespace-nowrap bg-emerald-50/30 ${
                          r.netProfitEur < 0 ? 'text-rose-600' : 'text-emerald-700'
                        }`}>
                          {formatEuroCurrency(r.netProfitEur)}
                        </td>
                      </tr>

                      {/* Expandable detail row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 border-y border-slate-100">
                          <td colSpan={12} className="p-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 text-2xs space-y-3">
                              <div className="flex items-center justify-between font-mono flex-wrap gap-2">
                                <div className="font-bold text-slate-700 uppercase tracking-wider font-sans">
                                  Financial & Production Ledger Breakdown — Roll {r.barcode}
                                </div>
                                <span className="text-slate-500 text-[11px]">
                                  Workforce: {config.workersCount} operators @ 60 DH prima/day ({formatEuroCurrency(profitLedger.dailyLaborCostEur)}/day)
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-slate-600 font-mono">
                                <div>
                                  <span className="text-slate-400 block">Open Date:</span>
                                  <span className="font-bold text-slate-800">
                                    {r.openedDateStr ? formatMoroccoDate(new Date(r.openedDateStr)) : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Close Date:</span>
                                  <span className="font-bold text-slate-800">
                                    {r.isClosed && r.closedDateStr ? formatMoroccoDate(new Date(r.closedDateStr)) : 'In Production'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Working Days:</span>
                                  <span className="font-bold text-slate-800">
                                    {r.workingDays} {r.workingDays === 1 ? 'day' : 'days'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Fabric Cost:</span>
                                  <span className="font-bold text-slate-800">{formatEuroCurrency(r.rollCostEur)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Prod Value:</span>
                                  <span className="font-bold text-indigo-600">{formatEuroCurrency(r.productionValueEur)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Gross Profit:</span>
                                  <span className={`font-bold ${r.grossProfitEur < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                    {formatEuroCurrency(r.grossProfitEur)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Workers Cost:</span>
                                  <span className="font-bold text-amber-700">
                                    −{formatEuroCurrency(r.laborCostEur)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">NET PROFIT:</span>
                                  <span className={`font-black ${r.netProfitEur < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    {formatEuroCurrency(r.netProfitEur)}
                                  </span>
                                </div>
                              </div>

                              {r.activeDates.length > 0 && (
                                <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-500">Dates worked:</span>
                                  {r.activeDates.map(dStr => (
                                    <span key={dStr} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 text-2xs">
                                      {formatMoroccoDate(new Date(dStr))}
                                    </span>
                                  ))}
                                </div>
                              )}
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

      {/* CONFIGURATION MODAL (OPERATOR LABOR RATES & EXCHANGE CONFIG) */}
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

    </div>
  );
}
