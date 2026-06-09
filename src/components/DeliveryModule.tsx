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
  History
} from 'lucide-react';

interface DeliveryProps {
  currentUser: UserProfile;
  entries: StockEntry[];
  deliveries: DeliveryEntry[];
  onAddDelivery: (delivery: Omit<DeliveryEntry, 'id' | 'createdAt'>) => void;
  onDeleteDelivery?: (id: string) => void;
}

export default function DeliveryModule({
  currentUser,
  entries,
  deliveries,
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

  // Search & Filters state
  const [filterModel, setFilterModel] = useState<string>('ALL');
  const [filterWorker, setFilterWorker] = useState<string>('ALL');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [formWarning, setFormWarning] = useState<string>('');

  // 1. Calculate dynamic current available stock (Production minus Deliveries)
  const availableStock = useMemo(() => {
    const stock: Record<AirbagModel, number> = {
      'BCB': 0,
      'CRAFTER': 0,
      'CADDY': 0,
      'KUGA LHD': 0,
      'KUGA RHD': 0,
      'TETOUAN': 0
    };

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

    const parsedQty = parseInt(quantity, 10);
    if (!parsedQty || parsedQty <= 0) {
      setFormError('Please enter a valid quantity greater than zero.');
      return;
    }

    const available = availableStock[selectedModel] || 0;
    if (parsedQty > available) {
      // Allow delivery but let's confirm in visual indicator, or we can warn.
      // Let's allow but keep warnings prominent or block if they must. 
      // User says "when we deliver something it should be remove automatically from the stock"
      // If we represent a flexible dispatch system, sometimes negative stock happens (e.g., retro-logging).
      // Let's add a soft warning first, if they submit we allow it, but we can prevent it if we want rigorous checks. Let's allow with warning.
    }

    const finalWorkerName = currentUser.role === 'manager' ? currentUser.name : workerName.trim();
    if (!finalWorkerName) {
      setFormError('Dispatcher / Worker Name is required.');
      return;
    }

    onAddDelivery({
      modelId: selectedModel,
      workerName: finalWorkerName,
      date: deliveryDate || getLocalDateStr(),
      quantity: parsedQty,
      createdBy: currentUser.id
    });

    setQuantity('');
  };

  // Aggregate operators/dispatchers for filter dropdown
  const uniqueDispatchers = useMemo(() => {
    const workers = new Set<string>();
    deliveries.forEach((d) => workers.add(d.workerName));
    return Array.from(workers);
  }, [deliveries]);

  // Filter list of deliveries
  const filteredDeliveries = useMemo(() => {
    return [...deliveries]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((d) => {
        const matchModel = filterModel === 'ALL' || d.modelId === filterModel;
        const matchWorker = filterWorker === 'ALL' || d.workerName === filterWorker;
        const matchSearch = filterSearch === '' || 
          d.workerName.toLowerCase().includes(filterSearch.toLowerCase()) || 
          d.modelId.toLowerCase().includes(filterSearch.toLowerCase());
        return matchModel && matchWorker && matchSearch;
      });
  }, [deliveries, filterModel, filterWorker, filterSearch]);

  const totalDeliveredSum = useMemo(() => {
    return deliveries.reduce((s, d) => s + d.quantity, 0);
  }, [deliveries]);

  const netStockSum = useMemo(() => {
    return AIRBAG_MODELS.reduce((sum, model) => sum + (availableStock[model] || 0), 0);
  }, [availableStock]);

  return (
    <div className="space-y-8" id="delivery-module-view">
      {/* Dynamic Stock Levels vs Deliveries */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-500 font-sans">Active Stock Available After Deliveries</h3>
            <p className="text-xs text-slate-400 mt-0.5">Calculated in real-time: Manufacturing Stockpile minus Dispatch Shipments</p>
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
                <p className="text-xs text-slate-500 font-medium">Subtract dispatched units from stockpile</p>
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
                      {MOCK_PROFILES.map((profile) => (
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
                <p className="text-xs text-slate-550 font-medium mt-1">Audit trail of finished parts shipped/dispatched from the factory</p>
              </div>

              {/* Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`self-start md:self-auto px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border cursor-pointer shadow-3xs ${
                  showFilters || filterModel !== 'ALL' || filterWorker !== 'ALL' || filterSearch
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                id="toggle-delivery-filters"
              >
                <SlidersHorizontal size={14} />
                <span>Filters {showFilters ? 'Hide' : 'Show'}</span>
                {(filterModel !== 'ALL' || filterWorker !== 'ALL' || filterSearch) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-550"></span>
                )}
              </button>
            </div>

            {/* Slide drawer for filters */}
            <AnimatePresence>
              {(showFilters || filterModel !== 'ALL' || filterWorker !== 'ALL' || filterSearch) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4"
                  id="expanded-delivery-filter-drawer"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                    {/* Search Field */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Search Text</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search dispatcher/model..."
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
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase">Airbag Model</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase">Delivered By</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase">Dispatched Date</th>
                      <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase text-right">Delivered Quantity</th>
                      {currentUser.role === 'manager' && (
                        <th className="p-4 text-2s font-bold text-slate-500 tracking-widest uppercase text-center w-12">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {filteredDeliveries.length === 0 ? (
                        <tr>
                          <td colSpan={currentUser.role === 'manager' ? 5 : 4} className="p-8 text-center text-xs text-slate-550">
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
                            className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors bg-white"
                            id={`delivery-row-${d.id}`}
                          >
                            <td className="p-4">
                              <span className="text-xs font-bold text-amber-800 font-mono tracking-wide bg-amber-50/50 border border-amber-100 px-2.5 py-1 rounded-lg">
                                {d.modelId}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-xs font-bold text-slate-850">
                                {d.workerName}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-mono text-slate-500 uppercase">
                              {new Date(d.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: '2-digit',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="p-4 text-xs font-extrabold text-right font-mono text-amber-750 select-all">
                              -{d.quantity} pcs
                            </td>
                            {currentUser.role === 'manager' && (
                              <td className="p-4 text-center">
                                <button
                                  onClick={() => onDeleteDelivery?.(d.id)}
                                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer"
                                  title="Revoke / Delete dispatch"
                                  id={`delete-delivery-${d.id}`}
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
              <span>Showing {filteredDeliveries.length} of {deliveries.length} delivery records</span>
              <span>Sorted by Dispatch Recency</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
