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
  Plus
} from 'lucide-react';

interface StockProps {
  currentUser: UserProfile;
  entries: StockEntry[];
  deliveries?: DeliveryEntry[];
  plans?: ProductionPlan[];
  onAddEntry: (entry: Omit<StockEntry, 'id' | 'createdAt'>) => void;
  onDeleteEntry?: (id: string) => void;
  onEditEntry?: (id: string, updatedEntry: Partial<Omit<StockEntry, 'id' | 'createdAt'>>) => void;
}

export default function StockManagement({
  currentUser,
  entries,
  deliveries = [],
  plans = [],
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
  
  // Edit Stock Entry Modal state
  const [editingEntry, setEditingEntry] = useState<StockEntry | null>(null);
  const [editModel, setEditModel] = useState<AirbagModel>('BCB');
  const [editDate, setEditDate] = useState<string>('');
  const [editQty, setEditQty] = useState<string>('');
  const [editFormError, setEditFormError] = useState<string>('');

  const handleStartEdit = (entry: StockEntry) => {
    setEditingEntry(entry);
    setEditModel(entry.modelId);
    setEditDate(entry.date);
    setEditQty(entry.quantity.toString());
    setEditFormError('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');

    const parsedQty = parseInt(editQty, 10);
    if (!parsedQty || parsedQty <= 0) {
      setEditFormError('Please enter a valid quantity greater than zero.');
      return;
    }

    if (!editDate) {
      setEditFormError('Assembly date is required.');
      return;
    }

    if (editingEntry && onEditEntry) {
      onEditEntry(editingEntry.id, {
        modelId: editModel,
        date: editDate,
        quantity: parsedQty,
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
    const finalWorkerName = currentUser.role === 'manager' ? currentUser.name : workerName.trim();

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
    });

    // Reset quantity only
    setQuantity('');
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
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  isNegative
                    ? 'bg-rose-50/50 border-rose-200 text-rose-700 shadow-3xs'
                    : hasStock 
                      ? 'bg-white border-slate-200 shadow-3xs' 
                      : 'bg-slate-50/50 border-slate-100 opacity-60'
                }`}
                id={`stat-card-${model.replace(' ', '-')}`}
              >
                <div className="text-2s font-mono text-slate-450 tracking-wider font-extrabold uppercase">{model}</div>
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
                <p className="text-xs text-slate-500 font-medium">Register manufactured airbag units</p>
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
                        {MOCK_PROFILES.filter((p) => p.role === 'worker').map((profile) => (
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
                <p className="text-xs text-slate-550 font-medium mt-1">Audit log of registered manufactured parts</p>
              </div>

              {/* Expand Search / Filter toggle button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`self-start md:self-auto px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border cursor-pointer shadow-3xs ${
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
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase">Assembled By</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase">Date</th>
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
                              <span className="text-xs font-bold text-slate-800 font-mono tracking-wide bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                                {e.modelId}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-xs font-bold text-slate-800">
                                {e.workerName}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-mono text-slate-500 uppercase">
                              {new Date(e.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: '2-digit',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="p-4 text-xs font-extrabold text-right font-mono text-emerald-600 select-all">
                              {e.quantity} pcs
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

      {/* EDIT STOCK ENTRY DIALOG */}
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
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
                    <Pencil size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Edit Stock Entry</h3>
                    <p className="text-xs text-slate-500 font-semibold">Modify registered stock parameters</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingEntry(null)}
                  className="text-slate-450 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
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
                {/* Model dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Airbag Model</label>
                  <div className="relative">
                    <select
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value as AirbagModel)}
                      className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                    >
                      {AIRBAG_MODELS.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Date select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Assembly Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all shadow-3xs"
                    required
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Manufactured Quantity (pcs)</label>
                  <input
                    type="number"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-colors shadow-3xs"
                    min="1"
                    required
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
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    id="save-edited-stock-btn"
                  >
                    Save Changes
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
