import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Award, 
  Info, 
  Archive 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell 
} from 'recharts';
import { 
  RollEntry, 
  UserProfile, 
  StockEntry, 
  DeliveryEntry, 
  FinishedPiecePrice, 
  ExpectedYieldConfig, 
  MaterialFamily 
} from '../types';
import { 
  normalizeRollStatus, 
  normalizeRollMaterial, 
  getMaterialFamily, 
  calculateRollProductionMetrics 
} from '../utils/financialCalculations';

interface EfficiencyAnalyticsProps {
  currentUser: UserProfile;
  rolls: RollEntry[];
  stockEntries?: StockEntry[];
  deliveries?: DeliveryEntry[];
  piecePrices?: FinishedPiecePrice[];
  expectedYields?: ExpectedYieldConfig[];
}

const MATERIAL_FAMILIES: MaterialFamily[] = [
  'INDIA / DELCOTEX',
  'HUESKER 82',
  'HUESKER 22',
  'KUGA'
];

interface ClosedRollMetrics {
  id: string;
  barcode: string;
  material: string;
  family: MaterialFamily;
  expected: number;
  adjustedExpected?: number;
  nokFormats?: number;
  produced: number;
  efficiency: number;
  closedDate: string;
}

export default function EfficiencyAnalytics({
  currentUser,
  rolls,
  stockEntries = [],
  deliveries = [],
  piecePrices = [],
  expectedYields = []
}: EfficiencyAnalyticsProps) {
  // Selected material filter for the Efficiency Trend line chart
  const [selectedFilter, setSelectedFilter] = useState<'All' | MaterialFamily>('All');

  // Extract and process ONLY CLOSED rolls for analytics
  const closedRolls = useMemo<ClosedRollMetrics[]>(() => {
    return rolls
      .filter((r) => normalizeRollStatus(r.status) === 'CLOSED')
      .map((roll) => {
        const metrics = calculateRollProductionMetrics(roll, expectedYields, piecePrices, stockEntries);
        const material = normalizeRollMaterial(roll.materialName);
        const family = getMaterialFamily(material);
        const barcode = roll.barcode || roll.rollNumber || roll.id;

        // Material Efficiency % = Produced PCS ÷ Adjusted Expected PCS × 100
        const isIndia = material === 'Delcotex India' || family === 'INDIA / DELCOTEX';
        const nokF = isIndia ? (roll.nokFormats ?? roll.reconciliation?.nokFormats ?? 0) : 0;
        const nokEquiv = nokF * 15;
        const originalExpected = roll.expectedPieces || metrics.expectedPieces || 0;
        const adjustedExpected = isIndia && nokF > 0 ? Math.max(0, originalExpected - nokEquiv) : originalExpected;
        const produced = roll.producedPieces !== undefined ? roll.producedPieces : metrics.producedPieces;

        let efficiency = 0;
        if (roll.reconciliation?.materialEfficiency !== undefined && roll.reconciliation.materialEfficiency > 0) {
          efficiency = roll.reconciliation.materialEfficiency;
        } else if (roll.materialEfficiency !== undefined && roll.materialEfficiency > 0) {
          efficiency = roll.materialEfficiency;
        } else if (adjustedExpected > 0) {
          efficiency = Math.round((produced / adjustedExpected) * 10000) / 100;
        } else if (metrics.materialEfficiency > 0) {
          efficiency = metrics.materialEfficiency;
        }

        const closedDate = roll.closedAt || roll.date || roll.openedAt || '';

        return {
          id: roll.id,
          barcode,
          material,
          family,
          expected: originalExpected,
          adjustedExpected: isIndia && nokF > 0 ? adjustedExpected : undefined,
          nokFormats: isIndia && nokF > 0 ? nokF : undefined,
          produced,
          efficiency,
          closedDate
        };
      })
      // Sort rolls chronologically / sequence order for trend progression
      .sort((a, b) => {
        const timeA = new Date(a.closedDate).getTime() || 0;
        const timeB = new Date(b.closedDate).getTime() || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.barcode.localeCompare(b.barcode);
      });
  }, [rolls, expectedYields, piecePrices, stockEntries]);

  // 1. Summary Card Calculations
  const averageEfficiency = useMemo(() => {
    if (closedRolls.length === 0) return 0;
    const total = closedRolls.reduce((acc, r) => acc + r.efficiency, 0);
    return Math.round((total / closedRolls.length) * 10) / 10;
  }, [closedRolls]);

  const bestRoll = useMemo(() => {
    if (closedRolls.length === 0) return null;
    return [...closedRolls].sort((a, b) => b.efficiency - a.efficiency)[0];
  }, [closedRolls]);

  const lowestRoll = useMemo(() => {
    if (closedRolls.length === 0) return null;
    return [...closedRolls].sort((a, b) => a.efficiency - b.efficiency)[0];
  }, [closedRolls]);

  const totalClosedRolls = closedRolls.length;

  // 2. Efficiency Trend Data
  const trendData = useMemo(() => {
    const filtered = selectedFilter === 'All'
      ? closedRolls
      : closedRolls.filter((r) => r.family === selectedFilter);

    return filtered.map((r) => ({
      barcode: r.barcode,
      efficiency: r.efficiency,
      family: r.family,
      produced: r.produced,
      expected: r.expected,
      adjustedExpected: r.adjustedExpected,
      nokFormats: r.nokFormats
    }));
  }, [closedRolls, selectedFilter]);

  // 3. Material Comparison Data (Horizontal Bar Chart, Ranked highest to lowest)
  const comparisonData = useMemo(() => {
    return MATERIAL_FAMILIES.map((family) => {
      const familyRolls = closedRolls.filter((r) => r.family === family);
      const count = familyRolls.length;
      const avg = count > 0
        ? Math.round((familyRolls.reduce((sum, r) => sum + r.efficiency, 0) / count) * 10) / 10
        : 0;

      return {
        name: family,
        efficiency: avg,
        count
      };
    }).sort((a, b) => b.efficiency - a.efficiency);
  }, [closedRolls]);

  return (
    <div className="space-y-6" id="efficiency-analytics-container">
      {/* Top Banner Bar */}
      <div className="bg-white border border-slate-200/90 shadow-xs rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <TrendingUp size={20} className="text-emerald-500 shrink-0" />
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Efficiency Analytics
          </h2>
        </div>
        <div>
          <span className="px-4 py-1.5 rounded-xl bg-slate-100/90 text-slate-600 font-mono text-[11px] font-bold tracking-wider border border-slate-200 block sm:inline-block text-center">
            FORMULA: PRODUCED ÷ EXPECTED × 100
          </span>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5" id="efficiency-summary-cards">
        {/* Card 1: Average Efficiency */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
              AVERAGE EFFICIENCY
            </span>
            <span className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg border border-emerald-100/60">
              <TrendingUp size={14} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black font-sans text-slate-900 select-all tracking-tight">
              {averageEfficiency.toFixed(1)}%
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Across {totalClosedRolls} closed roll{totalClosedRolls === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Card 2: Best Roll Efficiency */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
              BEST ROLL EFFICIENCY
            </span>
            <span className="p-1.5 bg-amber-50 text-amber-500 rounded-lg border border-amber-100/60">
              <Award size={14} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black font-sans text-emerald-500 select-all tracking-tight">
              {bestRoll ? `${bestRoll.efficiency.toFixed(1)}%` : '0.0%'}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              {bestRoll ? `Roll ${bestRoll.barcode}` : 'No closed rolls'}
            </p>
          </div>
        </div>

        {/* Card 3: Lowest Roll Efficiency */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
              LOWEST ROLL EFFICIENCY
            </span>
            <span className="p-1.5 bg-slate-100 text-slate-400 rounded-lg border border-slate-200/60">
              <Info size={14} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black font-sans text-slate-900 select-all tracking-tight">
              {lowestRoll ? `${lowestRoll.efficiency.toFixed(1)}%` : '0.0%'}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              {lowestRoll ? `Roll ${lowestRoll.barcode}` : 'No closed rolls'}
            </p>
          </div>
        </div>

        {/* Card 4: Total Closed Rolls */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
              TOTAL CLOSED ROLLS
            </span>
            <span className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg border border-indigo-100/60">
              <Archive size={14} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black font-sans text-indigo-600 select-all tracking-tight">
              {totalClosedRolls}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Fully consumed & reconciled
            </p>
          </div>
        </div>
      </div>

      {/* Main Charts: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="efficiency-analytics-charts">
        {/* Left Column: Efficiency Trend Line Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Efficiency Trend
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Material Efficiency % per closed roll
                </p>
              </div>

              {/* Material Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setSelectedFilter('All')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedFilter === 'All'
                      ? 'bg-slate-950 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                {MATERIAL_FAMILIES.map((family) => (
                  <button
                    key={family}
                    onClick={() => setSelectedFilter(family)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedFilter === family
                        ? 'bg-slate-950 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {family}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Chart */}
            <div className="h-64 w-full pt-2">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 15, right: 20, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="barcode"
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                      dy={8}
                    />
                    <YAxis
                      domain={[0, 110]}
                      ticks={[0, 30, 60, 90, 110]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                      tickFormatter={(val) => `${val}%`}
                      dx={-2}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800 space-y-1">
                              <div className="font-bold text-slate-200 font-mono">Roll {data.barcode}</div>
                              <div className="text-[11px] text-slate-400">{data.family}</div>
                              <div className="text-emerald-400 font-black text-sm pt-1">
                                {data.efficiency.toFixed(1)}% Efficiency
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Produced: {data.produced} / Expected: {data.adjustedExpected ? `${data.adjustedExpected} (Orig: ${data.expected}, NOK: ${data.nokFormats})` : data.expected} pcs
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="efficiency"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                  No closed rolls match the selected filter.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Material Comparison Horizontal Bar Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Material Comparison
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Average Material Efficiency % (Closed Rolls)
                </p>
              </div>
              <span className="text-xs font-bold font-mono tracking-wider text-slate-400 uppercase">
                RANKED
              </span>
            </div>

            {/* Horizontal Bar Chart */}
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={comparisonData}
                  layout="vertical"
                  margin={{ top: 15, right: 20, left: 20, bottom: 10 }}
                  barSize={18}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                    tickFormatter={(val) => `${val}%`}
                    dy={8}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#1e293b', fontWeight: 700 }}
                    width={130}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800 space-y-1">
                            <div className="font-bold text-slate-200">{data.name}</div>
                            <div className="text-emerald-400 font-black text-sm">
                              {data.efficiency > 0 ? `${data.efficiency.toFixed(1)}%` : 'No closed rolls'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Based on {data.count} closed roll{data.count === 1 ? '' : 's'}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="efficiency" radius={[0, 6, 6, 0]}>
                    {comparisonData.map((entry, index) => {
                      // Top ranked is Emerald Green, second is Indigo/Purple, others follow harmonious palette
                      const color = index === 0
                        ? '#10b981'
                        : index === 1
                        ? '#6366f1'
                        : index === 2
                        ? '#38bdf8'
                        : '#94a3b8';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
