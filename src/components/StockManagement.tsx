import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, StockEntry, AirbagModel, ProductionPlan, DeliveryEntry } from '../types';
import { AIRBAG_MODELS, MOCK_PROFILES } from '../data';
import {
  PlusCircle,
  Database,
  Calendar,
  User,
  Hash,
  Search,
  Filter,
  CheckCircle,
  FileSpreadsheet,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  Pencil,
  Plus,
  Cpu,
  Download
} from 'lucide-react';

interface StockProps {
  currentUser: UserProfile;
  entries: StockEntry[];
  deliveries?: DeliveryEntry[];
  plans?: ProductionPlan[];
  profiles?: UserProfile[];
  onAddEntry: (entry: Omit<StockEntry, 'id' | 'createdAt'>) => void;
  onDeleteEntry?: (id: string) => void;
  onEditEntry?: (id: string, updatedEntry: Partial<StockEntry>) => void;
}

export default function StockManagement({
  currentUser,
  entries,
  deliveries = [],
  plans = [],
  profiles = [],
  onAddEntry,
  onDeleteEntry,
  onEditEntry
}: StockProps) {
  // Input fields state
  const getLocalDateStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedModel, setSelectedModel] = useState<AirbagModel>('BCB');
  const [workerName, setWorkerName] = useState<string>(currentUser.name);
  const [entryDate, setEntryDate] = useState<string>(getLocalDateStr());
  const [quantity, setQuantity] = useState<string>('');

  React.useEffect(() => {
    if (currentUser) {
      setWorkerName(currentUser.name);
    }
  }, [currentUser]);

  // Target matching association states
  const [associationType, setAssociationType] = useState<string>('NONE');
  const [targetMachine, setTargetMachine] = useState<string>('ALL');
  const [targetPlanId, setTargetPlanId] = useState<string>('');

  // Find plans that match the current selection (date, model, and worker)
  const activeMatchingPlans = useMemo(() => {
    const finalWorkerName = currentUser.role === 'manager' ? workerName : currentUser.name;
    return plans.filter((p) => {
      const dateMatch = p.planDate === entryDate;
      const modelMatch = p.model === selectedModel;
      const workerMatch = p.assignedWorker.toLowerCase() === finalWorkerName.toLowerCase();
      return dateMatch && modelMatch && workerMatch;
    });
  }, [plans, entryDate, selectedModel, workerName, currentUser]);

  // Automatically select the active plan of the day if any matching plans are available, or reset if invalid
  React.useEffect(() => {
    if (activeMatchingPlans.length > 0) {
      const currentExists = activeMatchingPlans.some((p) => p.id === associationType);
      if (!currentExists) {
        const defaultPlan = activeMatchingPlans[0];
        setAssociationType(defaultPlan.id);
        setTargetPlanId(defaultPlan.id);
        setTargetMachine(defaultPlan.machine);
      }
    } else {
      if (associationType !== 'NONE' && associationType !== 'Big Machine' && associationType !== 'Small Machine') {
        setAssociationType('NONE');
        setTargetMachine('ALL');
        setTargetPlanId('');
      }
    }
  }, [activeMatchingPlans, associationType]);
  
  // Edit Stock Entry Modal state
  const [editingEntry, setEditingEntry] = useState<StockEntry | null>(null);
  const [editModel, setEditModel] = useState<AirbagModel>('BCB');
  const [editDate, setEditDate] = useState<string>('');
  const [editQty, setEditQty] = useState<string>('');
  const [editMachine, setEditMachine] = useState<string>('ALL');
  const [editPlanId, setEditPlanId] = useState<string>('');
  const [editFormError, setEditFormError] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');

  // General Stock Direct Correction Modal state
  const [correctingGeneralModel, setCorrectingGeneralModel] = useState<AirbagModel | null>(null);
  const [correctingGeneralCurrentStock, setCorrectingGeneralCurrentStock] = useState<number>(0);
  const [correctingGeneralDesiredStock, setCorrectingGeneralDesiredStock] = useState<string>('');
  const [correctingGeneralReason, setCorrectingGeneralReason] = useState<string>('');
  const [correctingGeneralError, setCorrectingGeneralError] = useState<string>('');

  const handleStartGeneralStockCorrection = (model: AirbagModel, currentStock: number) => {
    setCorrectingGeneralModel(model);
    setCorrectingGeneralCurrentStock(currentStock);
    setCorrectingGeneralDesiredStock(currentStock.toString());
    setCorrectingGeneralReason('');
    setCorrectingGeneralError('');
  };

  const handleGeneralStockCorrectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCorrectingGeneralError('');

    if (!correctingGeneralModel) return;

    const desiredQty = parseInt(correctingGeneralDesiredStock, 10);
    if (isNaN(desiredQty)) {
      setCorrectingGeneralError('Please enter a valid desired stock level.');
      return;
    }

    if (!correctingGeneralReason || correctingGeneralReason.trim().length === 0) {
      setCorrectingGeneralError('Reason for correction is required.');
      return;
    }

    const difference = desiredQty - correctingGeneralCurrentStock;
    if (difference === 0) {
      setCorrectingGeneralError('The desired stock quantity is already equal to the current calculated stock level.');
      return;
    }

    // Register a new correction stock entry that adjusts the quantity by difference
    onAddEntry({
      modelId: correctingGeneralModel,
      workerName: `${currentUser.name}`,
      date: getLocalDateStr(),
      quantity: difference,
      createdBy: currentUser.id,
      machine: undefined,
      planId: undefined,
      // Pass the audit fields
      originalQuantity: correctingGeneralCurrentStock,
      correctedQuantity: desiredQty,
      difference: difference,
      edited: true,
      editedBy: currentUser.name,
      editedByProfileId: currentUser.id,
      editReason: `General Stock Count Recount: ${correctingGeneralReason.trim()}`,
    } as any);

    setCorrectingGeneralModel(null);
  };

  // Expanded stock details history tracking state
  const [expandedStockHistoryIds, setExpandedStockHistoryIds] = useState<Record<string, boolean>>({});

  const toggleRowHistory = (id: string) => {
    setExpandedStockHistoryIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleStartEdit = (entry: StockEntry) => {
    setEditingEntry(entry);
    setEditModel(entry.modelId);
    setEditDate(entry.date);
    setEditQty(entry.quantity.toString());
    setEditMachine(entry.machine || 'ALL');
    setEditPlanId(entry.planId || '');
    setEditFormError('');
    setEditReason('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');

    const parsedQty = parseInt(editQty, 10);
    if (!parsedQty || parsedQty <= 0) {
      setEditFormError('Please enter a valid quantity greater than zero.');
      return;
    }

    if (!editReason || editReason.trim().length === 0) {
      setEditFormError('Reason for correction is required.');
      return;
    }

    if (editingEntry && onEditEntry) {
      const originalQtyToStore = editingEntry.originalQuantity !== undefined ? editingEntry.originalQuantity : editingEntry.quantity;
      onEditEntry(editingEntry.id, {
        quantity: parsedQty,
        originalQuantity: originalQtyToStore,
        correctedQuantity: parsedQty,
        difference: parsedQty - originalQtyToStore,
        edited: true,
        editedBy: currentUser.name,
        editedByProfileId: currentUser.id,
        editReason: editReason.trim(),
      });
      setEditingEntry(null);
    }
  };

  // Filters state
  const [filterModel, setFilterModel] = useState<string>('ALL');
  const [filterWorker, setFilterWorker] = useState<string>('ALL');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // Form submission feedback
  const [formError, setFormError] = useState<string>('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsedQty = parseInt(quantity, 10);
    if (!parsedQty || parsedQty <= 0) {
      setFormError('Please enter a valid quantity greater than zero.');
      return;
    }

    // Handled safely depending on role: if manager, we don't ask about operator, just credit as current manager or empty
    const finalWorkerName = currentUser.role === 'manager' ? workerName : currentUser.name;

    if (!finalWorkerName) {
      setFormError('Operator / Worker Name is required.');
      return;
    }

    onAddEntry({
      modelId: selectedModel,
      workerName: finalWorkerName,
      date: entryDate || getLocalDateStr(),
      quantity: parsedQty,
      createdBy: currentUser.id,
      machine: targetMachine !== 'ALL' ? (targetMachine as any) : undefined,
      planId: targetPlanId || undefined,
    });

    // Reset fields except date and worker name
    setQuantity('');
    setAssociationType('NONE');
    setTargetMachine('ALL');
    setTargetPlanId('');
  };

  // Pre-calculate per-model sums for stats cards (Subtract deliveries)
  const stockSums = useMemo(() => {
    const sums = {} as Record<AirbagModel, number>;
    AIRBAG_MODELS.forEach((m) => {
      sums[m] = 0;
    });

    entries.forEach((e) => {
      if (sums[e.modelId] !== undefined) {
        sums[e.modelId] += e.quantity;
      }
    });

    // Subtract deliveries to automatically remove from stock
    deliveries.forEach((d) => {
      if (sums[d.modelId] !== undefined) {
        sums[d.modelId] -= d.quantity;
      }
    });

    return sums;
  }, [entries, deliveries]);

  // Totals for header
  const totalProduced = useMemo(() => {
    return entries.reduce((sum, e) => sum + e.quantity, 0);
  }, [entries]);

  const totalDelivered = useMemo(() => {
    return deliveries.reduce((sum, d) => sum + d.quantity, 0);
  }, [deliveries]);

  const totalNetAvailable = useMemo(() => {
    return totalProduced - totalDelivered;
  }, [totalProduced, totalDelivered]);

  // Aggregate workers for helper filter dropdown
  const uniqueWorkersInHistory = useMemo(() => {
    const workers = new Set<string>();
    entries.forEach((e) => workers.add(e.workerName));
    return Array.from(workers);
  }, [entries]);

  // Filter & search implementation
  const filteredEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((e) => {
      const matchModel = filterModel === 'ALL' || e.modelId === filterModel;
      const matchWorker = filterWorker === 'ALL' || e.workerName === filterWorker;
      const matchSearch = filterSearch === '' || 
        e.workerName.toLowerCase().includes(filterSearch.toLowerCase()) || 
        e.modelId.toLowerCase().includes(filterSearch.toLowerCase());
      return matchModel && matchWorker && matchSearch;
    });
  }, [entries, filterModel, filterWorker, filterSearch]);

  // CSV download function for external record-keeping
  const downloadCSV = () => {
    const headers = ['ID', 'Airbag Model', 'Operator Name', 'Assembly Date', 'Qty (pcs)', 'Target Machine', 'Linked Plan ID', 'Record Timestamp'];
    const rows = filteredEntries.map(e => [
      e.id,
      e.modelId,
      e.workerName,
      e.date,
      e.quantity,
      e.machine || 'General',
      e.planId || 'N/A',
      e.createdAt
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const str = String(val ?? '').replace(/"/g, '""');
        return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `epp_stock_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Beautiful, fully styled Excel Report download function with company logo and branding colors
  const downloadExcel = () => {
    const totalQty = filteredEntries.reduce((sum, e) => sum + e.quantity, 0);
    const dateFormatted = new Date().toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const excelRows = filteredEntries.map((e, index) => {
      const isEven = index % 2 === 0;
      const bgStyle = isEven ? 'class="row-even"' : 'class="row-odd"';
      const safeId = e.id;
      const safeModel = e.modelId;
      const safeWorker = e.workerName;
      const safeDate = e.date;
      const safeQty = e.quantity;
      const safeMachine = e.machine || 'General';
      const safePlan = e.planId || 'N/A';
      const safeCreatedAt = e.createdAt ? String(new Date(e.createdAt).toLocaleString('es-ES')) : 'N/A';

      return `
        <tr ${bgStyle}>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-family: monospace; color: #475569; font-size: 10px;">${safeId}</td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">${safeModel}</td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: 500; color: #334155;">${safeWorker}</td>
          <td class="text-center" style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: center;">${safeDate}</td>
          <td class="text-right qty-col" style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #ff7700; background-color: #fff7ed;">${safeQty} pcs</td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: center; color: #475569; font-weight: 500;">${safeMachine}</td>
          <td class="text-center" style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; color: #0284c7; font-weight: bold;">${safePlan}</td>
          <td class="text-center" style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px; color: #64748b; font-family: monospace;">${safeCreatedAt}</td>
        </tr>
      `;
    }).join('');

    const htmlTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>EPP Stock Ledger</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 20px;
          }
          table {
            border-collapse: collapse;
          }
          td, th {
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            font-size: 11px;
            color: #334155;
          }
          
          /* Header brand */
          .company-title {
            font-size: 18px;
            font-weight: bold;
            color: #1e293b;
          }
          .report-subtitle {
            font-size: 11px;
            color: #ff7700;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .meta-label {
            font-size: 10px;
            color: #475569;
            font-weight: bold;
            background-color: #f1f5f9;
          }
          .meta-val {
            font-size: 10px;
            color: #1e293b;
          }
          
          /* Table headers */
          th {
            background-color: #1e293b;
            color: #ffffff;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 1px solid #334155;
          }
          
          /* Alternating rows and formatting */
          .row-even {
            background-color: #f8fafc;
          }
          .row-odd {
            background-color: #ffffff;
          }
          .text-center {
            text-align: center;
          }
          .text-right {
            text-align: right;
          }
          .qty-col {
            font-weight: bold;
            color: #ff7700;
            background-color: #fff7ed;
          }
          .total-row td {
            background-color: #fff7ed;
            font-weight: bold;
            border-top: 2px solid #ff7700;
            border-bottom: 2px solid #ff7700;
            color: #ff7700;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <table>
          <!-- Company Header Block with Logo -->
          <tr>
            <td colspan="2" rowspan="3" style="vertical-align: middle; text-align: center; background-color: #f8fafc; padding: 12px; border: 1px solid #cbd5e1;">
              <img src="https://www.eppnatur.es/media/yootheme/cache/1c/logo_eppnatur_3-1ce587ca.webp" alt="EPP Logo" width="120" style="display:block; margin: 0 auto; max-height:48px;" />
            </td>
            <td colspan="6" class="company-title" style="padding-left:15px; border-bottom: none; border-left: none; font-size: 18px; font-weight: bold; color: #1e293b;">
              EPP NATUR AUTOMOTIVE S.L.
            </td>
          </tr>
          <tr>
            <td colspan="6" class="report-subtitle" style="padding-left:15px; border-top: none; border-bottom: none; border-left: none; font-size: 11px; color: #ff7700; font-weight: bold; letter-spacing: 0.5px;">
              MANUFACTURING & ASSEMBLY STOCK LEDGER
            </td>
          </tr>
          <tr>
            <td colspan="6" style="padding-left:15px; font-size: 10px; color: #64748b; font-style: italic; border-top: none; border-left: none;">
              Generated: ${dateFormatted} • System: EPP Digital Hub (Whiteboard)
            </td>
          </tr>
          
          <!-- Spacing Row -->
          <tr style="height: 12px;"><td colspan="8" style="border:none;"></td></tr>

          <!-- Metadata Properties -->
          <tr>
            <td colspan="2" class="meta-label" style="font-size: 10px; color: #475569; font-weight: bold; background-color: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1;">Ledger Scope:</td>
            <td colspan="2" class="meta-val" style="font-size: 10px; color: #1e293b; padding: 8px 12px; border: 1px solid #cbd5e1;">Stock Register Output</td>
            <td colspan="2" class="meta-label" style="font-size: 10px; color: #475569; font-weight: bold; background-color: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1;">Filter Settings:</td>
            <td colspan="2" class="meta-val" style="font-size: 10px; color: #1e293b; padding: 8px 12px; border: 1px solid #cbd5e1;">
              Model: <span style="font-weight: bold;">${filterModel}</span> | 
              Operator: <span style="font-weight: bold;">${filterWorker}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="meta-label" style="font-size: 10px; color: #475569; font-weight: bold; background-color: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1;">Total Records:</td>
            <td colspan="2" class="meta-val" style="font-size: 10px; color: #1e293b; font-weight: bold; color: #1e293b; padding: 8px 12px; border: 1px solid #cbd5e1;">${filteredEntries.length} entries</td>
            <td colspan="2" class="meta-label" style="font-size: 10px; color: #475569; font-weight: bold; background-color: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1;">Total Quantity:</td>
            <td colspan="2" class="meta-val" style="font-size: 10px; color: #ff7700; font-weight: bold; padding: 8px 12px; border: 1px solid #cbd5e1;">${totalQty} pcs</td>
          </tr>

          <!-- Spacing Row -->
          <tr style="height: 15px;"><td colspan="8" style="border:none;"></td></tr>

          <!-- Data Headers with exact widths to prevent squeezed headers in Excel -->
          <thead>
            <tr>
              <th style="width: 150px; text-align: left; background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #334155;">System ID</th>
              <th style="width: 130px; text-align: left; background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #334155;">Airbag Model</th>
              <th style="width: 140px; text-align: left; background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #334155;">Operator Name</th>
              <th style="width: 110px; text-align: center; background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #334155;">Assembly Date</th>
              <th style="width: 120px; text-align: right; background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #334155;">Qty (pcs)</th>
              <th style="width: 130px; text-align: center; background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #334155;">Target Machine</th>
              <th style="width: 140px; text-align: center; background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #334155;">Linked Plan ID</th>
              <th style="width: 160px; text-align: center; background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #334155;">Record Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${excelRows}
            
            <!-- Spacing Row -->
            <tr style="height: 8px;"><td colspan="8" style="border:none;"></td></tr>

            <!-- Grand Total Summary Row -->
            <tr class="total-row">
              <td colspan="4" style="font-weight: bold; text-align: left; background-color: #fff7ed; border-top: 2px solid #ff7700; border-bottom: 2px solid #ff7700; padding: 8px 12px;">GRAND TOTAL MANUFACTURED STOCK</td>
              <td class="text-right" style="font-weight: bold; color: #ff7700; background-color: #fff7ed; border-top: 2px solid #ff7700; border-bottom: 2px solid #ff7700; padding: 8px 12px; text-align: right;">${totalQty} pcs</td>
              <td colspan="3" style="border-left: none; background-color: #fff7ed; border-top: 2px solid #ff7700; border-bottom: 2px solid #ff7700; padding: 8px 12px;"></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), htmlTemplate], { 
      type: 'application/vnd.ms-excel;charset=utf-8;' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `epp_stock_report_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8" id="stock-management-view">
      {/* Overview stats per model */}
      <div id="model-aggregates-row">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-500 font-sans">Available Stock Per Model</h3>
          <div className="flex items-center gap-2">
            <span className="text-2s font-mono text-slate-450 tracking-wider font-extrabold uppercase">
              Prod: {totalProduced} | Deliv: {totalDelivered}
            </span>
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full font-mono font-bold shadow-3xs">
              {totalNetAvailable} Available Units
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {AIRBAG_MODELS.map((model) => {
            const stockVal = stockSums[model];
            const hasStock = stockVal > 0;
            const isNegative = stockVal < 0;

            return (
              <motion.div
                key={model}
                whileHover={{ y: -3, scale: 1.02 }}
                className={`p-4 rounded-xl border transition-all duration-300 relative group ${
                  isNegative
                    ? 'bg-rose-50/50 border-rose-200 text-rose-700 shadow-3xs'
                    : hasStock 
                      ? 'bg-white border-slate-200 shadow-3xs' 
                      : 'bg-slate-50/50 border-slate-100 opacity-60'
                }`}
                id={`stat-card-${model.replace(' ', '-')}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-2s font-mono text-slate-450 tracking-wider font-extrabold uppercase">{model}</div>
                  {currentUser.role === 'manager' && (
                    <button
                      onClick={() => handleStartGeneralStockCorrection(model, stockVal)}
                      className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100 absolute top-2 right-2 duration-200"
                      title={`Correct general stock level for ${model}`}
                      id={`correct-general-stock-${model.replace(' ', '-')}`}
                    >
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-baseline justify-between select-none">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold font-mono ${isNegative ? 'text-rose-600' : 'text-slate-900'}`}>
                      {stockVal}
                    </span>
                    <span className="text-[10px] text-slate-450 font-bold">pcs</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ADD STOCK ENTRY FORM */}
        <div className="lg:col-span-1" id="add-stock-form-container">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs sticky top-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <PlusCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Add Stock Entry</h3>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4" id="add-stock-form">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-705 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Model selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                  <Database size={13} className="text-emerald-555" />
                  Airbag Model
                </label>
                <div className="relative">
                  <select
                     value={selectedModel}
                     onChange={(e) => setSelectedModel(e.target.value as AirbagModel)}
                     className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                     id="stock-form-model"
                  >
                    {AIRBAG_MODELS.map((model) => (
                      <option key={model} value={model} className="bg-white text-slate-800">
                        {model}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Worker Name field */}
              {currentUser.role !== 'manager' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                    <User size={13} className="text-emerald-555" />
                    Operator / Worker Name
                  </label>
                  {currentUser.role === 'worker' ? (
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-600 font-semibold shadow-3xs">
                      {workerName}
                      <span className="text-[10px] text-emerald-600 font-bold font-mono ml-2">(Auto-filled)</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={workerName}
                        onChange={(e) => setWorkerName(e.target.value)}
                        className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                        id="stock-form-worker-select"
                      >
                        {(profiles && profiles.length > 0 ? profiles : MOCK_PROFILES).filter((p) => p.role === 'worker').map((profile) => (
                          <option key={profile.id} value={profile.name}>
                            {profile.name} ({profile.station || 'Operator'})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  )}
                </div>
              )}

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                  <Calendar size={13} className="text-emerald-555" />
                  Assembly Date
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-colors shadow-3xs"
                  id="stock-form-date"
                />
              </div>

              {/* Target / Machine Association */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                  <Cpu size={13} className="text-emerald-555" />
                  Target / Machine
                </label>
                <div className="relative">
                  <select
                    value={associationType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssociationType(val);
                      if (val === 'NONE') {
                        setTargetMachine('ALL');
                        setTargetPlanId('');
                      } else if (val === 'Big Machine' || val === 'Small Machine') {
                        setTargetMachine(val);
                        setTargetPlanId('');
                      } else {
                        setTargetPlanId(val);
                        const p = plans?.find((plan) => plan.id === val);
                        if (p) {
                          setTargetMachine(p.machine);
                        }
                      }
                    }}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                    id="stock-form-association"
                  >
                    <option value="NONE">General Stock (No specific target)</option>
                    <option value="Big Machine">Big Machine (General)</option>
                    <option value="Small Machine">Small Machine (General)</option>
                    {activeMatchingPlans.length > 0 && (
                      <optgroup label="Active Plans on this Date" className="bg-white font-semibold text-emerald-700">
                        {activeMatchingPlans.map((p) => (
                          <option key={p.id} value={p.id} className="text-slate-800 font-medium">
                            Plan: {p.machine} ({p.shift}) - Goal: {p.quantityPlanned}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                  <Hash size={13} className="text-emerald-555" />
                  Manufactured Quantity (pcs)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-colors shadow-3xs"
                  min="1"
                  required
                  id="stock-form-quantity"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                id="submit-stock-entry"
              >
                <CheckCircle size={15} />
                Confirm Stock Input
              </button>
            </form>
          </div>
        </div>

        {/* LIST HISTORY LOG */}
        <div className="lg:col-span-2" id="stock-history-container">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-600" size={18} />
                  Stock Ledger Ledger
                </h3>
              </div>

              {/* Export CSV and Expand Search / Filter toggle button */}
              <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
                <button
                  onClick={downloadExcel}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-600 hover:bg-emerald-750 text-white transition-all cursor-pointer shadow-3xs hover:shadow-xs active:scale-95 border border-emerald-500"
                  id="download-stock-excel"
                  title="Export professionally styled EPP company Excel report with logo and custom brand colors"
                >
                  <FileSpreadsheet size={14} />
                  <span>Export Excel</span>
                </button>

                <button
                  onClick={downloadCSV}
                  className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-705 border border-slate-205 transition-all cursor-pointer shadow-3xs"
                  id="download-stock-csv"
                  title="Download raw data in standard CSV format"
                >
                  <Download size={14} />
                  <span>Download CSV</span>
                </button>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border cursor-pointer shadow-3xs ${
                    showFilters || filterModel !== 'ALL' || filterWorker !== 'ALL' || filterSearch
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  id="toggle-filters"
                >
                  <SlidersHorizontal size={14} />
                  <span>Filters {showFilters ? 'Hide' : 'Show'}</span>
                  {(filterModel !== 'ALL' || filterWorker !== 'ALL' || filterSearch) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  )}
                </button>
              </div>
            </div>

            {/* Filter drawer with slide animation */}
            <AnimatePresence>
              {(showFilters || filterModel !== 'ALL' || filterWorker !== 'ALL' || filterSearch) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4"
                  id="expanded-filter-drawer"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Model filter */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Filter by Model</label>
                      <select
                        value={filterModel}
                        onChange={(e) => setFilterModel(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 font-medium focus:outline-hidden"
                        id="filter-model-select"
                      >
                        <option value="ALL">All Models</option>
                        {AIRBAG_MODELS.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Operator filter */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Filter by Operator</label>
                      <select
                        value={filterWorker}
                        onChange={(e) => setFilterWorker(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 font-medium focus:outline-hidden"
                        id="filter-worker-select"
                      >
                        <option value="ALL">All Workers</option>
                        {uniqueWorkersInHistory.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Full Search Bar */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Search Text</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search worker/model..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 focus:outline-hidden placeholder-slate-400 font-medium"
                          id="filter-search-input"
                        />
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      </div>
                    </div>
                  </div>

                  {/* Reset button */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => {
                        setFilterModel('ALL');
                        setFilterWorker('ALL');
                        setFilterSearch('');
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-800 hover:underline cursor-pointer font-medium"
                      id="reset-filters-button"
                    >
                      Clear all active filters
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* LEDGER DATA TABLE */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs" id="ledger-table-container">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase">Airbag Model</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase hidden sm:table-cell">Assembled By</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase hidden sm:table-cell">Date</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase text-right">Quantity</th>
                      {currentUser.role === 'manager' && (
                        <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase text-center w-12">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {filteredEntries.length === 0 ? (
                        <tr>
                          <td colSpan={currentUser.role === 'manager' ? 5 : 4} className="p-8 text-center text-xs text-slate-500">
                            No stock registrations match your selected filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredEntries.map((e) => (
                          <React.Fragment key={e.id}>
                            <motion.tr
                              key={e.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                              id={`ledger-row-${e.id}`}
                            >
                              <td className="p-4">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-800 font-mono tracking-wide bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                                    {e.modelId}
                                  </span>
                                  {e.machine && (
                                    <span className="text-[9px] font-extrabold uppercase bg-sky-50 text-sky-600 border border-sky-100 rounded-md px-2 py-0.5 tracking-normal">
                                      {e.machine}
                                    </span>
                                  )}
                                  {e.planId && (
                                    <span className="text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md px-2 py-0.5 tracking-normal">
                                      Linked Plan
                                    </span>
                                  )}
                                  {e.edited && (
                                    <button
                                      onClick={() => currentUser.role === 'manager' && toggleRowHistory(e.id)}
                                      className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase rounded-md px-2 py-0.5 tracking-normal transition-all outline-hidden ${
                                        currentUser.role === 'manager'
                                          ? 'bg-amber-100 text-amber-705 border border-amber-200 hover:bg-amber-200 cursor-pointer'
                                          : 'bg-amber-50 text-amber-600 border border-amber-100'
                                      }`}
                                      title={currentUser.role === 'manager' ? 'Click to expand correction history' : 'Stock has been corrected'}
                                      id={`corrected-badge-${e.id}`}
                                    >
                                      <span>Corrected</span>
                                      {currentUser.role === 'manager' && (
                                        <ChevronDown size={10} className={`transform transition-transform ${expandedStockHistoryIds[e.id] ? 'rotate-180' : ''}`} />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 hidden sm:table-cell">
                                <span className="text-xs font-bold text-slate-800">
                                  {e.workerName}
                                </span>
                              </td>
                              <td className="p-4 text-xs font-mono text-slate-500 uppercase hidden sm:table-cell">
                                {new Date(e.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: '2-digit',
                                  year: 'numeric',
                                })}
                              </td>
                              <td className={`p-4 text-xs font-extrabold text-right font-mono select-all ${e.quantity < 0 ? 'text-rose-605 bg-rose-50/20 border-r-2 border-rose-500 pr-3.5' : 'text-emerald-600'}`}>
                                {e.quantity > 0 ? `+${e.quantity}` : e.quantity} pcs
                              </td>
                              {currentUser.role === 'manager' && (
                                <td className="p-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleStartEdit(e)}
                                      className="text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 p-2 rounded-lg transition-colors cursor-pointer"
                                      title="Edit stock entry"
                                      id={`edit-entry-${e.id}`}
                                    >
                                      <Pencil size={13.5} />
                                    </button>
                                    <button
                                      onClick={() => onDeleteEntry?.(e.id)}
                                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer"
                                      title="Delete stock entry"
                                      id={`delete-entry-${e.id}`}
                                    >
                                      <Trash2 size={13.5} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </motion.tr>
                            {e.edited && expandedStockHistoryIds[e.id] && currentUser.role === 'manager' && (
                              <tr className="bg-amber-50/20" id={`history-row-${e.id}`}>
                                <td colSpan={5} className="p-4 pt-1 pb-4">
                                  <div className="bg-white border border-amber-200/60 rounded-xl p-4 space-y-3 shadow-3xs max-w-2xl text-left border-l-4 border-l-amber-550">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                                      <SlidersHorizontal size={12} className="text-amber-550" />
                                      <span>Correction Audit History</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
                                      <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Original Quantity</p>
                                        <p className="font-mono font-bold text-slate-650 bg-slate-50 border border-slate-100 rounded-md px-2 py-1 inline-block">{e.originalQuantity} pcs</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Corrected Quantity</p>
                                        <p className="font-mono font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-md px-2 py-1 inline-block">{e.quantity} pcs</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Edited By</p>
                                        <p className="font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-md px-2 py-1 inline-block mt-0.5">{e.editedBy}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Edited At</p>
                                        <p className="font-mono text-slate-500 text-[11px] bg-slate-50 border border-slate-100 rounded-md px-2 py-1 inline-block mt-0.5 border-amber-100 bg-amber-50/20">
                                          {e.editedAt ? (
                                            e.editedAt.toDate ? e.editedAt.toDate().toLocaleString() : new Date(e.editedAt).toLocaleString()
                                          ) : 'Pending sync'}
                                        </p>
                                      </div>
                                    </div>
                                    {e.difference !== undefined && (
                                      <div className="text-xs pt-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider inline-block mr-1.5">Difference:</span>
                                        <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${e.difference >= 0 ? 'text-emerald-700 bg-emerald-50 border border-emerald-150' : 'text-rose-700 bg-rose-50 border border-rose-150'}`}>
                                          {e.difference >= 0 ? `+${e.difference}` : e.difference} pcs
                                        </span>
                                      </div>
                                    )}
                                    <div className="text-xs border-t border-slate-100 pt-2.5 mt-1">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Correction Reason:</span>
                                      <p className="text-slate-700 mt-1 whitespace-pre-wrap font-semibold italic bg-amber-50/30 p-2.5 rounded-lg border border-amber-100/50">"{e.editReason}"</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-450 px-1 font-mono">
              <span>Showing {filteredEntries.length} of {entries.length} records</span>
              <span>Sorted by Recency</span>
            </div>
          </div>
        </div>
      </div>

      {/* DOCK STOCK CORRECTION DIALOG */}
      <AnimatePresence>
        {editingEntry && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="edit-stock-modal">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl w-full max-w-md space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-100 animate-pulse">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Correct Stock Entry</h3>
                    <p className="text-xs text-slate-500 font-semibold">Production Stock Correction System</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingEntry(null)}
                  className="text-slate-450 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer outline-hidden"
                >
                  <Plus size={16} className="rotate-45" strokeWidth={2.5} id="close-edit-stock-btn" />
                </button>
              </div>

              {editFormError && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-705 rounded-xl text-xs font-semibold">
                  {editFormError}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                {/* Airbag Model - Read Only */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Airbag Model</label>
                  <input
                    type="text"
                    value={editModel}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 font-semibold cursor-not-allowed shadow-3xs"
                    disabled
                    readOnly
                  />
                </div>

                {/* Original Quantity - Read Only */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Original Quantity (pcs)</label>
                  <input
                    type="number"
                    value={editingEntry ? (editingEntry.originalQuantity !== undefined ? editingEntry.originalQuantity : editingEntry.quantity) : ''}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 font-mono cursor-not-allowed shadow-3xs"
                    disabled
                    readOnly
                  />
                </div>

                {/* New Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-550 tracking-wider uppercase">New Quantity (pcs)</label>
                  <input
                    type="number"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-amber-500 transition-colors shadow-3xs"
                    min="1"
                    required
                    placeholder="Enter corrected quantity"
                    id="new-quantity-input"
                  />
                </div>

                {/* Correction Reason */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-550 tracking-wider uppercase">Correction Reason (Required)</label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-amber-500 transition-colors shadow-3xs min-h-[80px] resize-none"
                    required
                    placeholder="Provide detailed context for history log (e.g. Typing mistake, machine recount)"
                    id="correction-reason-input"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingEntry(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    id="save-correction-btn"
                  >
                    Save Correction
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIRECT GENERAL STOCK CORRECTION DIALOG */}
      <AnimatePresence>
        {correctingGeneralModel && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="correct-general-stock-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl w-full max-w-md space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-100 animate-pulse">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Correct General Stock ({correctingGeneralModel})</h3>
                    <p className="text-xs text-slate-500 font-semibold">Direct Perpetual Inventory Correction</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCorrectingGeneralModel(null)}
                  className="text-slate-450 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer outline-hidden"
                >
                  <Plus size={16} className="rotate-45" strokeWidth={2.5} id="close-correct-general-btn" />
                </button>
              </div>

              {correctingGeneralError && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-705 rounded-xl text-xs font-semibold">
                  {correctingGeneralError}
                </div>
              )}

              <form onSubmit={handleGeneralStockCorrectionSubmit} className="space-y-4">
                {/* Current Stock calculated - Read Only */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Active Calculated Stock</label>
                  <input
                    type="text"
                    value={`${correctingGeneralCurrentStock} pcs`}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 font-bold cursor-not-allowed shadow-3xs"
                    disabled
                    readOnly
                  />
                </div>

                {/* Desired Stock Level input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-555 tracking-wider uppercase">Desired Stock Level (pcs)</label>
                  <input
                    type="number"
                    value={correctingGeneralDesiredStock}
                    onChange={(e) => setCorrectingGeneralDesiredStock(e.target.value)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-amber-500 transition-colors shadow-3xs"
                    required
                    placeholder="Enter final physical available quantity"
                    id="desired-general-qty-input"
                  />
                </div>

                {/* Real-time difference prediction */}
                {correctingGeneralDesiredStock && !isNaN(parseInt(correctingGeneralDesiredStock, 10)) && (
                  <div className="text-xs p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Adjustment Action:</span>
                    <span className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] ${
                      parseInt(correctingGeneralDesiredStock, 10) - correctingGeneralCurrentStock >= 0 
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-150' 
                        : 'text-rose-700 bg-rose-50 border border-rose-150'
                    }`}>
                      {parseInt(correctingGeneralDesiredStock, 10) - correctingGeneralCurrentStock >= 0 
                        ? `+${parseInt(correctingGeneralDesiredStock, 10) - correctingGeneralCurrentStock}` 
                        : parseInt(correctingGeneralDesiredStock, 10) - correctingGeneralCurrentStock} pcs
                    </span>
                    <span className="text-slate-500 ml-1.5 text-[11px] font-semibold">adjustment entry will be generated.</span>
                  </div>
                )}

                {/* Reason for correction text area */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-555 tracking-wider uppercase">Correction Reason (Required)</label>
                  <textarea
                    value={correctingGeneralReason}
                    onChange={(e) => setCorrectingGeneralReason(e.target.value)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-amber-500 transition-colors shadow-3xs min-h-[80px] resize-none"
                    required
                    placeholder="E.g., Warehouse physical count audit, correction of unregistered scrap"
                    id="general-correction-reason"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCorrectingGeneralModel(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    id="save-general-correction-btn"
                  >
                    Apply Adjustment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
