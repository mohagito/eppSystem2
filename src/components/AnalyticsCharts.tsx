import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { AirbagModel, StockEntry, ProductionPlan, DeliveryEntry } from '../types';
import { AIRBAG_MODELS } from '../data';
import {
  BarChart3,
  TrendingUp,
  Cpu,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  CheckCircle,
  HelpCircle,
  ArrowUpRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface ChartsProps {
  entries: StockEntry[];
  plans: ProductionPlan[];
  deliveries?: DeliveryEntry[];
}

export default function AnalyticsCharts({ entries, plans, deliveries = [] }: ChartsProps) {
  const [activeModel, setActiveModel] = useState<AirbagModel | 'ALL'>('ALL');
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Compute total stock per model
  const modelStockData = useMemo(() => {
    return AIRBAG_MODELS.map((model) => {
      const totalProduced = entries
        .filter((e) => e.modelId === model)
        .reduce((sum, e) => sum + e.quantity, 0);

      const totalDelivered = deliveries
        .filter((d) => d.modelId === model)
        .reduce((sum, d) => sum + d.quantity, 0);

      const netStock = totalProduced - totalDelivered;
      
      const planned = plans
        .filter((p) => p.model === model)
        .reduce((sum, p) => sum + p.quantityPlanned, 0);

      const completed = plans
        .filter((p) => p.model === model && p.status === 'Completed')
        .reduce((sum, p) => sum + (p.quantityCompleted || p.quantityPlanned), 0);

      return {
        name: model,
        stock: netStock,
        planned,
        completed,
      };
    });
  }, [entries, plans, deliveries]);

  const totalStockSum = useMemo(() => {
    return modelStockData.reduce((sum, d) => sum + d.stock, 0);
  }, [modelStockData]);

  // Compute daily production vs targets for the active week
  const weekData = useMemo(() => {
    // Current date (represented as June 22, 2026 in metadata)
    const today = new Date();
    
    // Find Monday of the current week
    const currentDay = today.getDay();
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const baseMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    baseMonday.setDate(diff);
    
    // Apply week offset
    const targetMonday = new Date(baseMonday);
    targetMonday.setDate(baseMonday.getDate() + (weekOffset * 7));
    
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    return dayNames.map((name, index) => {
      const currentDayDate = new Date(targetMonday);
      currentDayDate.setDate(targetMonday.getDate() + index);
      
      const yyyy = currentDayDate.getFullYear();
      const mm = String(currentDayDate.getMonth() + 1).padStart(2, '0');
      const dd = String(currentDayDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      const dayPlans = plans.filter(p => p.planDate === dateStr);
      const target = dayPlans.reduce((sum, p) => sum + p.quantityPlanned, 0);
      
      // Calculate actual physical units produced and added on this date
      const actual = entries
        .filter(e => e.date === dateStr)
        .reduce((sum, e) => sum + e.quantity, 0);
        
      const formattedLabel = `${currentDayDate.getDate()} ${currentDayDate.toLocaleString('en-US', { month: 'short' })}`;
      
      return {
        dateStr,
        dayLabel: name,
        fullDate: formattedLabel,
        fullDayName: fullDayNames[index],
        Target: target,
        Actual: actual,
      };
    });
  }, [plans, entries, weekOffset]);

  // Total targets vs output in the selected week
  const weekSummary = useMemo(() => {
    const totalTarget = weekData.reduce((sum, d) => sum + d.Target, 0);
    const totalActual = weekData.reduce((sum, d) => sum + d.Actual, 0);
    const achievementPercent = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 105) : 0; // safe capping or real calculation
    
    return {
      totalTarget,
      totalActual,
      rate: totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0
    };
  }, [weekData]);

  // Retrieve current active week text label
  const activeWeekLabel = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const baseMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    baseMonday.setDate(diff + (weekOffset * 7));
    
    const baseSunday = new Date(baseMonday);
    baseSunday.setDate(baseMonday.getDate() + 6);
    
    const format = (d: Date) => `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
    return `${format(baseMonday)} - ${format(baseSunday)}, ${baseMonday.getFullYear()}`;
  }, [weekOffset]);

  // Custom tooltips inside Recharts ComposedChart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-xl font-sans text-xs space-y-1.5 min-w-[150px]" id="recharts-custom-tooltip">
          <p className="font-bold text-slate-350 border-b border-slate-800 pb-1">{data.fullDayName} ({data.fullDate})</p>
          <div className="space-y-1 text-2xs uppercase tracking-wider font-extrabold">
            <p className="text-sky-400 flex justify-between gap-4">
              <span>Target:</span>
              <span className="font-mono text-white text-xs">{data.Target.toLocaleString()} pcs</span>
            </p>
            <p className="text-emerald-400 flex justify-between gap-4">
              <span>Actual Output:</span>
              <span className="font-mono text-white text-xs">{data.Actual.toLocaleString()} pcs</span>
            </p>
            <p className="text-slate-450 flex justify-between gap-4 pt-1 border-t border-slate-800/50">
              <span>Status Rate:</span>
              <span className={`font-mono ${data.Actual >= data.Target && data.Target > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {data.Target > 0 ? `${Math.round((data.Actual / data.Target) * 100)}%` : '0% Target'}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="factory-analytics-bento">
      
      {/* COLUMN 1 (8/12 cols): RECHARTS DAILY PRODUCTION VS TARGETS over the week */}
      <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs flex flex-col justify-between" id="daily-production-recharts-card">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="text-emerald-600" size={18} />
                Daily Production vs Plans over the Week
              </h3>
              <p className="text-xs text-slate-500">Compare scheduled target quantity against physical output entries</p>
            </div>

            {/* Week control navigator widget */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-1 border border-slate-200 rounded-xl" id="week-navigator-controls">
              <button
                onClick={() => setWeekOffset(prev => prev - 1)}
                className="p-1.5 hover:bg-white hover:text-slate-950 hover:shadow-3xs rounded-lg transition-all text-slate-500 cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-700 px-3 min-w-[140px] text-center">
                {weekOffset === 0 ? '📅 This Week' : weekOffset === -1 ? '📅 Last Week' : activeWeekLabel}
              </span>
              <button
                onClick={() => setWeekOffset(prev => prev + 1)}
                className="p-1.5 hover:bg-white hover:text-slate-950 hover:shadow-3xs rounded-lg transition-all text-slate-500 cursor-pointer"
                title="Next Week"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Quick summary strip above chart */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-150 p-3 rounded-xl mb-6 text-center" id="week-summary-strip">
            <div className="border-r border-slate-200/80">
              <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Weekly Target</span>
              <p className="text-sm font-black font-mono text-slate-800">{weekSummary.totalTarget.toLocaleString()} units</p>
            </div>
            <div className="border-r border-slate-200/80">
              <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Weekly Actual</span>
              <p className="text-sm font-black font-mono text-emerald-700">{weekSummary.totalActual.toLocaleString()} units</p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Achievement</span>
              <p className={`text-sm font-black font-mono ${weekSummary.rate >= 100 ? 'text-emerald-600' : 'text-sky-600'}`}>
                {weekSummary.rate > 0 ? `${weekSummary.rate}%` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Interactive Recharts visualization canvas */}
          <div className="w-full h-[260px] relative" id="recharts-responsive-wrapper">
            {weekSummary.totalTarget === 0 && weekSummary.totalActual === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <Calendar className="text-slate-350 mb-2" size={32} />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">No Records for this timeframe</span>
                <p className="text-[10px] text-slate-500 mt-1">Move left/right using the navigator or log a new production plan to populate.</p>
                <button
                  onClick={() => setWeekOffset(-2)}
                  className="mt-3 px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-emerald-705 shadow-3xs cursor-pointer hover:bg-slate-50"
                >
                  Go to Mock Data (Week of June 1)
                </button>
              </div>
            ) : null}
            
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={weekData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="actualColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="targetColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="dayLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b', fontFamily: 'monospace' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 4 }} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingBottom: 10 }}
                />
                <Bar
                  name="Physical Actual Output"
                  dataKey="Actual"
                  fill="url(#actualColor)"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                <Line
                  name="Planned Daily Target"
                  type="monotone"
                  dataKey="Target"
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  dot={{ r: 4, stroke: '#0ea5e9', strokeWidth: 1.5, fill: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-[10px] text-slate-500 gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Green bars denote actual output logs.</span>
            <span className="w-2 h-2 rounded-full bg-sky-500 inline-block ml-2"></span>
            <span>Blue line tracks plans assigned by the manager.</span>
          </div>
          <span className="font-semibold text-slate-400 uppercase tracking-widest font-mono text-[9px]">EPP Production metrics</span>
        </div>
      </div>

      {/* COLUMN 2 (4/12 cols): LIVE STOCK LEVELS BY MODEL */}
      <div className="xl:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs flex flex-col justify-between" id="bar-chart-card">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Layers className="text-emerald-600" size={18} />
                Live Stock by Airbag Model
              </h3>
              <p className="text-xs text-slate-500">Net physical stockpile in distribution warehouse</p>
            </div>
          </div>
          
          <div className="flex overflow-x-auto max-w-full p-1 bg-slate-50 rounded-xl border border-slate-200 mb-4 whitespace-nowrap scrollbar-none" id="analytics-filter-rail">
            <button
              onClick={() => setActiveModel('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${
                activeModel === 'ALL'
                  ? 'bg-slate-900 text-white shadow-3xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              id="filter-all-models"
            >
              All Models
            </button>
            {AIRBAG_MODELS.map((m) => (
              <button
                key={m}
                onClick={() => setActiveModel(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${
                  activeModel === m
                    ? 'bg-slate-900 text-white shadow-3xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                id={`filter-model-${m.replace(' ', '-')}`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[295px] overflow-y-auto pr-1">
            {modelStockData
              .filter((d) => activeModel === 'ALL' || d.name === activeModel)
              .map((data) => {
                const percentage = totalStockSum ? Math.round((data.stock / totalStockSum) * 100) : 0;

                return (
                  <div
                    key={data.name}
                    className="p-3 rounded-xl border border-slate-150 bg-slate-50/30 hover:bg-slate-50/80 transition-all flex items-center justify-between"
                    id={`chart-row-${data.name.replace(' ', '-')}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-3xs" />
                      <div>
                        <span className="text-xs font-extrabold text-slate-800 tracking-tight">
                          {data.name}
                        </span>
                        {percentage > 0 && (
                          <p className="text-[9px] text-slate-450 font-bold font-mono">
                            {percentage}% of total inventory
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg font-mono shadow-3xs">
                      {data.stock.toLocaleString()} units
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-slate-600 text-2xs uppercase tracking-wider">Total Inventory</span>
          </div>
          <span className="font-mono text-slate-700 font-black text-xs bg-slate-50 px-2 py-0.5 border border-slate-200 rounded">{totalStockSum.toLocaleString()} units active</span>
        </div>
      </div>
      
    </div>
  );
}
