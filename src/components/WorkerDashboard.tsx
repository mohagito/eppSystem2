import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { UserProfile, StockEntry, ProductionPlan } from '../types';
import { AIRBAG_MODELS } from '../data';
import {
  ClipboardCheck,
  Boxes,
  ArrowRight,
  Check,
  CheckSquare
} from 'lucide-react';
import {
  getPlanActualProduced,
  getAchievementPercent,
  getAchievementStatus,
  getAchievementColors
} from '../utils/achievement';

interface WorkerProps {
  currentUser: UserProfile;
  entries: StockEntry[];
  plans: ProductionPlan[];
  dailyTargets?: Record<string, number>;
  onNavigate: (tab: string) => void;
  onUpdatePlanStatus?: (id: string, status: 'Pending' | 'Completed' | 'Delayed') => void;
  onUpdatePlanProgress?: (id: string, additionalQuantity: number) => void;
  onAddStockEntry?: (entry: Omit<StockEntry, 'id' | 'createdAt'>) => void;
}

export default function WorkerDashboard({
  currentUser,
  entries,
  plans,
  onNavigate,
  onUpdatePlanStatus,
  onUpdatePlanProgress,
  onAddStockEntry
}: WorkerProps) {
  const [filterType, setFilterType] = useState<'my' | 'all'>('my');
  const [progressInputs, setProgressInputs] = useState<Record<string, string>>({});

  // 1. Get recent stock entries submitted by this specific worker
  const workerEntries = useMemo(() => {
    return entries
      .filter((e) => e.workerName === currentUser.name)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }, [entries, currentUser.name]);

  // Filter plans based on selected tab ('my' or 'all')
  const myPlans = useMemo(() => {
    return plans.filter((p) => {
      if (!p.assignedWorker) return false;
      return p.assignedWorker.toLowerCase().includes(currentUser.name.toLowerCase()) || 
             currentUser.name.toLowerCase().includes(p.assignedWorker.toLowerCase());
    });
  }, [plans, currentUser.name]);

  const filteredPlans = useMemo(() => {
    const list = filterType === 'my' ? myPlans : plans;
    return [...list].sort((a, b) => {
      // Sort chronologically ascending by planDate (earlier/current days first, future days towards the bottom)
      const dateCompare = a.planDate.localeCompare(b.planDate);
      if (dateCompare !== 0) return dateCompare;

      // Sort Morning shift before Evening shift
      const shiftOrder = { 'Morning': 1, 'Evening': 2 };
      const valA = shiftOrder[a.shift] || 3;
      const valB = shiftOrder[b.shift] || 3;
      if (valA !== valB) return valA - valB;

      // Sort ascending by creation time to preserve standard grid order
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
  }, [filterType, myPlans, plans]);

  const handleLogProgress = (plan: ProductionPlan, val: string) => {
    const amt = parseInt(val, 10);
    if (isNaN(amt) || amt <= 0) return;

    if (onAddStockEntry) {
      onAddStockEntry({
        modelId: plan.model,
        workerName: currentUser.name,
        date: plan.planDate,
        quantity: amt,
        createdBy: currentUser.id,
        machine: plan.machine,
        planId: plan.id
      });
    }

    if (onUpdatePlanProgress) {
      onUpdatePlanProgress(plan.id, amt);
    }

    // Reset input
    setProgressInputs((prev) => ({ ...prev, [plan.id]: '' }));
  };

  const handleCompleteProduction = (plan: ProductionPlan) => {
    const actual = getPlanActualProduced(plan, entries, plans);
    const remaining = plan.quantityPlanned - actual;
    const amtToLog = remaining > 0 ? remaining : plan.quantityPlanned;

    if (onAddStockEntry) {
      onAddStockEntry({
        modelId: plan.model,
        workerName: currentUser.name,
        date: plan.planDate,
        quantity: amtToLog,
        createdBy: currentUser.id,
        machine: plan.machine,
        planId: plan.id
      });
    }

    if (onUpdatePlanProgress) {
      onUpdatePlanProgress(plan.id, amtToLog);
    } else if (onUpdatePlanStatus) {
      onUpdatePlanStatus(plan.id, 'Completed');
    }
  };

  return (
    <div className="space-y-8" id="worker-dashboard-view">
      {/* GREETING CARD */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl shrink-0 flex items-center justify-center font-bold text-lg md:text-xl border bg-emerald-50 border-emerald-200 text-emerald-700 shadow-3xs">
            {currentUser.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
              Operator Station
            </div>
            <h2 className="text-xl md:text-2xl font-bold font-sans text-slate-900 tracking-tight">
              Bonjour, {currentUser.name.split(' ')[0]}!
            </h2>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => onNavigate('stock')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-xl text-xs transition-all shadow-3xs flex items-center gap-2 shrink-0 self-start text-[11px] cursor-pointer"
            id="worker-quick-add-stock"
          >
            <Boxes size={15} />
            Quickly Post Output
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* PRODUCTION - ACTIVE SHIFTS BOARD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs animate-fade-in" id="worker-production-whiteboard">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-5 gap-3">
          <div>
            <h3 className="text-xs font-extrabold uppercase text-slate-950 tracking-wider flex items-center gap-2">
              <ClipboardCheck size={18} className="text-emerald-600 shrink-0 animate-pulse" />
              PRODUCTION
            </h3>

          </div>
          <div className="flex gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded-lg shrink-0 self-start sm:self-center">
            <button
              onClick={() => setFilterType('my')}
              className={`px-3 py-1.5 text-[10.5px] font-bold rounded-md transition-colors cursor-pointer ${
                filterType === 'my'
                  ? 'bg-slate-900 text-white shadow-3xs font-extrabold'
                  : 'text-slate-550 hover:text-slate-800 font-semibold'
              }`}
            >
              My Orders ({myPlans.length})
            </button>
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-[10.5px] font-bold rounded-md transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white shadow-3xs font-extrabold'
                  : 'text-slate-550 hover:text-slate-800 font-semibold'
              }`}
            >
              All Factory Plans ({plans.length})
            </button>
          </div>
        </div>

        {filteredPlans.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-450 font-semibold bg-slate-50/25 rounded-xl border border-dashed border-slate-200">
            {filterType === 'my' 
              ? 'You have no assigned production plans. Check "All Factory Plans" to see and claim other active shifts!'
              : 'No scheduled production plans registered in system database yet.'
            }
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlans.map((plan) => {
              const actualQty = getPlanActualProduced(plan, entries, plans);
              const isComp = actualQty >= plan.quantityPlanned;
              const resolvedStatus = isComp 
                ? 'Completed' 
                : (plan.status === 'Completed' ? (actualQty > 0 ? 'In Progress' : 'Pending') : plan.status || 'Pending');

              return (
                <div
                  key={plan.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    isComp
                      ? 'border-emerald-100 bg-emerald-50/10'
                      : 'border-slate-200 bg-white hover:border-slate-350 hover:shadow-2xs'
                  }`}
                  id={`prod-card-${plan.id}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-md">
                        {plan.model}
                      </span>
                      <span
                        className={`text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                          isComp
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-150 font-mono'
                            : resolvedStatus === 'Delayed'
                            ? 'bg-rose-50 text-rose-700 border-rose-150 font-mono animate-pulse'
                            : resolvedStatus === 'In Progress'
                            ? 'bg-sky-50 text-sky-700 border-sky-150 font-mono animate-pulse'
                            : 'bg-amber-50 text-amber-700 border-amber-150 font-mono'
                        }`}
                      >
                        {resolvedStatus}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600 font-medium">
                        <span>Target:</span>
                        <span className="text-slate-900 font-extrabold font-mono bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded">
                          {plan.quantityPlanned} units
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 font-medium">
                        <span>Progress:</span>
                        <span className="text-emerald-700 font-extrabold font-mono bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                          {actualQty} / {plan.quantityPlanned} units
                        </span>
                      </div>

                      {/* Dynamic interactive progress bar */}
                      {(() => {
                        const pctStr = getAchievementPercent(plan.quantityPlanned, actualQty);
                        const pctVal = typeof pctStr === 'number' ? Math.round(pctStr) : 0;
                        const colors = getAchievementColors(plan.quantityPlanned, actualQty);
                        const statusText = getAchievementStatus(plan.quantityPlanned, actualQty);
                        return (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-mono font-bold uppercase">
                              <span>Achievement Rate</span>
                              <span className={colors.text}>{typeof pctStr === 'number' ? `${pctVal}%` : 'No Target'}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                              <div 
                                className={`${colors.bar} h-full rounded-full transition-all duration-300`}
                                style={{ width: `${Math.min(pctVal, 100)}%` }}
                              />
                            </div>
                            <div className="text-[9.5px] font-bold uppercase tracking-wide flex items-center gap-1.5">
                              Status: <span className={`px-1.5 py-0.5 rounded border uppercase font-mono text-[8.5px] ${colors.bg}`}>{statusText}</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                        <span>Machine:</span>
                        <span className="text-slate-800 font-bold">{plan.machine}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                        <span>Shift:</span>
                        <span className="text-slate-800 font-bold">{plan.shift}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                        <span>Date:</span>
                        <span className="text-slate-800 font-bold font-mono">{plan.planDate}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium pt-1">
                        <span>Assigned Operator:</span>
                        <span className="text-emerald-750 font-bold bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                          {plan.assignedWorker || 'Unassigned'}
                        </span>
                      </div>
                      {plan.notes && (
                        <div className="text-[10px] text-slate-500 italic bg-amber-50/35 border border-amber-100 rounded-md p-1.5 mt-2 line-clamp-2">
                          Note: {plan.notes}
                        </div>
                      )}

                      {!isComp && (
                        <div className="pt-2.5 border-t border-slate-100 space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Log Finished Batch</label>
                          <div className="flex gap-2">
                            <input
                               type="number"
                               min="1"
                               placeholder="e.g. 250"
                               value={progressInputs[plan.id] || ''}
                               onChange={(e) => setProgressInputs({ ...progressInputs, [plan.id]: e.target.value })}
                               className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-emerald-500 font-mono shadow-3xs"
                            />
                            <button
                              onClick={() => {
                                handleLogProgress(plan, progressInputs[plan.id] || '');
                              }}
                              disabled={!(progressInputs[plan.id]) || parseInt(progressInputs[plan.id], 10) <= 0}
                              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-[11px] rounded-lg px-3 py-1.5 shrink-0 hover:scale-[1.01] transition-transform cursor-pointer shadow-3xs"
                            >
                              Add
                            </button>
                          </div>
                          
                          {/* Quick preset buttons */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {[100, 250, 500].map((presetAmt) => (
                              <button
                                key={presetAmt}
                                onClick={() => handleLogProgress(plan, presetAmt.toString())}
                                className="text-[10px] font-extrabold bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-250 text-slate-700 hover:text-emerald-700 rounded-md py-1 px-2 cursor-pointer transition-colors shadow-3xs"
                              >
                                +{presetAmt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    {isComp ? (
                      <div className="w-full text-center py-2 px-3 bg-emerald-50 border border-emerald-150 text-emerald-700 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1.5 shadow-3xs select-none">
                        <Check className="text-emerald-600" size={13} />
                        Completed & Added to Stock
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCompleteProduction(plan)}
                        className="w-full text-center py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-lg flex items-center justify-center gap-1.5 border border-transparent hover:scale-[1.01] transition-transform cursor-pointer shadow-3xs"
                        id={`complete-btn-${plan.id}`}
                      >
                        <CheckSquare size={13} />
                        Log Remaining ({plan.quantityPlanned - actualQty} units) & Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENT ENTRIES RECORDED */}
      <div className="max-w-2xl mx-auto space-y-4" id="worker-recent-postings-block">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <ClipboardCheck size={16} className="text-emerald-555" />
            Your Recent Registered Postings
          </h3>
          <button
            onClick={() => onNavigate('stock')}
            className="text-2xs font-extrabold text-emerald-650 hover:text-emerald-800 hover:underline cursor-pointer"
          >
            See Ledger
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
          {workerEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-550 font-semibold bg-slate-50/20 rounded-xl border border-dashed border-slate-150">
              You have not registered any stock entries yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 space-y-3.5">
              {workerEntries.map((e, index) => (
                <div key={e.id} className={`flex items-center justify-between ${index > 0 ? 'pt-3.5 border-t border-slate-100' : ''}`}>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 font-mono bg-slate-5 border border-slate-200 px-2 py-0.5 rounded-md shadow-3xs">
                      {e.modelId}
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                      Posted:{' '}
                      {new Date(e.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-emerald-600 font-mono">+{e.quantity} pcs</div>
                    <div className="text-[9px] text-slate-450 font-semibold font-sans">Bay Registered</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
