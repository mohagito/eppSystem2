import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { UserProfile, StockEntry, ProductionPlan } from '../types';
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
  XCircle
} from 'lucide-react';
import AnalyticsCharts from './AnalyticsCharts';

interface ManagerProps {
  currentUser: UserProfile;
  entries: StockEntry[];
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

  return (
    <div className="space-y-8" id="manager-dashboard-view">
      {/* INDUSTRIAL GREETING CARD */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold animate-pulse">
            <Sparkles size={12} />
            Central Manager Console (Admin Mode)
          </div>
          <h2 className="text-xl md:text-2xl font-bold font-sans text-slate-900 tracking-tight">
            EPP ASSEMBLY CONTROL DESK
          </h2>
          <p className="text-xs md:text-sm text-slate-600 leading-relaxed max-w-xl font-medium">
            Signed in as <span className="text-slate-800 font-extrabold">{currentUser.name}</span>. Configure daily manufacturing targets, purge database logs, and oversee operators.
          </p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6" id="manager-kpi-grid">
        {/* Metric 1: Total stockpile */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 flex flex-col justify-between h-36 shadow-3xs">
          <div className="flex justify-between items-center text-slate-455">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider font-sans">Total Stockpile</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Layers size={14} /></span>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black font-mono text-slate-900 select-all">{totalStockpile}</div>
            <p className="text-[10px] md:text-xs text-slate-500 mt-1 pb-1">Assembled pcs in storage</p>
          </div>
        </div>

        {/* Metric 2: Target plans active */}
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
      </div>

      {/* CHARTS GRAPH */}
      <AnalyticsCharts entries={entries} plans={plans} />

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
                No active plans logged. Proceed to planning module to schedule targets.
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
                    className={`p-4 rounded-xl border transition-all duration-300 bg-white flex items-center justify-between gap-4 ${
                      isToday ? 'border-teal-400 shadow-3xs' : 'border-slate-200 shadow-3xs'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                          {plan.model}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-bold">
                          {plan.planDate === todayStr ? 'Today' : plan.planDate} - {plan.shift}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        Assigned: <span className="text-slate-800 font-bold">{plan.assignedWorker}</span> ({plan.machine})
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Planned</div>
                        <div className="text-xs font-bold font-mono text-slate-800">{plan.quantityPlanned} pcs</div>
                      </div>

                      {/* Dropdown status update */}
                      {onUpdatePlanStatus && (
                        <select
                          value={plan.status}
                          onChange={(e) => onUpdatePlanStatus(plan.id, e.target.value as any)}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg px-2 py-1 text-[10.5px] cursor-pointer focus:outline-hidden font-bold"
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

      {/* DATABASE & LEDGER ADMINISTRATIVE PURGE CONSOLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-xl relative overflow-hidden" id="admin-db-manager">
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 shrink-0">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
                Local Database Configuration & Diagnostics
                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider font-extrabold select-none">
                  Admin Key Level
                </span>
              </h3>
              <p className="text-2xs text-slate-400 mt-0.5">Manage in-browser storage schema (HTML5 Persistent LocalStorage). Use options to wipe logs or reload factory defaults safely.</p>
            </div>
          </div>
          <div className="text-right text-[10px] font-mono text-slate-500 shrink-0 font-bold select-none">
            ENGINE ID: browser_localstorage_db
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={onClearStock}
            className="px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-905 text-slate-300 hover:text-rose-400 text-2xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <XCircle size={13} />
            Purge Stock stockpile Ledger
          </button>
          
          <button
            onClick={onClearPlans}
            className="px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-905 text-slate-300 hover:text-rose-400 text-2xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <XCircle size={13} />
            Wipe Shift Schedules
          </button>
          
          <button
            onClick={onResetDefaults}
            className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-2xs font-extrabold transition-all cursor-pointer sm:ml-auto flex items-center gap-1.5"
          >
            <RefreshCw size={13} className="animate-spin-slow" />
            Restore Factory Preset Samples
          </button>
        </div>
      </div>
    </div>
  );
}
