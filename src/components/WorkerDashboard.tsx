import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { UserProfile, StockEntry, ProductionPlan } from '../types';
import { AIRBAG_MODELS } from '../data';
import {
  ClipboardCheck,
  Boxes,
  ArrowRight,
  Target
} from 'lucide-react';

interface WorkerProps {
  currentUser: UserProfile;
  entries: StockEntry[];
  plans: ProductionPlan[];
  dailyTargets?: Record<string, number>;
  onNavigate: (tab: string) => void;
  onUpdatePlanStatus?: (id: string, status: 'Pending' | 'Completed' | 'Delayed') => void;
}

export default function WorkerDashboard({
  currentUser,
  entries,
  plans,
  onNavigate
}: WorkerProps) {
  // 1. Get recent stock entries submitted by this specific worker
  const workerEntries = useMemo(() => {
    return entries
      .filter((e) => e.workerName === currentUser.name)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }, [entries, currentUser.name]);

  // Calculate dynamic model-specific targets – perfectly linked & synced with StockManagement
  const modelProgressData = useMemo(() => {
    return AIRBAG_MODELS.map((model) => {
      // Show actual total stockpile production for this model (unrestricted by worker/date to align with Stock ledger metrics)
      const stock = entries
        .filter((e) => e.modelId === model)
        .reduce((sum, e) => sum + e.quantity, 0);

      // Show overall planned level for this model
      const planned = plans
        .filter((p) => p.model === model)
        .reduce((sum, p) => sum + p.quantityPlanned, 0);

      return {
        name: model,
        stock,
        planned,
      };
    });
  }, [entries, plans]);

  const maxStock = useMemo(() => {
    return Math.max(...modelProgressData.map((d) => d.stock), 100);
  }, [modelProgressData]);

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

      {/* TARGETS & PROGRESS MONITOR BOARD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs" id="worker-goals-board">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <h3 className="text-xs font-extrabold uppercase text-slate-950 tracking-wider flex items-center gap-2">
              <Target size={17} className="text-emerald-555 animate-pulse shrink-0" />
              Cushion Models – Live Production Targets
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 font-semibold">
              Track actual stockpile levels against accumulated planned targets.
            </p>
          </div>
          <span className="text-[10px] bg-slate-50 border border-slate-150 text-slate-600 px-3 py-1 rounded-lg font-mono font-bold">
            6 Models Tracked
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {modelProgressData.map((data, index) => {
            const hasGoal = data.planned > 0;
            const percentage = hasGoal 
              ? Math.round((data.stock / data.planned) * 100) 
              : (maxStock > 0 ? Math.round((data.stock / maxStock) * 100) : 0);
            
            // If stock is exactly 0, set visual width to 0% so there is no visual pill inside an empty progress bar.
            const visualWidth = data.stock > 0 
              ? Math.max(Math.min(percentage, 100), 5) 
              : 0;
              
            const piecesLeft = hasGoal ? data.planned - data.stock : 0;

            return (
              <div key={data.name} className="space-y-1.5 p-3 rounded-xl border border-slate-100/90 bg-slate-50/20 hover:bg-slate-50/50 transition-colors" id={`worker-model-target-${data.name.replace(' ', '-')}`}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-slate-300 rounded-full shrink-0 group-hover:bg-emerald-500 transition-colors" />
                    <span className="font-extrabold text-slate-800">{data.name}</span>
                  </div>

                  <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-mono">
                    {data.stock} Produced
                  </span>
                </div>

                <div className="h-6.5 w-full bg-white rounded-xl overflow-hidden border border-slate-150 p-1 flex items-center shadow-3xs">
                  {visualWidth > 0 ? (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${visualWidth}%` }}
                      transition={{ duration: 0.8, delay: index * 0.05, ease: 'easeOut' }}
                      className={`h-full bg-linear-to-r ${
                        hasGoal && percentage >= 100
                          ? 'from-emerald-500 to-teal-500' // Goal achieved
                          : hasGoal
                            ? 'from-rose-500 via-rose-450 to-pink-500 shadow-[0_0_6px_rgba(244,63,94,0.3)] animate-pulse' // Active goal in progress (deficit style - red)
                            : 'from-sky-500 via-blue-500 to-indigo-500' // No active goal, but has production stockpile (blue indicator)
                      } rounded-lg flex items-center justify-end px-2`}
                    >
                      {percentage > 15 && (
                        <span className="text-[10px] font-extrabold text-white font-mono drop-shadow-xs">
                          {percentage}%
                        </span>
                      )}
                    </motion.div>
                  ) : (
                    <div className="h-full w-full rounded-lg bg-slate-50/50 border border-dashed border-slate-150 flex items-center justify-center">
                      <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider">
                        {hasGoal ? `0% Start Assigned` : `No production record`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-1">
                  <span className="font-semibold">
                    {hasGoal ? `Shift Target: ${data.planned} pcs` : 'No shifts targeted'}
                  </span>
                  {hasGoal ? (
                    piecesLeft > 0 ? (
                      <span className="text-rose-600 font-extrabold font-mono flex items-center gap-1 bg-rose-50/70 border border-rose-100 px-1.5 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                        {piecesLeft} pcs left
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-extrabold font-semibold flex items-center gap-1 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                        Completed! ✓
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400 font-sans">Target not assigned</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
