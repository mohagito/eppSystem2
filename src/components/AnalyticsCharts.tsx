import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AirbagModel, StockEntry, ProductionPlan } from '../types';
import { AIRBAG_MODELS } from '../data';
import { BarChart3, TrendingUp, Cpu, Users } from 'lucide-react';

interface ChartsProps {
  entries: StockEntry[];
  plans: ProductionPlan[];
}

export default function AnalyticsCharts({ entries, plans }: ChartsProps) {
  const [activeModel, setActiveModel] = useState<AirbagModel | 'ALL'>('ALL');

  // Compute total quantity per model
  const modelStockData = AIRBAG_MODELS.map((model) => {
    const total = entries
      .filter((e) => e.modelId === model)
      .reduce((sum, e) => sum + e.quantity, 0);
    
    // Find matching planned goals for comparison
    const planned = plans
      .filter((p) => p.model === model)
      .reduce((sum, p) => sum + p.quantityPlanned, 0);

    const completed = plans
      .filter((p) => p.model === model && p.status === 'Completed')
      .reduce((sum, p) => sum + p.quantityPlanned, 0); // simulated actual matching

    return {
      name: model,
      stock: total,
      planned,
      completed,
    };
  });

  const maxStock = Math.max(...modelStockData.map((d) => d.stock), 100);

  // Compute machine output breakdowns dynamically (mapping profiles to respective machines)
  const bigMachineStock = entries
    .filter((e) => {
      const name = e.workerName.toLowerCase();
      return name.includes('mohamed') || name.includes('tarik') || name.includes('hind') || name.includes('bcb') || name.includes('kuga');
    })
    .reduce((sum, e) => sum + e.quantity, 0);

  const smallMachineStock = entries
    .filter((e) => {
      const name = e.workerName.toLowerCase();
      return name.includes('mouad') || name.includes('yassine') || name.includes('crafter') || name.includes('belhadj');
    })
    .reduce((sum, e) => sum + e.quantity, 0);

  const totalStockSum = entries.reduce((sum, e) => sum + e.quantity, 0);

  // Calculate percentage outputs
  const bigPercentage = totalStockSum ? Math.round((bigMachineStock / totalStockSum) * 100) : 0;
  const smallPercentage = totalStockSum ? Math.round((smallMachineStock / totalStockSum) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="analytics-section">
      {/* Primary: Model Distribution Bar Chart */}
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-3xs flex flex-col justify-between" id="bar-chart-card">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="text-emerald-600" size={18} />
                Live Stock Level by Airbag Model
              </h3>
              <p className="text-xs text-slate-500 mt-1">Real-time aggregate manufacturing volumes currently in dispatch bay</p>
            </div>
            <div className="flex gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200 animate-fade-in">
              <button
                onClick={() => setActiveModel('ALL')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeModel === 'ALL'
                    ? 'bg-white text-emerald-700 border border-emerald-100 shadow-3xs font-semibold'
                    : 'text-slate-550 hover:text-slate-800'
                }`}
                id="filter-all-models"
              >
                All Models
              </button>
              {AIRBAG_MODELS.slice(0, 3).map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveModel(m)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    activeModel === m
                      ? 'bg-white text-emerald-700 border border-emerald-100 shadow-3xs font-semibold'
                      : 'text-slate-550 hover:text-slate-800'
                  }`}
                  id={`filter-model-${m.replace(' ', '-')}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {modelStockData
              .filter((d) => activeModel === 'ALL' || d.name === activeModel)
              .map((data, index) => {
                const hasGoal = data.planned > 0;
                const percentage = hasGoal 
                  ? Math.round((data.stock / data.planned) * 100) 
                  : (maxStock > 0 ? Math.round((data.stock / maxStock) * 100) : 0);
                const visualWidth = Math.min(percentage, 100);
                const piecesLeft = hasGoal ? data.planned - data.stock : 0;

                return (
                  <div key={data.name} className="space-y-1.5 group" id={`chart-row-${data.name.replace(' ', '-')}`}>
                     <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-800 group-hover:text-emerald-600 transition-colors font-semibold">
                        {data.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-450 font-mono text-[10.5px]">
                          {hasGoal ? (
                            <>
                              Goal Pace: <span className="text-slate-700 font-bold">{data.stock}</span> / <span className="text-slate-650">{data.planned}</span>
                              {piecesLeft > 0 ? (
                                <span className="text-rose-600 font-extrabold ml-2 bg-rose-50 border border-rose-100 px-1 py-0.5 rounded">
                                  {piecesLeft} left
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold ml-2">
                                  (Target Met! ✓)
                                </span>
                              )}
                            </>
                          ) : (
                            'No target goal set'
                          )}
                        </span>
                        <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-110 px-2 py-0.5 rounded text-[11px] font-mono shadow-3xs">
                          {data.stock} units
                        </span>
                      </div>
                    </div>
                    <div className="h-6.5 w-full bg-slate-50 rounded-xl overflow-hidden border border-slate-150 p-1 flex items-center shadow-3xs">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(visualWidth, 4)}%` }}
                        transition={{ duration: 0.8, delay: index * 0.05, ease: 'easeOut' }}
                        className={`h-full bg-linear-to-r ${
                          hasGoal && percentage >= 100
                            ? 'from-emerald-500 to-teal-500'
                            : hasGoal
                              ? 'from-rose-500 via-rose-450 to-pink-500 shadow-[0_0_6px_rgba(244,63,94,0.3)] animate-pulse'
                              : 'from-teal-500 via-emerald-500 to-emerald-400'
                        } rounded-lg flex items-center justify-end px-2`}
                      >
                        {percentage > 15 && (
                          <span className="text-[10px] font-extrabold text-white font-mono drop-shadow-sm">
                            {percentage}%
                          </span>
                        )}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-linear-to-r from-teal-500 to-emerald-400"></span>
            <span>Completed units stored</span>
          </div>
          <span className="font-mono text-slate-400">Scale limit auto-calibrating: {maxStock} units</span>
        </div>
      </div>

      {/* Secondary: Industrial Machine Utilization Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-3xs flex flex-col justify-between" id="machine-utilization-card">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-1">
            <Cpu className="text-emerald-400" size={18} />
            Machine Output Metrics
          </h3>
          <p className="text-xs text-slate-500 mb-6 font-medium">Assigned work centers load distribution statistics</p>

          <div className="flex justify-center py-4 relative">
            {/* Elegant SVG Custom Semi-Circle Gauges */}
            <svg width="180" height="120" viewBox="0 0 100 60" className="opacity-90">
              {/* Center Track */}
              <path
                d="M10 50 A40 40 0 0 1 90 50"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Big Machine (Emerald Layer to 65% angle) */}
              <path
                d="M10 50 A40 40 0 0 1 90 50"
                fill="none"
                stroke="url(#emeraldGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(bigPercentage / 100) * 125} 125`}
                className="transition-all duration-1000"
              />
              {/* Small Machine overlay */}
              <defs>
                <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <text x="50" y="44" textAnchor="middle" className="fill-slate-800 font-extrabold text-[8px] font-mono leading-none">
                {bigPercentage}% : {smallPercentage}%
              </text>
              <text x="50" y="52" textAnchor="middle" className="fill-slate-500 text-[4.5px] font-bold tracking-wider uppercase font-sans">
                Primary Machine load
              </text>
            </svg>
          </div>

          <div className="space-y-4 mt-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between" id="metric-big-machine">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded bg-emerald-500 shrink-0"></span>
                <div>
                  <div className="text-xs font-semibold text-slate-800">Big Machine Line</div>
                  <div className="text-[10px] text-slate-500">Assigned worker: Mohamed</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-slate-800 font-mono">{bigMachineStock} units</div>
                <div className="text-[10px] text-slate-450 font-mono font-medium">{bigPercentage}% output</div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between" id="metric-small-machine">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded bg-teal-500 shrink-0"></span>
                <div>
                  <div className="text-xs font-semibold text-slate-800">Small Machine Line</div>
                  <div className="text-[10px] text-slate-500">Assigned worker: Mouad</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-slate-800 font-mono">{smallMachineStock} units</div>
                <div className="text-[10px] text-slate-450 font-mono font-medium">{smallPercentage}% output</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
          <TrendingUp size={14} className="text-teal-500" />
          <span>Optimal output balance established.</span>
        </div>
      </div>
    </div>
  );
}
