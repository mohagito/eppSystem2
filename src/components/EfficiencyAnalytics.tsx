import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { RollEntry, StockEntry, FinishedPiecePrice, ExpectedYieldConfig } from '../types';
import { normalizeRollStatus, calculateRollProductionMetrics } from '../utils/financialCalculations';
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
  TrendingUp,
  Award,
  AlertCircle,
  Archive,
  Layers
} from 'lucide-react';

export type AnalyticsMaterial = 'INDIA / DELCOTEX' | 'HUESKER 82' | 'HUESKER 22' | 'KUGA';

export const ANALYTICS_MATERIALS: AnalyticsMaterial[] = [
  'INDIA / DELCOTEX',
  'HUESKER 82',
  'HUESKER 22',
  'KUGA'
];

/**
 * Maps any roll's materialName to the 4 canonical comparison groups
 */
export function mapToAnalyticsMaterial(materialName: string, referenceId?: string): AnalyticsMaterial {
  const lower = (materialName || '').toLowerCase();
  const refLower = (referenceId || '').toLowerCase();

  if (lower.includes('delcotex') || lower.includes('india') || refLower.includes('sk216') || refLower.includes('vw217')) {
    return 'INDIA / DELCOTEX';
  }
  if (lower.includes('yellow') || lower.includes('h22') || lower.includes('huesker 22') || refLower.includes('bcb') || refLower.includes('tetouan')) {
    return 'HUESKER 22';
  }
  if (lower.includes('kuga') || lower.includes('sage')) {
    return 'KUGA';
  }
  return 'HUESKER 82';
}

interface EfficiencyAnalyticsProps {
  rolls: RollEntry[];
  stockEntries?: StockEntry[];
  piecePrices?: FinishedPiecePrice[];
  expectedYields?: ExpectedYieldConfig[];
}

export default function EfficiencyAnalytics({
  rolls,
  stockEntries = [],
  piecePrices,
  expectedYields
}: EfficiencyAnalyticsProps) {
  // Material filter for Trend Chart
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<'ALL' | AnalyticsMaterial>('ALL');

  // 1. Process ONLY CLOSED rolls for historical analytics
  const closedRollsData = useMemo(() => {
    const closed = rolls.filter((r) => normalizeRollStatus(r.status) === 'CLOSED');

    return closed.map((roll) => {
      const metrics = calculateRollProductionMetrics(roll, expectedYields, piecePrices, stockEntries);
      const materialGroup = mapToAnalyticsMaterial(roll.materialName, roll.referenceId || metrics.referenceId);
      
      // Calculate efficiency: Produced PCS / Expected PCS * 100
      let efficiency = metrics.materialEfficiency;
      if (efficiency === undefined || efficiency === null || isNaN(efficiency)) {
        efficiency = metrics.expectedPieces > 0 
          ? Math.round((metrics.producedPieces / metrics.expectedPieces) * 10000) / 100 
          : 0;
      }

      // Safe date formatting
      const rawDate = roll.closedAt || roll.date || roll.openedAt || '';
      let displayDate = 'Closed';
      let timestamp = 0;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          timestamp = d.getTime();
          displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      }

      const rollId = roll.barcode || roll.id || 'N/A';

      return {
        id: roll.id,
        rollId,
        materialName: roll.materialName,
        materialGroup,
        efficiency,
        producedPieces: metrics.producedPieces,
        expectedPieces: metrics.expectedPieces,
        date: displayDate,
        timestamp
      };
    });
  }, [rolls, expectedYields, piecePrices, stockEntries]);

  // Chronologically sorted for the trend chart
  const chronologicallySortedRolls = useMemo(() => {
    return [...closedRollsData].sort((a, b) => {
      if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
      return a.id.localeCompare(b.id);
    });
  }, [closedRollsData]);

  // Efficiency-sorted list (descending)
  const efficiencySortedRolls = useMemo(() => {
    return [...closedRollsData].sort((a, b) => b.efficiency - a.efficiency);
  }, [closedRollsData]);

  // 2. TOP SUMMARY KPIs
  const summaryKPIs = useMemo(() => {
    const count = closedRollsData.length;
    if (count === 0) {
      return {
        averageEfficiency: 0,
        bestRoll: null,
        lowestRoll: null,
        totalClosedRolls: 0
      };
    }

    const sumEff = closedRollsData.reduce((acc, r) => acc + r.efficiency, 0);
    const averageEfficiency = Math.round((sumEff / count) * 10) / 10;
    const bestRoll = efficiencySortedRolls[0];
    const lowestRoll = efficiencySortedRolls[efficiencySortedRolls.length - 1];

    return {
      averageEfficiency,
      bestRoll,
      lowestRoll,
      totalClosedRolls: count
    };
  }, [closedRollsData, efficiencySortedRolls]);

  // 3. EFFICIENCY TREND DATA (with optional material filter)
  const trendChartData = useMemo(() => {
    const list = selectedMaterialFilter === 'ALL'
      ? chronologicallySortedRolls
      : chronologicallySortedRolls.filter((r) => r.materialGroup === selectedMaterialFilter);

    return list.map((item, idx) => ({
      index: idx + 1,
      rollId: item.rollId,
      efficiency: item.efficiency,
      material: item.materialGroup,
      date: item.date,
      producedPieces: item.producedPieces,
      expectedPieces: item.expectedPieces
    }));
  }, [chronologicallySortedRolls, selectedMaterialFilter]);

  // 4. MATERIAL COMPARISON DATA (Sorted highest to lowest efficiency)
  const materialComparisonData = useMemo(() => {
    const stats = ANALYTICS_MATERIALS.map((material) => {
      const rollsInGroup = closedRollsData.filter((r) => r.materialGroup === material);
      const count = rollsInGroup.length;
      const avgEfficiency = count > 0
        ? Math.round((rollsInGroup.reduce((acc, r) => acc + r.efficiency, 0) / count) * 10) / 10
        : 0;

      return {
        material,
        avgEfficiency,
        rollCount: count
      };
    });

    // Sort materials from highest to lowest efficiency
    return stats.sort((a, b) => b.avgEfficiency - a.avgEfficiency);
  }, [closedRollsData]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" id="efficiency-analytics-view">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Efficiency Analytics</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xs font-mono font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
            Formula: Produced ÷ Expected × 100
          </span>
        </div>
      </div>

      {/* 1. TOP SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="efficiency-top-summary">
        {/* Average Efficiency % */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-400">
              Average Efficiency
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900">
              {summaryKPIs.averageEfficiency > 0 ? `${summaryKPIs.averageEfficiency.toFixed(1)}%` : '—'}
            </div>
            <p className="text-2xs text-slate-400 font-semibold mt-1">
              {summaryKPIs.totalClosedRolls > 0 ? `Across ${summaryKPIs.totalClosedRolls} closed rolls` : 'No closed rolls yet'}
            </p>
          </div>
        </motion.div>

        {/* Best Roll Efficiency % */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-400">
              Best Roll Efficiency
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Award size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-600">
              {summaryKPIs.bestRoll ? `${summaryKPIs.bestRoll.efficiency.toFixed(1)}%` : '—'}
            </div>
            <p className="text-2xs text-slate-400 font-semibold mt-1 truncate" title={summaryKPIs.bestRoll?.rollId}>
              {summaryKPIs.bestRoll ? `Roll ${summaryKPIs.bestRoll.rollId}` : 'No data'}
            </p>
          </div>
        </motion.div>

        {/* Lowest Roll Efficiency % */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-400">
              Lowest Roll Efficiency
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
              <AlertCircle size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-700">
              {summaryKPIs.lowestRoll ? `${summaryKPIs.lowestRoll.efficiency.toFixed(1)}%` : '—'}
            </div>
            <p className="text-2xs text-slate-400 font-semibold mt-1 truncate" title={summaryKPIs.lowestRoll?.rollId}>
              {summaryKPIs.lowestRoll ? `Roll ${summaryKPIs.lowestRoll.rollId}` : 'No data'}
            </p>
          </div>
        </motion.div>

        {/* Total Closed Rolls */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-400">
              Total Closed Rolls
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Archive size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-indigo-700">
              {summaryKPIs.totalClosedRolls}
            </div>
            <p className="text-2xs text-slate-400 font-semibold mt-1">
              Fully consumed & reconciled
            </p>
          </div>
        </motion.div>
      </div>

      {/* 2 & 3. CHARTS GRID: EFFICIENCY TREND & MATERIAL COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 2. EFFICIENCY TREND (Line Chart) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-3xs flex flex-col justify-between" id="efficiency-trend-card">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Efficiency Trend</h3>
                <p className="text-2xs text-slate-400 font-medium">Material Efficiency % per closed roll</p>
              </div>

              {/* Material Filter Pills */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setSelectedMaterialFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer ${
                    selectedMaterialFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-3xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {ANALYTICS_MATERIALS.map((mat) => (
                  <button
                    key={mat}
                    onClick={() => setSelectedMaterialFilter(mat)}
                    className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer ${
                      selectedMaterialFilter === mat
                        ? 'bg-slate-900 text-white shadow-3xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mat}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-64 w-full mt-2">
              {trendChartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-medium">
                  <Layers size={24} className="mb-2 text-slate-300" />
                  No closed rolls found for this filter.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="rollId"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      domain={[0, 110]}
                      unit="%"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs">
                              <div className="flex items-center justify-between gap-3 font-mono font-bold text-slate-300 border-b border-slate-800 pb-1 mb-1.5">
                                <span>Roll {data.rollId}</span>
                                <span className="text-2xs text-slate-400 font-sans">{data.date}</span>
                              </div>
                              <div className="text-sm font-mono font-black text-emerald-400">
                                Efficiency: {Number(data.efficiency).toFixed(1)}%
                              </div>
                              <div className="text-2xs text-slate-400 mt-1">
                                {data.material} • {data.producedPieces.toLocaleString()} / {data.expectedPieces.toLocaleString()} pcs
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
                      dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* 3. MATERIAL COMPARISON (Bar Chart) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-3xs flex flex-col justify-between" id="material-comparison-card">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Material Comparison</h3>
                <p className="text-2xs text-slate-400 font-medium">Average Material Efficiency % (Closed Rolls)</p>
              </div>
              <span className="text-2xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                Ranked
              </span>
            </div>

            {/* Chart Area */}
            <div className="h-64 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={materialComparisonData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 35, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="material"
                    tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs">
                            <p className="font-bold text-slate-200 mb-1">{data.material}</p>
                            <p className="text-sm font-mono font-black text-indigo-400">
                              Avg Efficiency: {data.avgEfficiency.toFixed(1)}%
                            </p>
                            <p className="text-2xs text-slate-400 mt-1">
                              {data.rollCount} {data.rollCount === 1 ? 'closed roll' : 'closed rolls'} analyzed
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="avgEfficiency"
                    radius={[0, 8, 8, 0]}
                    barSize={20}
                  >
                    {materialComparisonData.map((entry, index) => {
                      const colors = ['#10b981', '#6366f1', '#3b82f6', '#f59e0b'];
                      return (
                        <Cell
                          key={`cell-${entry.material}`}
                          fill={entry.avgEfficiency > 0 ? colors[index % colors.length] : '#e2e8f0'}
                        />
                      );
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
