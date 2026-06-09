import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AirbagModel, StockEntry, ProductionPlan, DeliveryEntry } from '../types';
import { AIRBAG_MODELS } from '../data';
import { BarChart3, TrendingUp, Cpu, Users } from 'lucide-react';

interface ChartsProps {
  entries: StockEntry[];
  plans: ProductionPlan[];
  deliveries?: DeliveryEntry[];
}

export default function AnalyticsCharts({ entries, plans, deliveries = [] }: ChartsProps) {
  const [activeModel, setActiveModel] = useState<AirbagModel | 'ALL'>('ALL');

  // Compute total quantity per model
  const modelStockData = AIRBAG_MODELS.map((model) => {
    const totalProduced = entries
      .filter((e) => e.modelId === model)
      .reduce((sum, e) => sum + e.quantity, 0);

    const totalDelivered = deliveries
      .filter((d) => d.modelId === model)
      .reduce((sum, d) => sum + d.quantity, 0);

    const netStock = totalProduced - totalDelivered;
    
    // Find matching planned goals for comparison
    const planned = plans
      .filter((p) => p.model === model)
      .reduce((sum, p) => sum + p.quantityPlanned, 0);

    const completed = plans
      .filter((p) => p.model === model && p.status === 'Completed')
      .reduce((sum, p) => sum + p.quantityPlanned, 0); // simulated actual matching

    return {
      name: model,
      stock: netStock,
      planned,
      completed,
    };
  });

  const maxStock = Math.max(...modelStockData.map((d) => d.stock), 100);

  const totalStockSum = modelStockData.reduce((sum, d) => sum + d.stock, 0);

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-6 shadow-3xs flex flex-col justify-between" id="bar-chart-card">
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
            {AIRBAG_MODELS.map((m) => (
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modelStockData
            .filter((d) => activeModel === 'ALL' || d.name === activeModel)
            .map((data) => {
              const percentage = totalStockSum ? Math.round((data.stock / totalStockSum) * 100) : 0;

              return (
                <div
                  key={data.name}
                  className="p-4 rounded-xl border border-slate-150 bg-slate-50/30 hover:bg-slate-50/80 transition-all flex items-center justify-between"
                  id={`chart-row-${data.name.replace(' ', '-')}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-550 shadow-3xs" />
                    <div>
                      <span className="text-sm font-bold text-slate-800 tracking-tight">
                        {data.name}
                      </span>
                      {percentage > 0 && (
                        <p className="text-[10px] text-slate-450 font-bold font-mono">
                          {percentage}% of total stock
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-705 bg-emerald-50/70 border border-emerald-150 px-3 py-1.5 rounded-xl font-mono shadow-3xs">
                    {data.stock.toLocaleString()} units
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="font-semibold text-slate-600">Total Factory Inventory</span>
        </div>
        <span className="font-mono text-slate-405 font-bold">{totalStockSum.toLocaleString()} units active</span>
      </div>
    </div>
  );
}
