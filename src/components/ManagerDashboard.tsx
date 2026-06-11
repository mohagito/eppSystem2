import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { UserProfile, StockEntry, ProductionPlan, DeliveryEntry } from '../types';
import { AIRBAG_MODELS } from '../data';
import {
  TrendingUp,
  Cpu,
  Users,
  Layers,
  Sparkles,
  ClipboardList,
  History,
  Activity,
  ArrowRight,
  PlusCircle,
  Trash2,
  Database,
  RefreshCw,
  XCircle,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import AnalyticsCharts from './AnalyticsCharts';
import {
  getPlanActualProduced,
  getAchievementPercent,
  getAchievementStatus,
  getAchievementColors
} from '../utils/achievement';

interface ManagerProps {
  currentUser: UserProfile;
  entries: StockEntry[];
  deliveries?: DeliveryEntry[];
  plans: ProductionPlan[];
  dailyTargets: Record<string, number>;
  onNavigate: (tab: string) => void;
  onUpdatePlanStatus?: (id: string, status: 'Pending' | 'Completed' | 'Delayed') => void;
  onDeletePlan?: (id: string) => void;
  onDeleteStockEntry?: (id: string) => void;
  onClearStock?: () => void;
  onClearPlans?: () => void;
  onResetDefaults?: () => void;
}

export default function ManagerDashboard({
  currentUser,
  entries,
  deliveries = [],
  plans,
  dailyTargets,
  onNavigate,
  onUpdatePlanStatus,
  onDeletePlan,
  onDeleteStockEntry,
  onClearStock,
  onClearPlans,
  onResetDefaults
}: ManagerProps) {
  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // 1. Total Stockpile accumulated
  const totalStockpile = useMemo(() => {
    return entries.reduce((sum, e) => sum + e.quantity, 0);
  }, [entries]);

  // 1.1 Total Deliveries dispatched
  const totalDelivered = useMemo(() => {
    return deliveries.reduce((sum, d) => sum + d.quantity, 0);
  }, [deliveries]);

  // 2. Active Plans scheduled today
  const plansToday = useMemo(() => {
    return plans.filter((p) => p.planDate === todayStr);
  }, [plans, todayStr]);

  const activePlansCount = plansToday.length;

  // 3. Completed Today output vs Target Today
  const completedTodayQty = useMemo(() => {
    return entries
      .filter((e) => e.date === todayStr)
      .reduce((sum, e) => sum + e.quantity, 0);
  }, [entries, todayStr]);

  // Read admin-defined target for today (no random numbers)
  const adminTargetToday = useMemo(() => {
    return dailyTargets[todayStr] !== undefined ? dailyTargets[todayStr] : 300;
  }, [dailyTargets, todayStr]);

  const dailyProgressRate = adminTargetToday
    ? Math.round((completedTodayQty / adminTargetToday) * 100)
    : 0;

  // 4. Number of active operators (unique workerNames)
  const activeOperatorsCount = useMemo(() => {
    const names = new Set<string>();
    entries.forEach((e) => names.add(e.workerName));
    return Math.max(names.size, 2); // realistic number of operators
  }, [entries]);

  // 5. Short recent stock entries list
  const recentEntries = useMemo(() => {
    return [...entries]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 4);
  }, [entries]);

  // 6. Short active plans (today + upcoming)
  const imminentPlans = useMemo(() => {
    return [...plans]
      .filter((p) => p.status === 'Pending' || p.planDate >= todayStr)
      .sort((a, b) => a.planDate.localeCompare(b.planDate))
      .slice(0, 4);
  }, [plans, todayStr]);

  // NEW: Memoized calculations for Production Achievement Stats
  const totalPlannedOverall = useMemo(() => {
    return plans.reduce((sum, p) => sum + p.quantityPlanned, 0);
  }, [plans]);

  const totalActualOverall = useMemo(() => {
    return plans.reduce((sum, p) => sum + getPlanActualProduced(p, entries), 0);
  }, [plans, entries]);

  const overallAchievementPct = useMemo(() => {
    return getAchievementPercent(totalPlannedOverall, totalActualOverall);
  }, [totalPlannedOverall, totalActualOverall]);

  const overallColors = useMemo(() => {
    return getAchievementColors(totalPlannedOverall, totalActualOverall);
  }, [totalPlannedOverall, totalActualOverall]);

  const overallStatus = useMemo(() => {
    return getAchievementStatus(totalPlannedOverall, totalActualOverall);
  }, [totalPlannedOverall, totalActualOverall]);

  const modelAchievementData = useMemo(() => {
    return AIRBAG_MODELS.map((model) => {
      const modelPlans = plans.filter((p) => p.model === model);
      const planned = modelPlans.reduce((sum, p) => sum + p.quantityPlanned, 0);
      const actual = modelPlans.reduce((sum, p) => sum + getPlanActualProduced(p, entries), 0);

      const pct = getAchievementPercent(planned, actual);
      const pctVal = typeof pct === 'number' ? Math.round(pct) : 0;
      const pctString = typeof pct === 'number' ? `${pctVal}%` : 'No Target';
      const colors = getAchievementColors(planned, actual);
      const statusText = getAchievementStatus(planned, actual);

      return {
        model,
        planned,
        actual,
        pct,
        pctVal,
        pctString,
        colors,
        statusText
      };
    });
  }, [plans, entries]);

  return (
    <div className="space-y-8" id="manager-dashboard-view">
      {/* INDUSTRIAL GREETING CARD */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold animate-pulse">
            <Sparkles size={12} />
            Manager Dashboard
          </div>
          <h2 className="text-xl md:text-2xl font-bold font-sans text-slate-900 tracking-tight">
            Dashboard
          </h2>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('plans')}
            className="px-4.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            id="mgr-schedule-action"
          >
            <PlusCircle size={15} />
            Schedule Runs
          </button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6" id="manager-kpi-grid">
        {/* Metric 1: Available stockpile */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 flex flex-col justify-between h-36 shadow-3xs">
          <div className="flex justify-between items-center text-slate-455">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider font-sans">Available Stock</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Layers size={14} /></span>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black font-mono text-slate-900 select-all">{totalStockpile - totalDelivered}</div>
            <p className="text-[10px] md:text-xs text-slate-500 mt-1 pb-1 font-mono font-bold uppercase tracking-wide">
              {totalStockpile} Prod / {totalDelivered} Shipped
            </p>
          </div>
        </div>

        {/* Metric 2: Shipped Deliveries */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 flex flex-col justify-between h-36 shadow-3xs">
          <div className="flex justify-between items-center text-slate-455">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider font-sans">Delivered Shipped</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><History size={14} /></span>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black font-mono text-amber-700 select-all">{totalDelivered}</div>
            <p className="text-[10px] md:text-xs text-slate-500 mt-1 pb-1">Units removed from stock</p>
          </div>
        </div>

        {/* Metric 3: Target plans active */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 flex flex-col justify-between h-36 shadow-3xs">
          <div className="flex justify-between items-center text-slate-455">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider font-sans">Schedules Today</span>
            <span className="p-1.5 bg-teal-50 text-teal-600 rounded-lg"><ClipboardList size={14} /></span>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black font-mono text-slate-900 select-all">{activePlansCount}</div>
            <p className="text-[10px] md:text-xs text-slate-500 mt-1 pb-1">Active manufacturing rosters</p>
          </div>
        </div>

        {/* Metric 4: Production Achievement */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 flex flex-col justify-between h-36 shadow-3xs" id="achievement-kpi-card">
          <div className="flex justify-between items-center text-slate-455">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider font-sans">Production Achievement</span>
            <span className={`p-1.5 rounded-lg border ${overallColors.bg} ${overallColors.text}`}><TrendingUp size={14} /></span>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black font-mono text-slate-900 select-all">
              {totalPlannedOverall === 0 ? 'No Targets' : `${totalActualOverall} / ${totalPlannedOverall}`}
            </div>
            <p className="text-[10px] md:text-xs text-slate-500 mt-1 pb-1 font-sans font-bold flex items-center justify-between">
              <span>Overall rate:</span>
              <span className={`px-1.5 py-0.5 rounded border uppercase font-mono text-[9px] font-black ${overallColors.bg} ${overallColors.text}`}>
                {typeof overallAchievementPct === 'number' ? `${Math.round(overallAchievementPct)}%` : 'No Target'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* CHARTS GRAPH */}
      <AnalyticsCharts entries={entries} plans={plans} deliveries={deliveries} />

      {/* PRODUCTION ACHIEVEMENT ANALYTICS & MODEL BREAKDOWN */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-6" id="achievement-summary-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Activity size={16} className="text-emerald-600" />
              Production Achievement Summary
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Roster Status:</span>
            <span className={`px-2.5 py-0.5 rounded-full border text-xs font-black uppercase font-mono ${overallColors.bg} ${overallColors.text}`}>
              {overallStatus}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          {/* Column 1: Overall Factory Performance */}
          <div className="md:col-span-5 bg-slate-50 border border-slate-150 rounded-2xl p-5 flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <h4 className="text-2xs font-extrabold uppercase tracking-widest text-slate-455">Overall Factory Rate</h4>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black font-mono tracking-tight ${overallColors.text}`}>
                  {typeof overallAchievementPct === 'number' ? `${Math.round(overallAchievementPct)}%` : 'No Target'}
                </span>
                {typeof overallAchievementPct === 'number' && (
                  <span className="text-xs text-slate-400 font-bold font-sans">completed</span>
                )}
              </div>
            </div>

            {/* Horizontal progress bar with dynamic colors */}
            <div className="space-y-1.5">
              <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden border border-slate-300">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${overallColors.bar}`}
                  style={{ width: `${Math.min(typeof overallAchievementPct === 'number' ? Math.round(overallAchievementPct) : 0, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>0%</span>
                <span>50%</span>
                <span>100%+</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Total Target</span>
                <span className="text-base font-black font-mono text-slate-800">{totalPlannedOverall} <span className="text-[10px] text-slate-400 font-normal">units</span></span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Total Produced</span>
                <span className="text-base font-black font-mono text-emerald-700">{totalActualOverall} <span className="text-[10px] text-slate-400 font-normal">units</span></span>
              </div>
            </div>
          </div>

          {/* Columns 2 & 3: Model-Level Breakdown */}
          <div className="md:col-span-7 space-y-4">
            <h4 className="text-2xs font-extrabold uppercase tracking-widest text-slate-455">Model-Level Performance</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="model-achievement-list">
              {modelAchievementData.map(({ model, planned, actual, pctVal, pctString, colors, statusText }) => (
                <div 
                  key={model} 
                  className="bg-white border border-slate-205 hover:border-slate-350 rounded-xl p-3.5 space-y-2.5 transition-all shadow-2xs"
                  id={`model-bar-${model}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black font-mono bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-0.5 rounded-md">
                      {model}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase font-mono ${colors.bg} ${colors.text}`}>
                      {statusText}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500 font-medium font-sans">
                      <span>Target: <strong className="text-slate-800 font-bold font-mono">{planned}</strong> | Prod: <strong className="text-emerald-700 font-black font-mono">{actual}</strong></span>
                      <span className={`font-black font-mono ${colors.text}`}>{pctString}</span>
                    </div>
                    
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${colors.bar}`}
                        style={{ width: `${Math.min(pctVal, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* WEEK SCHEDULES & RECENT LOGS */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8" id="manager-recent-roster">
        {/* ACTIVE SHIFT PLAN SCHEDULES */}
        <div className="lg:col-span-3 space-y-4 font-sans" id="imminent-plans-panel">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 flex items-center gap-2">
              <TrendingUp size={15} className="text-teal-400" />
              Clocked Shift Schedules
            </h3>
            <button
              onClick={() => onNavigate('plans')}
              className="text-2xs font-semibold text-teal-500 hover:text-teal-600 flex items-center gap-1 cursor-pointer"
            >
              Calendar Board <ArrowRight size={11} />
            </button>
          </div>

          <div className="space-y-3">
            {imminentPlans.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-450 border border-dashed border-slate-200 rounded-xl bg-white">
                No active plans
              </div>
            ) : (
              imminentPlans.map((plan) => {
                const isToday = plan.planDate === todayStr;
                let statColor = 'bg-slate-50 text-slate-500 border-slate-200';
                if (plan.status === 'Completed') statColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (plan.status === 'Delayed') statColor = 'bg-amber-50 text-amber-700 border-amber-200';
                if (plan.status === 'Pending') statColor = 'bg-sky-50 text-sky-700 border-sky-200';

                return (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-xl border transition-all duration-300 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${
                      isToday ? 'border-teal-400 shadow-3xs' : 'border-slate-200 shadow-3xs'
                    }`}
                  >
                    <div className="space-y-1 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 font-mono bg-slate-55 shadow-3xs border border-slate-200 px-2 py-0.5 rounded-md">
                          {plan.model}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-105 border border-slate-205 px-1.5 py-0.5 rounded-md">
                          {plan.planDate === todayStr ? 'Today' : plan.planDate} - {plan.shift}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        Assigned: <span className="text-slate-800 font-semibold">{plan.assignedWorker}</span> ({plan.machine})
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 justify-between sm:justify-end shrink-0 w-full sm:w-auto pt-2.5 sm:pt-0 border-t border-slate-100 sm:border-0">
                      <div className="text-left sm:text-right">
                        <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Progress Status</div>
                        <div className="text-xs font-black font-mono text-emerald-600">
                          {plan.quantityCompleted || 0} <span className="text-slate-400 font-bold text-[10.5px]">/ {plan.quantityPlanned} pcs</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {/* Dropdown status update */}
                        {onUpdatePlanStatus && (
                          <select
                            value={plan.status}
                            onChange={(e) => onUpdatePlanStatus(plan.id, e.target.value as any)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-205 rounded-xl px-2.5 py-1.5 text-[10.5px] cursor-pointer focus:outline-hidden font-extrabold shadow-3xs"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                            <option value="Delayed">Delayed</option>
                          </select>
                        )}

                        {/* Delete plan button */}
                        {onDeletePlan && (
                          <button
                            onClick={() => onDeletePlan(plan.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete plan"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* LATEST LEDGER REGISTRATIONS */}
        <div className="lg:col-span-2 space-y-4" id="recent-ledger-panel">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 flex items-center gap-2">
              <History className="text-emerald-400" size={15} />
              Recent Output Log Entries
            </h3>
            <button
              onClick={() => onNavigate('stock')}
              className="text-2xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
            >
              Full Ledger View
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-3xs">
            {recentEntries.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-450 font-medium">
                No entries stored in local stockpile database.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 space-y-3.5">
                {recentEntries.map((e, index) => (
                  <div key={e.id} className={`flex items-center justify-between ${index > 0 ? 'pt-3.5' : ''}`}>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                          {e.modelId}
                        </span>
                        <span className="text-[10px] text-slate-600 font-extrabold">{e.workerName.split(' ')[0]}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold font-mono">
                        Date: {e.date}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-bold text-emerald-600 font-mono">+{e.quantity} pcs</div>
                        <span className="text-[9px] text-slate-400 font-medium">Bay stored</span>
                      </div>

                      {onDeleteStockEntry && (
                        <button
                          onClick={() => onDeleteStockEntry(e.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete stock entry"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
