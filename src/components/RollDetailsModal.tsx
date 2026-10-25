import React, { useState, useEffect } from 'react';
import { 
  X, 
  Scroll, 
  Layers, 
  Calendar, 
  User, 
  Ruler, 
  TrendingUp, 
  TrendingDown, 
  Plus,
  CheckCircle2,
  Clock,
  Archive,
  Check,
  Cpu,
  AlertCircle
} from 'lucide-react';
import { RollEntry, UserProfile, ExpectedYieldConfig, FinishedPiecePrice, MachineType, StockEntry } from '../types';
import { 
  calculateRollProductionMetrics, 
  formatEuroCurrency, 
  formatProfitPercent,
  formatEfficiencyPercent,
  normalizeRollMaterial,
  MATERIAL_FAMILY_RELATIONSHIPS
} from '../utils/financialCalculations';
import { getMoroccoDateStr, getMoroccoTimeStr, formatMoroccoDate } from '../utils/timeZone';
import Swal from 'sweetalert2';

interface RollDetailsModalProps {
  roll: RollEntry | null;
  isOpen: boolean;
  currentUser: UserProfile;
  expectedYields?: ExpectedYieldConfig[];
  piecePrices?: FinishedPiecePrice[];
  stockEntries?: StockEntry[];
  onClose: () => void;
  onRecordProduction?: (
    rollId: string, 
    quantity: number, 
    machine?: MachineType | string, 
    notes?: string,
    referenceId?: string
  ) => Promise<void>;
  onMarkFinished?: (rollId: string, wasteMeters?: number, notes?: string) => Promise<void>;
  onOpenCloseRoll?: (roll: RollEntry) => void;
}

export default function RollDetailsModal({
  roll,
  isOpen,
  currentUser,
  expectedYields,
  piecePrices,
  stockEntries = [],
  onClose,
  onRecordProduction,
  onMarkFinished,
  onOpenCloseRoll
}: RollDetailsModalProps) {
  const normMat = normalizeRollMaterial(roll?.materialName || 'White Huesker');
  const allowedRefs = MATERIAL_FAMILY_RELATIONSHIPS[normMat]?.activeReferences || [roll?.referenceId || 'BCB-FRA'];

  // Quick Production Log form state (MUST be declared before any early return)
  const [showAddProduction, setShowAddProduction] = useState<boolean>(false);
  const [prodReference, setProdReference] = useState<string>(roll?.referenceId || allowedRefs[0] || 'BCB-FRA');
  const [prodQty, setProdQty] = useState<string>('');
  const [prodMachine, setProdMachine] = useState<MachineType>('Big Machine');
  const [prodNotes, setProdNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Quick Finish Dialog state
  const [showFinishConfirm, setShowFinishConfirm] = useState<boolean>(false);
  const [wasteLength, setWasteLength] = useState<string>('0');
  const [finishNotes, setFinishNotes] = useState<string>('');

  useEffect(() => {
    if (roll) {
      const mat = normalizeRollMaterial(roll.materialName);
      const refs = MATERIAL_FAMILY_RELATIONSHIPS[mat]?.activeReferences || [roll.referenceId || 'BCB-FRA'];
      setProdReference(roll.referenceId || refs[0] || 'BCB-FRA');
      setShowAddProduction(false);
      setShowFinishConfirm(false);
      setProdQty('');
      setProdNotes('');
      setWasteLength('0');
      setFinishNotes('');
    }
  }, [roll?.id]);

  if (!isOpen || !roll) return null;

  const isManager = currentUser.role === 'manager';
  const metrics = calculateRollProductionMetrics(roll, expectedYields, piecePrices, stockEntries);

  const handleAddProductionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(prodQty, 10);
    if (isNaN(qty) || qty <= 0) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Please enter a valid piece quantity (> 0)',
        showConfirmButton: false,
        timer: 2500,
        background: '#0f172a',
        color: '#f8fafc'
      });
      return;
    }

    if (!onRecordProduction) return;
    setSubmitting(true);
    try {
      await onRecordProduction(roll.id, qty, prodMachine, prodNotes.trim(), prodReference);
      setProdQty('');
      setProdNotes('');
      setShowAddProduction(false);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `+${qty} pcs (${prodReference}) recorded & added to stock!`,
        showConfirmButton: false,
        timer: 2500,
        background: '#0f172a',
        color: '#f8fafc'
      });
    } catch (err: any) {
      console.error('Failed to record production:', err);
      Swal.fire('Error', 'Failed to record production.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishRoll = async () => {
    if (!onMarkFinished) return;
    setSubmitting(true);
    try {
      const waste = parseFloat(wasteLength) || 0;
      await onMarkFinished(roll.id, waste, finishNotes.trim());
      setShowFinishConfirm(false);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Roll marked as FINISHED',
        showConfirmButton: false,
        timer: 2500,
        background: '#0f172a',
        color: '#f8fafc'
      });
    } catch (err: any) {
      console.error('Failed to finish roll:', err);
      Swal.fire('Error', 'Failed to complete roll.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Scroll size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 font-mono">
                  {roll.barcode || roll.id}
                </h3>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  metrics.status === 'IN PRODUCTION' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                  metrics.status === 'CLOSED' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                  'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}>
                  {metrics.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {metrics.material} • <strong className="text-indigo-600">{metrics.referenceId}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Section 11 Primary 3-Metric Overview: Expected | Produced | Remaining */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Expected
              </span>
              <span className="text-lg font-black font-mono text-slate-800 mt-1 block">
                {metrics.expectedPieces.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">pcs</span>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                Produced
              </span>
              <span className="text-lg font-black font-mono text-indigo-800 mt-1 block">
                {metrics.producedPieces.toLocaleString()}
              </span>
              <span className="text-[10px] text-indigo-500 font-medium">pcs</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Remaining
              </span>
              <span className={`text-lg font-black font-mono mt-1 block ${
                metrics.remainingPieces === 0 ? 'text-emerald-600' : 'text-slate-700'
              }`}>
                {metrics.remainingPieces.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">pcs</span>
            </div>
          </div>

          {/* Material Efficiency Calculation (Produced PCS ÷ Expected PCS × 100) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <span>Material Efficiency</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ({metrics.producedPieces.toLocaleString()} ÷ {metrics.expectedPieces.toLocaleString()} × 100)
                </span>
              </span>
              <span className="font-mono font-black text-indigo-700 text-xs">
                {formatEfficiencyPercent(metrics.materialEfficiency)}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, Math.max(0, metrics.materialEfficiency || 0))}%` 
                }}
              />
            </div>
          </div>

          {/* Section 11 & 15: Financial Result (CONFIDENTIAL FOR MANAGER ONLY) */}
          {isManager && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-2.5" id="roll-details-financial-section">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200/70 pb-1.5">
                LIVE FINANCIAL EVALUATION
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Roll Cost</span>
                  <span className="font-bold text-slate-800">{formatEuroCurrency(metrics.rollCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Piece Price</span>
                  <span className="text-slate-700 font-bold">€{metrics.pricePerPiece.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Production Value</span>
                  <span className="font-black text-indigo-700">{formatEuroCurrency(metrics.productionValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Profit</span>
                  <span className={`font-black ${
                    metrics.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {formatEuroCurrency(metrics.grossProfit)}
                  </span>
                </div>
              </div>

              {/* Reference Breakdown if multiple references (e.g. Delcotex India -> SK216 & VW217) */}
              {metrics.piecesByReference && Object.keys(metrics.piecesByReference).length > 0 && (
                <div className="pt-2 border-t border-slate-200/60 space-y-1 text-[11px] font-mono">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
                    Production Attribution by Reference:
                  </span>
                  {Object.entries(metrics.piecesByReference).map(([ref, pcs]) => {
                    const val = metrics.productionValueByReference?.[ref] ?? 0;
                    return (
                      <div key={ref} className="flex justify-between items-center text-slate-600 bg-white/70 px-2 py-1 rounded-md border border-slate-200/40">
                        <span className="font-bold text-indigo-700">{ref}</span>
                        <span>{pcs.toLocaleString()} pcs × €0.7500 = <strong className="text-slate-800">{formatEuroCurrency(val)}</strong></span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60 font-mono text-xs">
                <span className="text-slate-500 font-sans font-bold">Profit % ((Gross Profit / Roll Cost) × 100)</span>
                <span className={`font-black text-sm ${
                  metrics.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}>
                  {formatProfitPercent(metrics.profitPercent)}
                </span>
              </div>
            </div>
          )}

          {/* Historical Opening Stock Snapshot */}
          {metrics.openingStockSnapshot && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Historical Opening Stock Snapshot
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-500">
                  Total: {(metrics.totalOpeningStock || 17786).toLocaleString()} pcs
                </span>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                Captured snapshot at roll activation (29 Sep 2026, 10:39). Opening stock is preserved historical inventory, not production.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {Object.entries(metrics.openingStockSnapshot).map(([ref, totalQty]) => {
                  const details = metrics.openingStockDetails?.[ref];
                  return (
                    <div key={ref} className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-indigo-700">{ref}</span>
                        <span className="font-black text-slate-800">{totalQty.toLocaleString()} pcs</span>
                      </div>
                      {details && (
                        <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                          <span>Packaged: {details.packaged.toLocaleString()}</span>
                          <span>Unpackaged: {details.unpackaged.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Actions (Record Production & Close Roll) */}
          {metrics.status !== 'CLOSED' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddProduction(!showAddProduction);
                  setShowFinishConfirm(false);
                }}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus size={14} />
                <span>+ Record Production</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenCloseRoll) {
                    onOpenCloseRoll(roll);
                  } else {
                    setShowFinishConfirm(!showFinishConfirm);
                    setShowAddProduction(false);
                  }
                }}
                className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              >
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Close Roll</span>
              </button>
            </div>
          )}

          {/* Form: Record Production on this Roll */}
          {showAddProduction && (
            <form onSubmit={handleAddProductionSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">
                  Record Production Batch
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddProduction(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>

              {allowedRefs.length > 1 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Finished Reference
                  </label>
                  <select
                    value={prodReference}
                    onChange={(e) => setProdReference(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs font-bold text-indigo-700 p-2 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    {allowedRefs.map((ref) => (
                      <option key={ref} value={ref}>
                        {ref}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Pieces Produced
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={prodQty}
                    onChange={(e) => setProdQty(e.target.value)}
                    placeholder="e.g. 50"
                    autoFocus
                    required
                    className="w-full bg-white border border-slate-200 text-xs font-bold font-mono p-2 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Laser Machine
                  </label>
                  <select
                    value={prodMachine}
                    onChange={(e) => setProdMachine(e.target.value as MachineType)}
                    className="w-full bg-white border border-slate-200 text-xs font-bold p-2 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="Big Machine">Big Machine</option>
                    <option value="Small Machine">Small Machine</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Optional Notes
                </label>
                <input
                  type="text"
                  value={prodNotes}
                  onChange={(e) => setProdNotes(e.target.value)}
                  placeholder="Shift, operator notes..."
                  className="w-full bg-white border border-slate-200 text-xs p-2 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddProduction(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <Check size={13} />
                  <span>Save & Link to Stock</span>
                </button>
              </div>
            </form>
          )}

          {/* Form: Mark Finished Confirmation */}
          {showFinishConfirm && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
              <span className="text-xs font-black text-slate-800 block">
                Mark Roll as Finished
              </span>
              <p className="text-[11px] text-slate-500">
                Marking this roll as FINISHED completes its production cycle. Remaining pieces will be archived.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Waste / Scrap (meters)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={wasteLength}
                    onChange={(e) => setWasteLength(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs font-bold font-mono p-2 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Completion Notes
                  </label>
                  <input
                    type="text"
                    value={finishNotes}
                    onChange={(e) => setFinishNotes(e.target.value)}
                    placeholder="Fully consumed, end of batch..."
                    className="w-full bg-white border border-slate-200 text-xs p-2 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowFinishConfirm(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleFinishRoll}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer active:scale-95"
                >
                  Confirm Finish
                </button>
              </div>
            </div>
          )}

          {/* Section 10: Production Traceability History for this roll */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Linked Production Records ({metrics.records.length})
            </span>

            {metrics.records.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center text-xs text-slate-400">
                No production batches recorded on this roll yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden text-xs">
                {metrics.records.map((rec) => (
                  <div key={rec.id} className="p-3 bg-white flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-indigo-700">
                          +{rec.quantity} pcs
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-bold text-slate-700">{rec.referenceId}</span>
                      </div>
                      <span className="text-[10.5px] text-slate-400 font-mono block mt-0.5">
                        {rec.date} {rec.time || ''} {rec.machine ? `• ${rec.machine}` : ''} {rec.operator ? `• ${rec.operator}` : ''}
                      </span>
                      {rec.notes && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5">{rec.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
