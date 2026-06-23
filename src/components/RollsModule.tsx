import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, RollEntry, RollMaterial } from '../types';
import {
  PlusCircle,
  Clock,
  User,
  Barcode,
  Search,
  Filter,
  CheckCircle,
  FileSpreadsheet,
  Trash2,
  AlertCircle,
  Scissors,
  Scroll,
  Calendar,
  X,
  History,
  Activity,
  FileText
} from 'lucide-react';

interface RollsProps {
  currentUser: UserProfile;
  rolls: RollEntry[];
  onAddRoll: (roll: Omit<RollEntry, 'id' | 'openedAt'>) => void;
  onConsumeRoll: (id: string, remainingMeters: number, notes?: string) => void;
  onDeleteRoll: (id: string) => void;
}

const MATERIAL_PRESETS: RollMaterial[] = ['White Huesker', 'Yellow Huesker', 'Delcotex India', 'Kuga'];

export default function RollsModule({
  currentUser,
  rolls,
  onAddRoll,
  onConsumeRoll,
  onDeleteRoll
}: RollsProps) {
  // Local active date & time
  const getLocalDateStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Form State
  const [selectedMaterial, setSelectedMaterial] = useState<RollMaterial>('White Huesker');
  const [barcodeValue, setBarcodeValue] = useState<string>('');
  const [activeTabSub, setActiveTabSub] = useState<'active' | 'history'>('active');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMaterial, setFilterMaterial] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterOperator, setFilterOperator] = useState<string>('all');

  // Consuming Modal State
  const [consumeRollId, setConsumeRollId] = useState<string | null>(null);
  const [remainingMeters, setRemainingMeters] = useState<number>(0);
  const [consumeNotes, setConsumeNotes] = useState<string>('');

  // Unique list of operators in current rolls for filtering
  const rollOperators = useMemo(() => {
    const ops = new Set<string>();
    rolls.forEach(r => {
      if (r.operator) ops.add(r.operator);
    });
    return Array.from(ops);
  }, [rolls]);

  // Filtered rolls
  const filteredRolls = useMemo(() => {
    return rolls.filter(r => {
      const matchSearch = searchQuery === '' || 
        r.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.operator.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchMaterial = filterMaterial === 'all' || r.materialName === filterMaterial;
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchOp = filterOperator === 'all' || r.operator === filterOperator;

      return matchSearch && matchMaterial && matchStatus && matchOp;
    });
  }, [rolls, searchQuery, filterMaterial, filterStatus, filterOperator]);

  // Statistics for inventory traceability
  const stats = useMemo(() => {
    const activeCount = rolls.filter(r => r.status === 'Active').length;
    const consumedCount = rolls.filter(r => r.status === 'Consumed').length;
    const materialBreakdown = {} as Record<RollMaterial, number>;
    
    MATERIAL_PRESETS.forEach(m => {
      materialBreakdown[m] = 0;
    });

    rolls.forEach(r => {
      if (r.status === 'Active' && materialBreakdown[r.materialName] !== undefined) {
        materialBreakdown[r.materialName] += 1;
      }
    });

    return {
      activeCount,
      consumedCount,
      breakdown: materialBreakdown
    };
  }, [rolls]);

  // Submit Roll Opening handler
  const handleOpenRollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeValue.trim()) return;

    onAddRoll({
      materialName: selectedMaterial,
      date: getLocalDateStr(),
      barcode: barcodeValue.toUpperCase().trim(),
      operator: currentUser.name,
      createdBy: currentUser.id,
      status: 'Active'
    });

    setBarcodeValue('');
  };

  // Trigger Consume Modal
  const openConsumeDialog = (roll: RollEntry) => {
    setConsumeRollId(roll.id);
    setRemainingMeters(0);
    setConsumeNotes('');
  };

  const handleConsumeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumeRollId) return;

    onConsumeRoll(consumeRollId, remainingMeters, consumeNotes);
    setConsumeRollId(null);
  };

  // PDF / CSV export function for traceability compliance records
  const exportRollsCSV = () => {
    const headers = ['Serial Barcode', 'Material Name', 'Date Opened', 'Opened At', 'Operator', 'Status', 'Closed At'];
    const rows = rolls.map(r => [
      r.barcode,
      r.materialName,
      r.date,
      new Date(r.openedAt).toLocaleString(),
      r.operator,
      r.status,
      r.closedAt ? new Date(r.closedAt).toLocaleString() : 'Active'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fabrics_traceability_${getLocalDateStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="rolls-traceability-view" className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded bg-amber-500 text-white shadow-sm">
              <Scroll id="rolls-main-icon" className="w-5 h-5 animate-pulse" />
            </span>
            <h1 id="rolls-title" className="text-2xl font-bold text-slate-900 tracking-tight">Fabric Rolls Traceability</h1>
          </div>
          <p id="rolls-subtitle" className="text-slate-500 text-xs md:text-sm">
            Zero-gap compliance logging when workers open textile rolls for precision laser cut assembly.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            id="btn-export-rolls"
            onClick={exportRollsCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 hover:text-slate-900 font-medium text-xs rounded-lg border border-slate-200 hover:border-slate-300 shadow-xs transition-all pointer-events-auto cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Rolls Loaded</p>
            <p className="text-xl font-extrabold text-slate-800">{stats.activeCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Spent & Consumed</p>
            <p className="text-xl font-extrabold text-slate-800">{stats.consumedCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-xs flex items-center gap-3 col-span-2">
          <div className="w-full">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Active Roll Counter by brand</p>
            <div className="flex justify-between text-xs gap-2">
              {MATERIAL_PRESETS.map(m => (
                <div key={m} className="bg-slate-50 border border-slate-100 rounded px-2 py-1 text-center flex-1">
                  <span className="text-[10px] text-slate-500 block truncate">{m}</span>
                  <span className="font-extrabold text-slate-700">{stats.breakdown[m]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Layout Block: Split into register form (Left) and live active list (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Form Container (Width: 5 Cols on desktop) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl shadow-md border border-slate-800 p-5 md:p-6 overflow-hidden relative">
            <div className="absolute right-0 top-0 -mr-12 -mt-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="p-1 px-2 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold tracking-wider uppercase">Fabric Entry</span>
              <h2 className="text-base font-extrabold tracking-tight">Open New Roll (Traceability)</h2>
            </div>

            <form onSubmit={handleOpenRollSubmit} className="space-y-4">
              
              {/* Roll Material Selection */}
              <div>
                <label className="block text-slate-300 font-medium text-xs mb-1.5">Material Roll Brand / Name <span className="text-amber-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {MATERIAL_PRESETS.map((material) => (
                    <button
                      key={material}
                      type="button"
                      onClick={() => setSelectedMaterial(material)}
                      className={`py-2 px-2.5 rounded-lg border text-left text-xs font-semibold transition-all transition-colors flex items-center justify-between ${
                        selectedMaterial === material
                          ? 'border-amber-400 bg-amber-500/15 text-white shadow-xs'
                          : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <span className="truncate">{material}</span>
                      {selectedMaterial === material && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 ml-1"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Barcode Input */}
              <div>
                <label className="block text-slate-300 font-medium text-xs mb-1.5">Barcode <span className="text-amber-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Barcode className="w-4 h-4 text-amber-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={barcodeValue}
                    onChange={(e) => setBarcodeValue(e.target.value)}
                    placeholder="Type barcode number..."
                    className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg py-2 pl-9 pr-4 text-xs font-mono text-amber-400 tracking-wider placeholder-slate-600 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Operator details shown inline */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center text-slate-400">
                    <User className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Logging Operator</p>
                    <p className="text-xs font-semibold text-slate-200">{currentUser.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Shift Date</p>
                  <p className="text-xs font-semibold text-slate-300">{getLocalDateStr()}</p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs py-3 px-4 rounded-xl shadow-md transform active:scale-98 transition-all pointer-events-auto cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Register Roll Opening (Worker Mention)</span>
              </button>

            </form>
          </div>

          {/* Quick Laser Guidance info */}
          <div className="bg-slate-100/80 border border-slate-200/60 rounded-2xl p-4 flex gap-3 text-xs text-slate-600">
            <Scissors className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 mb-0.5">Physical Roll Traceability Policy</p>
              <p className="leading-relaxed">
                Textile rolls represent the foundational bulk raw material. When you open a plastic sheath and load the fabric roll onto the laser cutting bed, you <strong>MUST</strong> log it here immediately to audit cutting output. Let's minimize scrap!
              </p>
            </div>
          </div>
        </div>

        {/* Live Tracking List Container (Width: 7 Cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden">
            
            {/* Tab controls */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setActiveTabSub('active')}
                className={`flex-1 py-3 text-center text-xs font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTabSub === 'active'
                    ? 'border-amber-500 text-amber-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Active/Loaded Rolls ({rolls.filter(r => r.status === 'Active').length})</span>
              </button>
              <button
                onClick={() => setActiveTabSub('history')}
                className={`flex-1 py-3 text-center text-xs font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTabSub === 'history'
                    ? 'border-amber-500 text-amber-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Consumption Log / History ({rolls.filter(r => r.status === 'Consumed').length})</span>
              </button>
            </div>

            {/* List Controls with live searching */}
            <div className="p-4 bg-slate-50/20 border-b border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by serial barcode, notes, or operator..."
                    className="w-full bg-white border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg py-2 pl-9 pr-4 text-xs placeholder-slate-400 transition-all outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  {/* Filter Material preset */}
                  <select
                    value={filterMaterial}
                    onChange={(e) => setFilterMaterial(e.target.value)}
                    className="bg-white border border-slate-205 rounded-lg py-1.5 px-2 text-xs font-semibold outline-none hover:border-slate-300"
                  >
                    <option value="all">All Brands</option>
                    {MATERIAL_PRESETS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>

                  {/* Filter Operators */}
                  <select
                    value={filterOperator}
                    onChange={(e) => setFilterOperator(e.target.value)}
                    className="bg-white border border-slate-205 rounded-lg py-1.5 px-2 text-xs font-semibold outline-none hover:border-slate-300"
                  >
                    <option value="all">All Operators</option>
                    {rollOperators.map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Live Rolls Listings */}
            <div className="p-2 sm:p-4 min-h-[360px]">
              <AnimatePresence mode="popLayout">
                {filteredRolls.filter(r => activeTabSub === 'active' ? r.status === 'Active' : r.status === 'Consumed').length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-12 flex flex-col items-center justify-center text-center text-slate-400"
                  >
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-full mb-3">
                      <Barcode className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">No matching traceability entries found</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                      {activeTabSub === 'active' 
                        ? "Great! All loaded textile rolls have been registered as consumed. Register a new opened roll to load."
                        : "No consumption entries recorded yet matching filters."}
                    </p>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredRolls
                      .filter(r => activeTabSub === 'active' ? r.status === 'Active' : r.status === 'Consumed')
                      .map((roll) => {
                        const mColor = 
                          roll.materialName === 'White Huesker' ? 'amber' :
                          roll.materialName === 'Yellow Huesker' ? 'yellow' :
                          roll.materialName === 'Delcotex India' ? 'blue' : 'emerald';

                        return (
                          <motion.div
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            key={roll.id}
                            className={`p-3.5 rounded-xl border bg-white shadow-xs transition-all flex flex-col justify-between ${
                              roll.status === 'Active'
                                ? 'border-amber-100 hover:border-amber-300 bg-amber-50/5'
                                : 'border-slate-150 hover:border-slate-200'
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase mb-1 ${
                                    mColor === 'amber' ? 'bg-amber-100 text-amber-800' :
                                    mColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                                    mColor === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {roll.materialName}
                                  </span>
                                  <h3 className="text-xs font-mono font-extrabold tracking-wide text-slate-800 flex items-center gap-1">
                                    <Barcode className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{roll.barcode}</span>
                                  </h3>
                                </div>

                                <div className="text-right">
                                  {roll.status === 'Active' ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[9px] border border-emerald-120">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                      Active Bed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[9px]">
                                      Fully Spent
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-1.5 text-[10px] text-slate-500 mb-3 border-t border-slate-50 pt-2">
                                <div className="flex justify-between">
                                  <span>Loaded:</span>
                                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {new Date(roll.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({roll.date})
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Shift Operator:</span>
                                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    {roll.operator}
                                  </span>
                                </div>
                                {roll.status === 'Consumed' && (
                                  <>
                                    <div className="flex justify-between border-t border-dashed border-slate-100 pt-1 mt-1">
                                      <span>Spent At:</span>
                                      <span className="font-semibold text-rose-600">
                                        {roll.closedAt ? new Date(roll.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'n/a'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Spent By:</span>
                                      <span className="font-semibold text-slate-700">{roll.closedBy || 'Unknown'}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-50 pt-2 mt-auto">
                              {roll.status === 'Active' ? (
                                <button
                                  id={`btn-consume-${roll.id}`}
                                  onClick={() => openConsumeDialog(roll)}
                                  className="w-full flex items-center justify-center gap-1 py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-lg transition-all shadow-xs pointer-events-auto cursor-pointer"
                                >
                                  <Scissors className="w-3 h-3" />
                                  <span>Declare Spent / Fully Consumed</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  Audited compliance record
                                </span>
                              )}

                              {/* Only managers can delete traceability records */}
                              {currentUser.role === 'manager' && (
                                <button
                                  id={`btn-delete-${roll.id}`}
                                  onClick={() => onDeleteRoll(roll.id)}
                                  className="p-1 text-slate-300 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors ml-2 pointer-events-auto cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </div>

      {/* Consume Roll Modal (Dialog Overlay) */}
      <AnimatePresence>
        {consumeRollId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-4 bg-amber-500 text-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Scissors className="w-4 h-4" />
                  <h3 className="font-extrabold text-xs tracking-tight">Declare Roll State</h3>
                </div>
                <button
                  onClick={() => setConsumeRollId(null)}
                  className="p-1 bg-amber-600/30 text-slate-950 hover:bg-amber-600/50 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConsumeSubmit} className="p-4 space-y-4">
                <div className="p-3 bg-amber-50 rounded-lg flex gap-2.5 text-slate-700">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed">
                    You are marking the active roll <strong>{rolls.find(r => r.id === consumeRollId)?.barcode}</strong> as consumed.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConsumeRollId(null)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Confirm Consumed
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
