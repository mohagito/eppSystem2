import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, StockEntry, DeliveryEntry, AirbagModel } from '../types';
import { AIRBAG_MODELS, MOCK_PROFILES } from '../data';
import {
  PlusCircle,
  Truck,
  Calendar,
  User,
  Hash,
  Search,
  Filter,
  CheckCircle,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  TrendingDown,
  Inbox,
  AlertTriangle,
  History,
  Eye,
  Clock,
  X,
  Download,
  FileSpreadsheet
} from 'lucide-react';

interface DeliveryProps {
  currentUser: UserProfile;
  entries: StockEntry[];
  deliveries: DeliveryEntry[];
  profiles?: UserProfile[];
  onAddDelivery: (delivery: Omit<DeliveryEntry, 'id' | 'createdAt'>) => void;
  onDeleteDelivery?: (id: string) => void;
}

export default function DeliveryModule({
  currentUser,
  entries,
  deliveries,
  profiles = [],
  onAddDelivery,
  onDeleteDelivery
}: DeliveryProps) {
  const getLocalDateStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedModel, setSelectedModel] = useState<AirbagModel>('BCB');
  const [workerName, setWorkerName] = useState<string>(currentUser.name);
  const [deliveryDate, setDeliveryDate] = useState<string>(getLocalDateStr());
  const [quantity, setQuantity] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');

  React.useEffect(() => {
    if (currentUser) {
      setWorkerName(currentUser.name);
    }
  }, [currentUser]);

  // Search & Filters state
  const [filterModel, setFilterModel] = useState<string>('ALL');
  const [filterWorker, setFilterWorker] = useState<string>('ALL');
  const [filterInvoice, setFilterInvoice] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>(''); // YYYY-MM-DD
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [formWarning, setFormWarning] = useState<string>('');

  // Selection state for opening traceability report modal
  const [selectedDetails, setSelectedDetails] = useState<DeliveryEntry | null>(null);

  // 1. Calculate dynamic current available stock (Production minus Deliveries)
  const availableStock = useMemo(() => {
    const stock = {} as Record<AirbagModel, number>;
    AIRBAG_MODELS.forEach((m) => {
      stock[m] = 0;
    });

    // Add produced assemblies
    entries.forEach((e) => {
      if (stock[e.modelId] !== undefined) {
        stock[e.modelId] += e.quantity;
      }
    });

    // Subtract processed deliveries
    deliveries.forEach((d) => {
      if (stock[d.modelId] !== undefined) {
        stock[d.modelId] -= d.quantity;
      }
    });

    return stock;
  }, [entries, deliveries]);

  // Handle warnings when typing quantity
  const currentAvailableForSelectedModel = availableStock[selectedModel] || 0;

  const handleQtyChange = (val: string) => {
    setQuantity(val);
    setFormError('');
    setFormWarning('');

    const parsedQty = parseInt(val, 10);
    if (parsedQty > currentAvailableForSelectedModel) {
      setFormWarning(`Requested delivery (${parsedQty} pcs) exceeds the current available stock (${currentAvailableForSelectedModel} pcs). The stockpile level will go negative.`);
    }
  };

  const handleModelChange = (model: AirbagModel) => {
    setSelectedModel(model);
    setFormError('');
    setFormWarning('');
    
    // Evaluate if current quantity is already too high
    const parsedQty = parseInt(quantity, 10);
    const available = availableStock[model] || 0;
    if (parsedQty && parsedQty > available) {
      setFormWarning(`Requested delivery (${parsedQty} pcs) exceeds the current available stock (${available} pcs). The stockpile level will go negative.`);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormWarning('');

    if (!invoiceNumber.trim()) {
      setFormError('Please enter a valid Invoice Number.');
      return;
    }

    const parsedQty = parseInt(quantity, 10);
    if (!parsedQty || parsedQty <= 0) {
      setFormError('Please enter a valid quantity greater than zero.');
      return;
    }

    const finalWorkerName = currentUser.role === 'manager' ? workerName.trim() : currentUser.name;
    if (!finalWorkerName) {
      setFormError('Dispatcher / Worker Name is required.');
      return;
    }

    // Automatically generate exact Date & Time on save
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    onAddDelivery({
      modelId: selectedModel,
      model: selectedModel,
      workerName: finalWorkerName,
      loadedBy: finalWorkerName,
      date: deliveryDate || getLocalDateStr(), // YYYY-MM-DD
      deliveryDate: `${dd}/${mm}/${yyyy}`, // DD/MM/YYYY e.g., 11/06/2026
      deliveryTime: `${hh}:${min}`, // e.g., 14:37
      quantity: parsedQty,
      invoiceNumber: invoiceNumber.trim().toUpperCase(),
      createdBy: currentUser.name || currentUser.id // Gonzalo
    });

    setQuantity('');
    setInvoiceNumber('');
  };

  // Aggregate operators/dispatchers for filter dropdown
  const uniqueDispatchers = useMemo(() => {
    const workers = new Set<string>();
    deliveries.forEach((d) => {
      const name = d.loadedBy || d.workerName;
      if (name) workers.add(name);
    });
    return Array.from(workers);
  }, [deliveries]);

  // Filter list of deliveries
  const filteredDeliveries = useMemo(() => {
    return [...deliveries]
      .sort((a, b) => {
        const timeA = a.createdAt || '';
        const timeB = b.createdAt || '';
        return timeB.localeCompare(timeA);
      })
      .filter((d) => {
        const matchModel = filterModel === 'ALL' || d.modelId === filterModel || d.model === filterModel;
        const matchWorker = filterWorker === 'ALL' || d.workerName === filterWorker || d.loadedBy === filterWorker;
        const matchInvoice = filterInvoice === '' || (d.invoiceNumber && d.invoiceNumber.toLowerCase().includes(filterInvoice.toLowerCase()));
        const matchDate = filterDate === '' || d.date === filterDate;
        
        const matchSearch = filterSearch === '' || 
          d.workerName.toLowerCase().includes(filterSearch.toLowerCase()) || 
          (d.loadedBy && d.loadedBy.toLowerCase().includes(filterSearch.toLowerCase())) ||
          d.modelId.toLowerCase().includes(filterSearch.toLowerCase()) ||
          (d.invoiceNumber && d.invoiceNumber.toLowerCase().includes(filterSearch.toLowerCase())) ||
          (d.createdBy && d.createdBy.toLowerCase().includes(filterSearch.toLowerCase()));
          
        return matchModel && matchWorker && matchInvoice && matchDate && matchSearch;
      });
  }, [deliveries, filterModel, filterWorker, filterInvoice, filterDate, filterSearch]);

  const totalDeliveredSum = useMemo(() => {
    return deliveries.reduce((s, d) => s + d.quantity, 0);
  }, [deliveries]);

  const netStockSum = useMemo(() => {
    return AIRBAG_MODELS.reduce((sum, model) => sum + (availableStock[model] || 0), 0);
  }, [availableStock]);

  const handleDownloadCSV = () => {
    // 1. Define CSV headers
    const headers = [
      'Invoice Number',
      'Model',
      'Quantity',
      'Dispatch Date',
      'Dispatch Time',
      'Delivered By',
      'Created By',
      'System ID',
      'Firestore Timestamp'
    ];

    // 2. Map filteredDeliveries data
    const rows = filteredDeliveries.map((d) => [
      d.invoiceNumber || 'N/A',
      d.model || d.modelId,
      d.quantity,
      d.deliveryDate || (d.date ? new Date(d.date).toLocaleDateString('en-GB') : 'N/A'),
      d.deliveryTime || '00:00',
      d.loadedBy || d.workerName || 'N/A',
      d.createdBy || 'N/A',
      d.id,
      d.createdAt ? String(d.createdAt) : 'N/A'
    ]);

    // 3. Assemble CSV string using CSV escaping guidelines
    const escapeCSVCell = (val: any) => {
      const stringified = String(val === null || val === undefined ? '' : val);
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n') || stringified.includes('\r')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    const csvContent = [
      headers.map(escapeCSVCell).join(','),
      ...rows.map(row => row.map(escapeCSVCell).join(','))
    ].join('\n');

    // 4. Create Blob and Trigger Download with UTF-8 BOM for Excel compatibility
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const dateSuffix = getLocalDateStr();
    link.setAttribute('download', `delivery_list_${dateSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = () => {
    const totalFilteredSum = filteredDeliveries.reduce((sum, d) => sum + d.quantity, 0);
    const dateFormatted = new Date().toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const excelRows = filteredDeliveries.map((d, index) => {
      const isEven = index % 2 === 0;
      const bgStyle = isEven ? 'class="row-even"' : 'class="row-odd"';
      const safeInvoice = d.invoiceNumber || 'N/A';
      const safeModel = d.model || d.modelId;
      const safeQty = d.quantity;
      const safeDate = d.deliveryDate || (d.date ? new Date(d.date).toLocaleDateString('en-GB') : 'N/A');
      const safeTime = d.deliveryTime || '00:00';
      const safeWorker = d.loadedBy || d.workerName || 'N/A';
      const safeCreator = d.createdBy || 'N/A';
      const safeId = d.id;
      const safeCreatedAt = d.createdAt ? String(new Date(d.createdAt).toLocaleString('es-ES')) : 'N/A';

      return `
        <tr ${bgStyle}>
          <td class="invoice-badge" style="padding: 8px 12px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold;">${safeInvoice}</td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">${safeModel}</td>
          <td class="text-right number-col" style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #0f766e;">${safeQty} pcs</td>
          <td class="text-center" style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: center;">${safeDate}</td>
          <td class="text-center" style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: center;">${safeTime}</td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">${safeWorker}</td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">${safeCreator}</td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 10px; color: #64748b;">${safeId}</td>
          <td class="text-center" style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px; color: #64748b;">${safeCreatedAt}</td>
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
                <x:Name>EPP Dispatch Ledger</x:Name>
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
            color: #0f766e;
          }
          .report-subtitle {
            font-size: 11px;
            color: #0d9488;
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
            background-color: #0f766e;
            color: #ffffff;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 1px solid #0d9488;
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
          .number-col {
            font-weight: bold;
            color: #0f766e;
          }
          .total-row td {
            background-color: #ccfbf1;
            font-weight: bold;
            border-top: 2px solid #0f766e;
            border-bottom: 2px solid #0f766e;
            color: #0f766e;
            font-size: 12px;
          }
          .invoice-badge {
            font-family: monospace;
            font-weight: bold;
            color: #334155;
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
            <td colspan="7" class="company-title" style="padding-left:15px; border-bottom: none; border-left: none; font-size: 18px; font-weight: bold; color: #0f766e;">
              EPP NATUR AUTOMOTIVE S.L.
            </td>
          </tr>
          <tr>
            <td colspan="7" class="report-subtitle" style="padding-left:15px; border-top: none; border-bottom: none; border-left: none; font-size: 11px; color: #0d9488; font-weight: bold; letter-spacing: 0.5px;">
              ACTIVE DISPATCH LEDGER & DELIVERY OVERVIEW
            </td>
          </tr>
          <tr>
            <td colspan="7" style="padding-left:15px; font-size: 10px; color: #64748b; font-style: italic; border-top: none; border-left: none;">
              Generated: ${dateFormatted} • System: Digital Hub Ledger
            </td>
          </tr>
          
          <!-- Spacing Row -->
          <tr style="height: 12px;"><td colspan="9" style="border:none;"></td></tr>

          <!-- Metadata Properties -->
          <tr>
            <td colspan="2" class="meta-label" style="font-size: 10px; color: #475569; font-weight: bold; background-color: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1;">Ledger Scope:</td>
            <td colspan="2" class="meta-val" style="font-size: 10px; color: #1e293b; padding: 8px 12px; border: 1px solid #cbd5e1;">Filtered Dispatch Output</td>
            <td colspan="2" class="meta-label" style="font-size: 10px; color: #475569; font-weight: bold; background-color: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1;">Filter Settings:</td>
            <td colspan="3" class="meta-val" style="font-size: 10px; color: #1e293b; padding: 8px 12px; border: 1px solid #cbd5e1;">
              Model: <span style="font-weight: bold;">${filterModel}</span> | 
              Dispatched: <span style="font-weight: bold;">${filterWorker}</span> | 
              Invoice: <span style="font-weight: bold;">${filterInvoice || 'ALL'}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="meta-label" style="font-size: 10px; color: #475569; font-weight: bold; background-color: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1;">Total Records:</td>
            <td colspan="2" class="meta-val" style="font-size: 10px; color: #1e293b; font-weight: bold; color: #0f766e; padding: 8px 12px; border: 1px solid #cbd5e1;">${filteredDeliveries.length} entries</td>
            <td colspan="2" class="meta-label" style="font-size: 10px; color: #475569; font-weight: bold; background-color: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1;">Total Volume Out:</td>
            <td colspan="3" class="meta-val" style="font-size: 10px; color: #1e293b; font-weight: bold; color: #0d9488; padding: 8px 12px; border: 1px solid #cbd5e1;">${totalFilteredSum} pcs</td>
          </tr>

          <!-- Spacing Row -->
          <tr style="height: 15px;"><td colspan="9" style="border:none;"></td></tr>

          <!-- Data Headers -->
          <thead>
            <tr>
              <th style="width: 130px; text-align: left; background-color: #0f766e; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #0d9488;">Invoice Number</th>
              <th style="width: 100px; text-align: left; background-color: #0f766e; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #0d9488;">Model ID</th>
              <th style="width: 100px; text-align: right; background-color: #0f766e; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #0d9488;">Quantity</th>
              <th style="width: 120px; text-align: center; background-color: #0f766e; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #0d9488;">Dispatch Date</th>
              <th style="width: 90px; text-align: center; background-color: #0f766e; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #0d9488;">Time</th>
              <th style="width: 140px; text-align: left; background-color: #0f766e; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #0d9488;">Dispatched By</th>
              <th style="width: 140px; text-align: left; background-color: #0f766e; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #0d9488;">Created By</th>
              <th style="width: 180px; text-align: left; background-color: #0f766e; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #0d9488;">System Ledger ID</th>
              <th style="width: 150px; text-align: center; background-color: #0f766e; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #0d9488;">System Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${excelRows}
            
            <!-- Spacing Row -->
            <tr style="height: 8px;"><td colspan="9" style="border:none;"></td></tr>

            <!-- Grand Total Summary Row -->
            <tr class="total-row">
              <td colspan="2" style="font-weight: bold; text-align: left; background-color: #ccfbf1; border-top: 2px solid #0f766e; border-bottom: 2px solid #0f766e; padding: 8px 12px;">GRAND TOTAL DISPATCHED</td>
              <td class="text-right" style="font-weight: bold; color: #0f766e; background-color: #ccfbf1; border-top: 2px solid #0f766e; border-bottom: 2px solid #0f766e; padding: 8px 12px; text-align: right;">${totalFilteredSum} pcs</td>
              <td colspan="6" style="border-left: none; background-color: #ccfbf1; border-top: 2px solid #0f766e; border-bottom: 2px solid #0f766e; padding: 8px 12px;"></td>
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
    
    const dateSuffix = getLocalDateStr();
    link.setAttribute('download', `epp_delivery_ledger_${dateSuffix}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8" id="delivery-module-view">
      {/* Dynamic Stock Levels vs Deliveries */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-500 font-sans">Active Stock Available After Deliveries</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full font-mono font-bold shadow-3xs flex items-center gap-1">
              <Truck size={12} />
              {totalDeliveredSum} Logged Dispatches
            </span>
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full font-mono font-bold shadow-3xs">
              {netStockSum} Pcs Net Stock Remaining
            </span>
          </div>
        </div>

        {/* Bento Board of Models */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" id="delivery-model-aggregate-cards">
          {AIRBAG_MODELS.map((model) => {
            const stockVal = availableStock[model];
            const isNegative = stockVal < 0;
            const hasGoodStock = stockVal > 100;
            const hasCriticalStock = stockVal <= 10 && stockVal >= 0;

            let badgeColor = 'bg-slate-50 border-slate-150 text-slate-800';
            let textColor = 'text-slate-900';
            
            if (isNegative) {
              badgeColor = 'bg-rose-50 border-rose-100 text-rose-700 animate-pulse';
              textColor = 'text-rose-700';
            } else if (hasGoodStock) {
              badgeColor = 'bg-emerald-50/50 border-emerald-100 text-emerald-800';
              textColor = 'text-emerald-900';
            } else if (hasCriticalStock) {
              badgeColor = 'bg-amber-50 border-amber-100 text-amber-800';
              textColor = 'text-amber-800';
            }

            return (
              <motion.div
                key={model}
                whileHover={{ y: -3, scale: 1.01 }}
                className={`p-4 rounded-xl border transition-all duration-300 bg-white shadow-3xs ${badgeColor}`}
                id={`delivery-model-card-${model.replace(' ', '-')}`}
              >
                <div className="text-2s font-mono text-slate-450 tracking-wider font-extrabold uppercase">{model}</div>
                <div className="mt-2 flex items-baseline justify-between select-none">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-extrabold font-mono ${textColor}`}>
                      {stockVal}
                    </span>
                    <span className="text-[10px] text-slate-450 font-bold">pcs</span>
                  </div>
                </div>
                
                <div className="text-[9px] font-bold text-slate-400 mt-1 font-mono">
                  {isNegative ? 'Negative Backlog' : hasCriticalStock ? 'Restock Advised' : 'Sufficient'} / Net Stock
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ADD DELIVERY REQUISITION FORM */}
        <div className="lg:col-span-1" id="add-delivery-form-container">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs sticky top-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Truck size={22} className="rotate-y-180" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Ship Delivery</h3>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4" id="add-delivery-form">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-705 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              {formWarning && (
                <div className="p-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-xs font-bold flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>{formWarning}</span>
                </div>
              )}

              {/* Invoice Number field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                  <Hash size={13} className="text-amber-555" />
                  Invoice Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. M1453"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono font-bold uppercase focus:outline-hidden focus:bg-white focus:border-amber-500 transition-colors shadow-3xs"
                  required
                  id="delivery-form-invoice-number"
                />
              </div>

              {/* Model selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                  <Inbox size={13} className="text-amber-555" />
                  Selected Airbag Model
                </label>
                <div className="relative">
                  <select
                     value={selectedModel}
                     onChange={(e) => handleModelChange(e.target.value as AirbagModel)}
                     className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-amber-500 transition-all appearance-none cursor-pointer shadow-3xs"
                     id="delivery-form-model"
                  >
                    {AIRBAG_MODELS.map((model) => (
                      <option key={model} value={model} className="bg-white text-slate-800">
                        {model} ({availableStock[model]} available)
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
                    <User size={13} className="text-amber-555" />
                    Delivery Dispatched By
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-605 font-semibold shadow-3xs font-sans">
                    {workerName}
                    <span className="text-[10px] text-amber-600 font-bold font-mono ml-2">(Auto-filled)</span>
                  </div>
                </div>
              )}

              {currentUser.role === 'manager' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                    <User size={13} className="text-amber-555" />
                    Delivery Personnel / Operator
                  </label>
                  <div className="relative">
                    <select
                      value={workerName}
                      onChange={(e) => setWorkerName(e.target.value)}
                      className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-amber-500 transition-all appearance-none cursor-pointer shadow-3xs"
                      id="delivery-form-worker-select"
                    >
                      {(profiles && profiles.length > 0 ? profiles : MOCK_PROFILES).map((profile) => (
                        <option key={profile.id} value={profile.name}>
                          {profile.name} ({profile.role})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber-555" />
                  Dispatch Date
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-amber-500 transition-colors shadow-3xs"
                  id="delivery-form-date"
                />
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase flex items-center gap-1.5">
                  <Hash size={13} className="text-amber-555" />
                  Delivered Quantity (pcs)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 100"
                  value={quantity}
                  onChange={(e) => handleQtyChange(e.target.value)}
                  className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-amber-500 transition-colors shadow-3xs"
                  min="1"
                  required
                  id="delivery-form-quantity"
                />
              </div>

              <div className="pt-2 text-[11px] text-slate-550 font-medium">
                Available in Stock: <span className="font-mono font-extrabold text-slate-800">{currentAvailableForSelectedModel} pcs</span>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                id="submit-delivery-entry"
              >
                <CheckCircle size={15} />
                Register Outgoing Delivery
              </button>
            </form>
          </div>
        </div>

        {/* DISPATCH HISTORY LOGS */}
        <div className="lg:col-span-2" id="delivery-history-container">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <History className="text-amber-600" size={18} />
                  Delivery Ledger Logs
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
                {currentUser.role === 'manager' && (
                  <>
                    <button
                      onClick={handleDownloadExcel}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 bg-emerald-600 hover:bg-emerald-750 text-white transition-all cursor-pointer shadow-3xs border border-emerald-500"
                      id="download-delivery-excel-btn"
                      title="Export professionally styled EPP Natur company Excel report with logo"
                    >
                      <FileSpreadsheet size={14} />
                      <span>Export Excel Report</span>
                    </button>
                    <button
                      onClick={handleDownloadCSV}
                      className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-705 border border-slate-205 transition-all cursor-pointer shadow-3xs"
                      id="download-delivery-csv-btn"
                      title="Download raw data in CSV format"
                    >
                      <Download size={14} />
                      <span>Download CSV</span>
                    </button>
                  </>
                )}

                {/* Filters Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border cursor-pointer shadow-3xs ${
                    showFilters || filterModel !== 'ALL' || filterWorker !== 'ALL' || filterInvoice || filterDate || filterSearch
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  id="toggle-delivery-filters"
                >
                  <SlidersHorizontal size={14} />
                  <span>Filters {showFilters ? 'Hide' : 'Show'}</span>
                  {(filterModel !== 'ALL' || filterWorker !== 'ALL' || filterInvoice || filterDate || filterSearch) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-550"></span>
                  )}
                </button>
              </div>
            </div>

            {/* Slide drawer for filters */}
            <AnimatePresence>
              {(showFilters || filterModel !== 'ALL' || filterWorker !== 'ALL' || filterInvoice || filterDate || filterSearch) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4"
                  id="expanded-delivery-filter-drawer"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    {/* Invoice filter */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Filter by Invoice</label>
                      <input
                        type="text"
                        placeholder="e.g. M1453"
                        value={filterInvoice}
                        onChange={(e) => setFilterInvoice(e.target.value.toUpperCase())}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 placeholder-slate-400 font-medium font-mono uppercase focus:outline-hidden"
                        id="delivery-filter-invoice-input"
                      />
                    </div>

                    {/* Model filter */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Filter by Model</label>
                      <select
                        value={filterModel}
                        onChange={(e) => setFilterModel(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 font-medium focus:outline-hidden"
                        id="delivery-filter-model-select"
                      >
                        <option value="ALL">All Models</option>
                        {AIRBAG_MODELS.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dispatcher filter */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Filter by Dispatcher</label>
                      <select
                        value={filterWorker}
                        onChange={(e) => setFilterWorker(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 font-medium focus:outline-hidden"
                        id="delivery-filter-worker-select"
                      >
                        <option value="ALL">All Dispatchers</option>
                        {uniqueDispatchers.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date filter */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Filter by Date</label>
                      <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden"
                        id="delivery-filter-date-input"
                      />
                    </div>

                    {/* Search Field */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Search Text</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search text..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 focus:outline-hidden placeholder-slate-400 font-medium"
                          id="delivery-filter-search-input"
                        />
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      </div>
                    </div>
                  </div>

                  {/* Reset */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => {
                        setFilterModel('ALL');
                        setFilterWorker('ALL');
                        setFilterInvoice('');
                        setFilterDate('');
                        setFilterSearch('');
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-800 hover:underline cursor-pointer font-medium"
                      id="reset-delivery-filters"
                    >
                      Clear all active filters
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* LEDGER DATA TABLE */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs" id="delivery-table-container">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase">Invoice</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase">Model</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase">Qty</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase hidden sm:table-cell">Date & Time</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase hidden sm:table-cell">Delivered By</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase text-center w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {filteredDeliveries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-xs text-slate-550">
                            No shipments/deliveries registered in the ledger.
                          </td>
                        </tr>
                      ) : (
                        filteredDeliveries.map((d) => (
                          <motion.tr
                            key={d.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors bg-white cursor-pointer"
                            id={`delivery-row-${d.id}`}
                            onClick={() => setSelectedDetails(d)}
                          >
                            <td className="p-4">
                              <span className="text-xs font-bold font-mono bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg text-slate-850">
                                {d.invoiceNumber || 'N/A'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-xs font-bold text-amber-805 font-mono tracking-wide bg-amber-50/50 border border-amber-100 px-2.5 py-1 rounded-lg">
                                {d.model || d.modelId}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-extrabold font-mono text-amber-700 select-all">
                              -{d.quantity} pcs
                            </td>
                            <td className="p-4 text-xs font-mono text-slate-650 hidden sm:table-cell">
                              {d.deliveryDate || new Date(d.date).toLocaleDateString('en-GB')} {d.deliveryTime || '00:00'}
                            </td>
                            <td className="p-4 hidden sm:table-cell">
                              <span className="text-xs font-bold text-slate-800">
                                {d.loadedBy || d.workerName}
                              </span>
                            </td>
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedDetails(d)}
                                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-lg transition-all cursor-pointer"
                                  title="View audit details"
                                  id={`view-delivery-${d.id}`}
                                >
                                  <Eye size={13.5} />
                                </button>
                                {currentUser.role === 'manager' && (
                                  <button
                                    onClick={() => onDeleteDelivery?.(d.id)}
                                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer"
                                    title="Revoke / Delete dispatch"
                                    id={`delete-delivery-${d.id}`}
                                  >
                                    <Trash2 size={13.5} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-450 px-1 font-mono">
              <span>Showing {filteredDeliveries.length} of {deliveries.length} delivery records</span>
              <span>Sorted by Dispatch Recency</span>
            </div>
          </div>
        </div>
      </div>

      {/* DELIVERY DETAILS AUDIT & TRACEABILITY MODAL */}
      <AnimatePresence>
        {selectedDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 shadow-3xl" id="delivery-details-modal-overlay">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetails(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            
            {/* Content Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="bg-white rounded-2xl border border-slate-150 shadow-2xl w-full max-w-md overflow-hidden relative z-10"
              id="delivery-details-modal"
            >
              {/* Card Header with design identity */}
              <div className="bg-slate-900 text-white p-6 relative">
                {/* Close Button */}
                <button
                  onClick={() => setSelectedDetails(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
                  id="close-details-modal"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                    <Truck size={22} className="rotate-y-180" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold leading-none text-slate-100">Traceability Report</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-1.5 uppercase tracking-wider">
                      Audit Verification Code: {selectedDetails.id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Badge Line */}
              <div className="px-6 py-2 bg-amber-50/50 border-b border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold font-mono text-[10px] uppercase tracking-wider">Dispatch Status</span>
                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono">
                  Shipped & Adjusted
                </span>
              </div>

              {/* Detailed fields */}
              <div className="p-6 space-y-4 font-sans text-xs">
                
                {/* 1. Invoice */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-medium font-bold">
                    <Hash size={14} className="text-slate-400 font-bold" />
                    <span>Invoice Number</span>
                  </div>
                  <span className="font-mono font-black text-slate-900 text-sm bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                    {selectedDetails.invoiceNumber || 'N/A'}
                  </span>
                </div>

                {/* 2. Model */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <Inbox size={14} className="text-slate-400" />
                    <span>Model</span>
                  </div>
                  <span className="font-mono font-extrabold text-amber-850 bg-amber-50 border border-amber-100 px-3 py-1 rounded-lg">
                    {selectedDetails.model || selectedDetails.modelId}
                  </span>
                </div>

                {/* 3. Quantity */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <TrendingDown size={14} className="text-slate-400" />
                    <span>Quantity</span>
                  </div>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {selectedDetails.quantity} pcs
                  </span>
                </div>

                {/* 4. Loaded By */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-medium font-bold">
                    <User size={14} className="text-slate-400 font-bold" />
                    <span>Loaded By</span>
                  </div>
                  <span className="font-bold text-slate-800">
                    {selectedDetails.loadedBy || selectedDetails.workerName}
                  </span>
                </div>

                {/* 5. Created By */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <User size={14} className="text-slate-400 font-bold" />
                    <span>Created By</span>
                  </div>
                  <span className="font-semibold text-slate-800">
                    {selectedDetails.createdBy || 'System'}
                  </span>
                </div>

                {/* 6. Date */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-medium font-bold">
                    <Calendar size={14} className="text-slate-400 font-bold" />
                    <span>Date</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDetails.deliveryDate || new Date(selectedDetails.date).toLocaleDateString('en-GB')}
                  </span>
                </div>

                {/* 7. Time */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <Clock size={14} className="text-slate-400 font-bold" />
                    <span>Time</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDetails.deliveryTime || '00:00'}
                  </span>
                </div>

                {/* 8. Raw Timestamp */}
                <div className="bg-slate-50/50 p-2.5 rounded-xl border border-dashed border-slate-200 text-[10px] text-slate-450 space-y-1">
                  <div className="font-semibold text-slate-500 uppercase tracking-wider font-mono text-[8px]">
                    Firestore Traceability Timestamp
                  </div>
                  <div className="font-mono break-all leading-normal select-all text-slate-500">
                    {selectedDetails.createdAt ? String(selectedDetails.createdAt) : 'Awaiting sync...'}
                  </div>
                </div>

              </div>
              
              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedDetails(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                  id="close-details-modal-btn"
                >
                  Acknowledge & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
