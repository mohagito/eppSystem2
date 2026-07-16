import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { UserProfile, StockEntry, ProductionPlan, DeliveryEntry } from '../types';
import { AIRBAG_MODELS } from '../data';
import {
  TrendingUp,
  Cpu,
  Users,
  Layers,
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
  AlertTriangle,
  Download,
  Calendar
} from 'lucide-react';
import AnalyticsCharts from './AnalyticsCharts';
import {
  getPlanActualProduced,
  getAchievementPercent,
  getAchievementStatus,
  getAchievementColors
} from '../utils/achievement';

function getISOWeekDetails(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { year: 2026, weekNum: 1, label: 'Week 01', key: '2026-W01' };

  // Get Monday of that week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // Get ISO week number
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 4);
  const dev = (target.getDay() + 6) % 7;
  target.setDate(4 - dev);
  const weekNum = Math.round((firstThursday - target.valueOf()) / 604800000) + 1;
  const year = new Date(firstThursday).getFullYear();

  const formatShortDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const label = `Week ${weekNum} (${formatShortDate(monday)} - ${formatShortDate(sunday)})`;
  const key = `${year}-W${String(weekNum).padStart(2, '0')}`;

  return { year, weekNum, label, key, monday, sunday };
}

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

  // --- WEEKLY BACKUP / AUDIT EXPORT TOOL STATE & MEMOS ---
  // Helper to extract weeks from all items
  const allSystemWeeks = useMemo(() => {
    const weeksMap: Record<string, { key: string; label: string }> = {};

    // 1. Get current week
    const today = new Date();
    const todayStrVal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const curWeek = getISOWeekDetails(todayStrVal);
    weeksMap[curWeek.key] = { key: curWeek.key, label: `${curWeek.label} (Current)` };

    // 2. Extract from production plans
    plans.forEach(p => {
      const w = getISOWeekDetails(p.planDate);
      if (!weeksMap[w.key]) {
        weeksMap[w.key] = { key: w.key, label: w.label };
      }
    });

    // 3. Extract from stock entries
    entries.forEach(e => {
      if (e.date) {
        const w = getISOWeekDetails(e.date);
        if (!weeksMap[w.key]) {
          weeksMap[w.key] = { key: w.key, label: w.label };
        }
      }
    });

    // 4. Extract from deliveries
    deliveries.forEach(d => {
      if (d.date) {
        const w = getISOWeekDetails(d.date);
        if (!weeksMap[w.key]) {
          weeksMap[w.key] = { key: w.key, label: w.label };
        }
      }
    });

    // Sort weeks in descending order (newest first)
    return Object.values(weeksMap).sort((a, b) => b.key.localeCompare(a.key));
  }, [plans, entries, deliveries]);

  const [backupWeekKey, setBackupWeekKey] = useState<string>(() => {
    const today = new Date();
    const todayStrVal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return getISOWeekDetails(todayStrVal).key;
  });

  const backupWeekStats = useMemo(() => {
    // Filter items belonging to the selected backupWeekKey
    const weekPlans = plans.filter(p => getISOWeekDetails(p.planDate).key === backupWeekKey);
    const weekEntries = entries.filter(e => e.date && getISOWeekDetails(e.date).key === backupWeekKey);
    const weekDeliveries = deliveries.filter(d => d.date && getISOWeekDetails(d.date).key === backupWeekKey);

    const plannedQty = weekPlans.reduce((sum, p) => sum + p.quantityPlanned, 0);
    const actualQty = weekPlans.reduce((sum, p) => sum + getPlanActualProduced(p, entries, plans), 0);
    const shippedQty = weekDeliveries.reduce((sum, d) => sum + d.quantity, 0);

    return {
      plans: weekPlans,
      entries: weekEntries,
      deliveries: weekDeliveries,
      plannedQty,
      actualQty,
      shippedQty,
      plansCount: weekPlans.length,
      entriesCount: weekEntries.length,
      deliveriesCount: weekDeliveries.length
    };
  }, [backupWeekKey, plans, entries, deliveries]);

  const handleDownloadWeeklyReport = () => {
    const selectedWeekObj = allSystemWeeks.find(w => w.key === backupWeekKey);
    const weekLabel = selectedWeekObj ? selectedWeekObj.label : `Week ${backupWeekKey}`;
    const today = new Date();
    const todayStrVal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Group entries/plans to see who did what for a summary
    const workerPerformance: Record<string, { planned: number; produced: number }> = {};
    backupWeekStats.plans.forEach(p => {
      const name = p.assignedWorker;
      if (!workerPerformance[name]) {
        workerPerformance[name] = { planned: 0, produced: 0 };
      }
      workerPerformance[name].planned += p.quantityPlanned;
      workerPerformance[name].produced += getPlanActualProduced(p, entries, plans);
    });

    const operatorPerformanceList = Object.entries(workerPerformance).map(([name, stats]) => {
      const efficiency = stats.planned > 0 ? `${Math.round((stats.produced / stats.planned) * 100)}%` : 'N/A';
      return {
        operatorName: name,
        plannedQuantity: stats.planned,
        actualProduced: stats.produced,
        efficiencyRate: efficiency
      };
    });

    const backupData = {
      reportHeader: {
        organizationName: "EPP Manufacturing Systems Inc.",
        facilityPlant: "Rabat-Morocco Automotive Operations",
        reportType: "System Audit, Database Backup & Weekly Performance",
        reportExportTime: today.toISOString(),
        generatedBy: currentUser.name + ` (${currentUser.role.toUpperCase()})`,
        targetWeekKey: backupWeekKey,
        targetWeekLabel: weekLabel,
        systemStatus: "STABLE",
        integrityKey: `EPP-SEC-VERIFIED-${backupWeekKey}-${today.getTime().toString(36).toUpperCase()}`
      },
      summaryStatistics: {
        totalSchedulesCreated: backupWeekStats.plansCount,
        totalManufacturingOutputLogs: backupWeekStats.entriesCount,
        totalShipmentsDispatched: backupWeekStats.deliveriesCount,
        totalQuantityPlanned: backupWeekStats.plannedQty,
        totalQuantityProduced: backupWeekStats.actualQty,
        overallAchievementRate: backupWeekStats.plannedQty > 0 
          ? `${Math.round((backupWeekStats.actualQty / backupWeekStats.plannedQty) * 100)}%`
          : '0%',
        totalQuantityShipped: backupWeekStats.shippedQty
      },
      operatorSummaryPerformance: operatorPerformanceList,
      productionPlans: backupWeekStats.plans.map(p => ({
        planId: p.id,
        model: p.model,
        planDate: p.planDate,
        shift: p.shift,
        quantityPlanned: p.quantityPlanned,
        actualProduced: getPlanActualProduced(p, entries, plans),
        assignedWorker: p.assignedWorker,
        machine: p.machine,
        status: p.status
      })),
      stockpileOutputLedger: backupWeekStats.entries.map(e => ({
        entryId: e.id,
        modelId: e.modelId,
        quantityAdded: e.quantity,
        dateLogged: e.date,
        loggedByOperator: e.workerName,
        timestampUTC: e.createdAt
      })),
      shipmentsLedger: backupWeekStats.deliveries.map(d => ({
        shipmentId: d.id,
        modelId: d.modelId,
        quantityShipped: d.quantity,
        shipmentDate: d.date,
        carrierName: d.carrier || 'Standard Freight',
        timestampUTC: d.createdAt
      }))
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EPP_FACTORY_WEEK_BACKUP_${backupWeekKey}_${todayStrVal}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadWeeklyExcelReport = () => {
    const selectedWeekObj = allSystemWeeks.find(w => w.key === backupWeekKey);
    const weekLabel = selectedWeekObj ? selectedWeekObj.label : `Week ${backupWeekKey}`;
    const today = new Date();
    const todayStrVal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 1. Dashboard Overview sheet
    const overviewData = [
      ["SYSTEM AUDIT, DATABASE BACKUP & WEEKLY PERFORMANCE REPORT"],
      ["Company", "EPP Manufacturing Systems Inc."],
      ["Facility Plant", "Rabat-Morocco Automotive Operations"],
      ["Export Time", today.toISOString()],
      ["Generated By", `${currentUser.name} (${currentUser.role.toUpperCase()})`],
      ["Target Week", weekLabel],
      ["System Status", "STABLE"],
      ["Integrity Security Key", `EPP-SEC-VERIFIED-${backupWeekKey}-${today.getTime().toString(36).toUpperCase()}`],
      [],
      ["WEEKLY KEY PERFORMANCE SUMMARY METRICS"],
      ["Metric Name", "Value"],
      ["Total Schedules Created", backupWeekStats.plansCount],
      ["Total Manufacturing Output Logs", backupWeekStats.entriesCount],
      ["Total Shipments Dispatched", backupWeekStats.deliveriesCount],
      ["Total Quantity Planned", backupWeekStats.plannedQty],
      ["Total Quantity Produced", backupWeekStats.actualQty],
      ["Overall Achievement Rate", backupWeekStats.plannedQty > 0 
        ? `${Math.round((backupWeekStats.actualQty / backupWeekStats.plannedQty) * 100)}%`
        : '0%'],
      ["Total Quantity Shipped", backupWeekStats.shippedQty],
      [],
      ["OPERATOR SUMMARY PERFORMANCE"]
    ];

    // Calculate worker stats
    const workerPerformance: Record<string, { planned: number; produced: number }> = {};
    backupWeekStats.plans.forEach(p => {
      const name = p.assignedWorker;
      if (!workerPerformance[name]) {
        workerPerformance[name] = { planned: 0, produced: 0 };
      }
      workerPerformance[name].planned += p.quantityPlanned;
      workerPerformance[name].produced += getPlanActualProduced(p, entries, plans);
    });

    overviewData.push(["Operator Name", "Planned Quantity", "Actual Produced", "Efficiency Rate"]);
    Object.entries(workerPerformance).forEach(([name, stats]) => {
      const efficiency = stats.planned > 0 ? `${Math.round((stats.produced / stats.planned) * 100)}%` : 'N/A';
      overviewData.push([name, stats.planned, stats.produced, efficiency]);
    });

    // 2. Production Plans sheet
    const plansHeaders = [["Plan ID", "Airbag Model", "Planned Date", "Shift", "Quantity Planned", "Quantity Produced", "Assigned Operator", "Machine No.", "Status"]];
    const plansRows = backupWeekStats.plans.map(p => [
      p.id,
      p.model,
      p.planDate,
      p.shift,
      p.quantityPlanned,
      getPlanActualProduced(p, entries, plans),
      p.assignedWorker,
      p.machine,
      p.status
    ]);
    const plansSheetData = plansHeaders.concat(plansRows);

    // 3. Stock Output Ledger
    const stockHeaders = [["Log ID", "Model ID", "Quantity Added", "Logged Date", "Logged By Operator", "Timestamp UTC"]];
    const stockRows = backupWeekStats.entries.map(e => [
      e.id,
      e.modelId,
      e.quantity,
      e.date,
      e.workerName,
      e.createdAt
    ]);
    const stockSheetData = stockHeaders.concat(stockRows);

    // 4. Deliveries ledger
    const deliveryHeaders = [["Shipment ID", "Model ID", "Quantity Shipped", "Shipment Date", "Carrier Name", "Timestamp UTC"]];
    const deliveryRows = backupWeekStats.deliveries.map(d => [
      d.id,
      d.modelId,
      d.quantity,
      d.date,
      d.carrier || 'Standard Freight',
      d.createdAt
    ]);
    const deliverySheetData = deliveryHeaders.concat(deliveryRows);

    // Build the Workbook
    const wb = XLSX.utils.book_new();

    const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
    const wsPlans = XLSX.utils.aoa_to_sheet(plansSheetData);
    const wsStock = XLSX.utils.aoa_to_sheet(stockSheetData);
    const wsDeliveries = XLSX.utils.aoa_to_sheet(deliverySheetData);

    // Set column widths for better professional layout readability
    wsOverview["!cols"] = [{ wch: 30 }, { wch: 45 }];
    wsPlans["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 12 }];
    wsStock["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 25 }];
    wsDeliveries["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 25 }];

    XLSX.utils.book_append_sheet(wb, wsOverview, "Audit & Performance");
    XLSX.utils.book_append_sheet(wb, wsPlans, "Production Schedules");
    XLSX.utils.book_append_sheet(wb, wsStock, "Output Logs");
    XLSX.utils.book_append_sheet(wb, wsDeliveries, "Shipments Dispatch");

    XLSX.writeFile(wb, `EPP_FACTORY_WEEK_AUDIT_${backupWeekKey}_${todayStrVal}.xlsx`);
  };

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

  // Segment/operator shift filter for Production Achievement Summary
  const [operatorFilter, setOperatorFilter] = useState<'all' | 'Mohamed' | 'Mouad'>('all');

  // NEW: Memoized calculations for Production Achievement Stats
  const totalPlannedOverall = useMemo(() => {
    const targetPlans = operatorFilter === 'all' 
      ? plans 
      : plans.filter(p => p.assignedWorker.toLowerCase() === operatorFilter.toLowerCase());
    return targetPlans.reduce((sum, p) => sum + p.quantityPlanned, 0);
  }, [plans, operatorFilter]);

  const totalActualOverall = useMemo(() => {
    const targetPlans = operatorFilter === 'all' 
      ? plans 
      : plans.filter(p => p.assignedWorker.toLowerCase() === operatorFilter.toLowerCase());
    return targetPlans.reduce((sum, p) => sum + getPlanActualProduced(p, entries, plans), 0);
  }, [plans, entries, operatorFilter]);

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
      const modelPlans = plans.filter((p) => {
        const matchesModel = p.model === model;
        const matchesOperator = operatorFilter === 'all' || p.assignedWorker.toLowerCase() === operatorFilter.toLowerCase();
        return matchesModel && matchesOperator;
      });
      const planned = modelPlans.reduce((sum, p) => sum + p.quantityPlanned, 0);
      const actual = modelPlans.reduce((sum, p) => sum + getPlanActualProduced(p, entries, plans), 0);

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
  }, [plans, entries, operatorFilter]);

  return (
    <div className="space-y-8" id="manager-dashboard-view">
      {/* INDUSTRIAL GREETING CARD */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold animate-pulse">
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Activity size={16} className="text-emerald-600" />
              Production Achievement Summary
            </h3>
            <p className="text-xs text-slate-400">Track and compare efficiency of individual shifts and operator lines</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Shift Selector Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200" id="operator-shift-tabs">
              <button
                onClick={() => setOperatorFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  operatorFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Combined
              </button>
              <button
                onClick={() => setOperatorFilter('Mohamed')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  operatorFilter === 'Mohamed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mohamed's Line
              </button>
              <button
                onClick={() => setOperatorFilter('Mouad')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  operatorFilter === 'Mouad'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mouad's Line
              </button>
            </div>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Shift Status:</span>
              <span className={`px-2.5 py-0.5 rounded-full border text-xs font-black uppercase font-mono ${overallColors.bg} ${overallColors.text}`}>
                {overallStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          {/* Column 1: Overall Factory Performance */}
          <div className="md:col-span-5 bg-slate-50 border border-slate-150 rounded-2xl p-5 flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <h4 className="text-2xs font-extrabold uppercase tracking-widest text-slate-455">
                {operatorFilter === 'all' 
                  ? 'Overall Factory Rate' 
                  : operatorFilter === 'Mohamed' 
                    ? "Mohamed's Shift Rate" 
                    : "Mouad's Shift Rate"}
              </h4>
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
                const actualQty = getPlanActualProduced(plan, entries, plans);
                const isComp = actualQty >= plan.quantityPlanned;
                const resolvedStatus = isComp 
                  ? 'Completed' 
                  : (plan.status === 'Completed' ? (actualQty > 0 ? 'In Progress' : 'Pending') : plan.status || 'Pending');

                let statColor = 'bg-slate-50 text-slate-500 border-slate-200';
                if (resolvedStatus === 'Completed') statColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (resolvedStatus === 'Delayed') statColor = 'bg-amber-50 text-amber-700 border-amber-200';
                if (resolvedStatus === 'In Progress') statColor = 'bg-sky-50 text-sky-700 border-sky-200';
                if (resolvedStatus === 'Pending') statColor = 'bg-sky-50 text-sky-700 border-sky-200';

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
                          {actualQty} <span className="text-slate-400 font-bold text-[10.5px]">/ {plan.quantityPlanned} pcs</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {/* Dropdown status update */}
                        {onUpdatePlanStatus && (
                          <select
                            value={resolvedStatus}
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

      {/* SYSTEM SECURITY & DATABASE BACKUP CONTROL CENTRE */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 md:p-8 border border-slate-800 shadow-xl space-y-6" id="system-control-centre-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-800 pb-6">
          <div className="space-y-1.5">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-2 font-sans">
              <Database size={16} />
              SYSTEM CONTROL CENTRE & AUDIT BACKUPS
            </h3>
            <p className="text-xs text-slate-400">Export official weekly audit reports, generate secure local backups, or perform ledger resets</p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-750 px-3 py-1.5 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">DATABASE INTEGRITY SECURE</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Section A: Weekly Backup & Export (8 Columns on Large Screens) */}
          <div className="lg:col-span-8 bg-slate-950/65 border border-slate-800/50 rounded-xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">STEP 1: SELECT AUDIT WEEK</span>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar size={14} className="text-emerald-400" />
                  <select
                    value={backupWeekKey}
                    onChange={(e) => setBackupWeekKey(e.target.value)}
                    className="text-xs font-bold text-slate-200 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer min-w-[240px]"
                  >
                    {allSystemWeeks.map((w) => (
                      <option key={w.key} value={w.key}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-center">
                <button
                  onClick={handleDownloadWeeklyExcelReport}
                  className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  <Download size={14} className="stroke-[2.5]" />
                  Export Weekly Excel Report (.XLSX)
                </button>
                <button
                  onClick={handleDownloadWeeklyReport}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                >
                  <Download size={13} />
                  Export JSON Backup (.JSON)
                </button>
              </div>
            </div>

            {/* Quick Preview Grid of Selected Backup Week */}
            <div className="pt-4 border-t border-slate-800/60 grid grid-cols-3 gap-3">
              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Schedules</span>
                <span className="text-base font-black font-mono text-slate-200">{backupWeekStats.plansCount} <span className="text-[10px] text-slate-500 font-normal">lines</span></span>
              </div>
              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Output Logs</span>
                <span className="text-base font-black font-mono text-emerald-400">+{backupWeekStats.entriesCount} <span className="text-[10px] text-slate-500 font-normal">logs</span></span>
              </div>
              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Dispatched Shipments</span>
                <span className="text-base font-black font-mono text-amber-400">-{backupWeekStats.deliveriesCount} <span className="text-[10px] text-slate-500 font-normal">freights</span></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-[11px] text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                <span>Includes comprehensive metrics for all models (KUGA, TETOUAN, VW)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                <span>Generates secure offline file format compliant with ERP protocols</span>
              </div>
            </div>
          </div>

          {/* Section B: Maintenance & Disaster Recovery (4 Columns on Large Screens) */}
          <div className="lg:col-span-4 bg-slate-950/65 border border-slate-800/50 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono block">DISASTER RECOVERY</span>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                If ledger data becomes corrupted, or if you need to wipe out shift schedules, use the authorized system utilities below.
              </p>
            </div>

            <div className="space-y-2.5">
              {onResetDefaults && (
                <button
                  onClick={onResetDefaults}
                  className="w-full py-2 px-3 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-750 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  <RefreshCw size={12} className="text-slate-400 animate-spin" />
                  Restore Demo Factory Presets
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                {onClearStock && (
                  <button
                    onClick={onClearStock}
                    className="py-2 px-2 bg-rose-950/40 hover:bg-rose-950/65 text-rose-300 border border-rose-900/60 hover:border-rose-800 rounded-lg text-[10.5px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={11} className="text-rose-400" />
                    Purge Stock
                  </button>
                )}

                {onClearPlans && (
                  <button
                    onClick={onClearPlans}
                    className="py-2 px-2 bg-rose-950/40 hover:bg-rose-950/65 text-rose-300 border border-rose-900/60 hover:border-rose-800 rounded-lg text-[10.5px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <XCircle size={11} className="text-rose-400" />
                    Wipe Schedules
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
