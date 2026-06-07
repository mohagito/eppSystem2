import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, StockEntry, AirbagModel, ProductionPlan } from '../types';
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
  ChevronDown
} from 'lucide-react';

interface StockProps {
  currentUser: UserProfile;
  entries: StockEntry[];
  plans?: ProductionPlan[];
  onAddEntry: (entry: Omit<StockEntry, 'id' | 'createdAt'>) => void;
  onDeleteEntry?: (id: string) => void;
}

export default function StockManagement({ currentUser, entries, plans = [], onAddEntry, onDeleteEntry }: StockProps) {
  // Input fields state
  const getLocalDateStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedModel, setSelectedModel] = useState<AirbagModel>('BCB');
  const [workerName, setWorkerName] = useState<string>(
    currentUser.role === 'worker' ? currentUser.name : MOCK_PROFILES[1].name
  );
  const [entryDate, setEntryDate] = useState<string>(getLocalDateStr());
  const [quantity, setQuantity] = useState<string>('');
  
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

    if (!workerName.trim()) {
      setFormError('Worker name is required.');
      return;
    }

    onAddEntry({
      modelId: selectedModel,
      workerName: workerName.trim(),
      date: entryDate || getLocalDateStr(),
      quantity: parsedQty,
      createdBy: currentUser.id,
    });

    // Reset quantity only
    setQuantity('');
  };

  // Pre-calculate per-model sums for stats cards
  const stockSums = useMemo(() => {
    const sums: Record<AirbagModel, number> = {
      'BCB': 0,
      'CRAFTER': 0,
      'CADDY': 0,
      'KUGA LHD': 0,
      'KUGA RHD': 0,
      'TETOUAN': 0
    };

    entries.forEach((e) => {
      if (sums[e.modelId] !== undefined) {
        sums[e.modelId] += e.quantity;
      }
    });

    return sums;
  }, [entries]);

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
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-500 font-sans">Total Stock Per Model</h3>
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full font-mono font-bold shadow-3xs">
            {entries.reduce((sum, e) => sum + e.quantity, 0)} Total Stockpile Units
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {AIRBAG_MODELS.map((model) => {
            const hasStock = stockSums[model] > 0;
            // Sum up the planned quantities for this model from the production schedules
            const planned = plans
              .filter((p) => p.model === model)
              .reduce((sum, p) => sum + p.quantityPlanned, 0);
            const hasGoal = planned > 0;
            
            // Calculate percentage based on target goal if it exists, otherwise fall back to 1000 pcs
            const percentage = hasGoal 
              ? Math.min((stockSums[model] / planned) * 100, 100) 
              : Math.min((stockSums[model] / 1000) * 100, 100);
            
            const isCompleted = hasGoal && stockSums[model] >= planned;

            return (
              <motion.div
                key={model}
                whileHover={{ y: -3, scale: 1.02 }}
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  hasStock 
                    ? 'bg-white border-slate-200 shadow-3xs' 
                    : 'bg-slate-50/50 border-slate-100 opacity-60'
                }`}
                id={`stat-card-${model.replace(' ', '-')}`}
              >
                <div className="text-2s font-mono text-slate-450 tracking-wider font-extrabold uppercase">{model}</div>
                <div className="mt-2 flex items-baseline justify-between select-none">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono text-slate-900">
                      {stockSums[model]}
                    </span>
                    <span className="text-[10px] text-slate-450 font-bold">pcs</span>
                  </div>
                  {hasGoal && (
                    <span className={`text-[9.5px] font-bold font-mono px-2 py-0.5 rounded-lg border ${
                      isCompleted 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border-rose-150 animate-pulse'
                    }`}>
                      Goal: {planned}
                    </span>
                  )}
                </div>
                
                {/* Progress bar container */}
                <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCompleted 
                        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]' 
                        : hasGoal 
                          ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.3)]' 
                          : 'bg-emerald-400'
                    }`} 
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {hasGoal && (
                  <div className="mt-1.5 flex items-center justify-between text-[9px] font-semibold text-slate-400">
                    <span>
                      {isCompleted ? '100% completed' : `${Math.round(percentage)}% of shift goal`}
                    </span>
                    {isCompleted ? (
                      <span className="text-emerald-600 font-bold">Done ✓</span>
                    ) : (
                      <span className="text-rose-600 font-extrabold font-mono flex items-center gap-1 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-550 animate-ping shrink-0" />
                        {planned - stockSums[model]} pcs left
                      </span>
                    )}
                  </div>
                )}
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
                                <button
                                  onClick={() => onDeleteEntry?.(e.id)}
                                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer"
                                  title="Delete stock entry"
                                  id={`delete-entry-${e.id}`}
                                >
                                  <Trash2 size={13.5} />
                                </button>
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
    </div>
  );
}
