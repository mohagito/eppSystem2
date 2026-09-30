import React from 'react';
import { 
  X, 
  Scroll, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Clock, 
  Package, 
  ArrowRight,
  ShieldCheck,
  Calendar,
  User,
  Ruler
} from 'lucide-react';
import { 
  RollEntry, 
  FinishedPiecePrice, 
  ExpectedYieldConfig, 
  StockEntry, 
  DeliveryEntry 
} from '../types';
import { 
  calculateRollProductionMetrics, 
  formatEuroCurrency, 
  formatEuroPrice, 
  formatProfitPercent,
  getMaterialFamily,
  normalizeRollMaterial,
  getMaterialRelatedReferences,
  calculateCurrentModelStock,
  referenceToAirbagModel,
  matchReference,
  getPiecePriceForReference
} from '../utils/financialCalculations';
import { formatMoroccoDate, formatMoroccoDateTime } from '../utils/timeZone';

interface RollReconciliationModalProps {
  isOpen: boolean;
  roll: RollEntry | null;
  piecePrices?: FinishedPiecePrice[];
  expectedYields?: ExpectedYieldConfig[];
  stockEntries?: StockEntry[];
  deliveries?: DeliveryEntry[];
  onClose: () => void;
  onOpenCloseRoll?: (roll: RollEntry) => void;
}

export default function RollReconciliationModal({
  isOpen,
  roll,
  piecePrices = [],
  expectedYields = [],
  stockEntries = [],
  deliveries = [],
  onClose,
  onOpenCloseRoll
}: RollReconciliationModalProps) {
  if (!isOpen || !roll) return null;

  const normMat = normalizeRollMaterial(roll.materialName);
  const family = getMaterialFamily(normMat);
  const metrics = calculateRollProductionMetrics(roll, expectedYields, piecePrices);
  const isClosed = metrics.status === 'CLOSED';
  const isInProduction = metrics.status === 'IN PRODUCTION';
  const isNew = metrics.status === 'NEW';
  const isProfitable = metrics.grossProfit >= 0;

  // Build or extract per-reference reconciliation rows
  const references = getMaterialRelatedReferences(roll.materialName);
  const recData = roll.reconciliation?.references || [];

  const referenceRows = references.map((ref) => {
    // If closed reconciliation already exists for this reference
    const foundRec = recData.find((r) => matchReference(r.reference, ref));
    if (foundRec) {
      return foundRec;
    }

    // Otherwise, compute live values
    const model = referenceToAirbagModel(ref);
    const openStock = roll.openingStockSnapshot?.[ref] ?? roll.rollOpeningStock?.[ref] ?? 
      calculateCurrentModelStock(model, stockEntries, deliveries).totalAvailableStock;
    
    const prodRecords = roll.productionRecords || [];
    const logged = prodRecords
      .filter((r) => matchReference(r.referenceId, ref))
      .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    
    let closeUnpackaged = 0;
    if (roll.closingUnpackaged) {
      for (const [key, val] of Object.entries(roll.closingUnpackaged)) {
        if (matchReference(key, ref)) {
          closeUnpackaged = Number(val) || 0;
          break;
        }
      }
    }

    const actualProd = logged + closeUnpackaged;
    const price = getPiecePriceForReference(ref, piecePrices);
    const prodValue = Math.round(actualProd * price * 100) / 100;
    const finalStock = openStock + actualProd;

    return {
      reference: ref,
      openingStock: openStock,
      productionDuringRoll: logged,
      closingUnpackaged: closeUnpackaged,
      actualProduction: actualProd,
      pricePerPiece: price,
      productionValue: prodValue,
      finalStock
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div 
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        id="roll-reconciliation-modal"
      >
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <Scroll size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 font-mono">
                  {roll.barcode || roll.id}
                </h3>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  isClosed ? 'bg-slate-100 text-slate-700 border-slate-300' :
                  isInProduction ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  {metrics.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                {family} • <span className="font-mono">{metrics.actualLength}m</span>
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
        <div className="p-6 space-y-6 overflow-y-auto">

          {/* Roll Context Header Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Material</span>
              <span className="font-bold text-slate-800 font-sans">{roll.materialName}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Length</span>
              <span className="font-mono font-bold text-slate-800">{metrics.actualLength} meters</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Opened On</span>
              <span className="font-mono text-slate-700">
                {roll.openedAt ? formatMoroccoDateTime(roll.openedAt) : (roll.date ? formatMoroccoDate(roll.date) : 'Pending')}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Closed On</span>
              <span className="font-mono text-slate-700">
                {roll.closedAt ? formatMoroccoDateTime(roll.closedAt) : (isClosed ? 'Closed' : 'Active')}
              </span>
            </div>
          </div>

          {/* Per-Reference Detailed Reconciliation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-600" />
                Finished Reference Reconciliation
              </h4>
              <span className="text-[11px] font-semibold text-slate-400 font-mono">
                {referenceRows.length} linked reference{referenceRows.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {referenceRows.map((row) => (
                <div 
                  key={row.reference}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <span className="text-sm font-black text-slate-900 uppercase">
                        {row.reference}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      Price: {formatEuroPrice(row.pricePerPiece)} / pc
                    </span>
                  </div>

                  {/* Metrics grid for this reference */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Initial Stock
                      </span>
                      <span className="text-sm font-black font-mono text-slate-800 mt-0.5 block">
                        {row.openingStock.toLocaleString()}
                      </span>
                      <span className="text-[9.5px] text-slate-400">pcs at open</span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Closing Unpackaged
                      </span>
                      <span className="text-sm font-black font-mono text-amber-700 mt-0.5 block">
                        +{row.closingUnpackaged.toLocaleString()}
                      </span>
                      <span className="text-[9.5px] text-amber-600/80">saved to stock</span>
                    </div>

                    <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                        Actual Production
                      </span>
                      <span className="text-sm font-black font-mono text-indigo-900 mt-0.5 block">
                        {row.actualProduction.toLocaleString()}
                      </span>
                      <span className="text-[9.5px] text-indigo-600 font-semibold">pcs from roll</span>
                    </div>

                    <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                        Production Value
                      </span>
                      <span className="text-sm font-black font-mono text-emerald-700 mt-0.5 block">
                        {formatEuroCurrency(row.productionValue)}
                      </span>
                      <span className="text-[9.5px] text-emerald-600 font-semibold">calculated</span>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Master Financial Result Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-400" />
                Financial Performance Result
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                isProfitable ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {isProfitable ? 'Profitable' : 'Deficit'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Actual Roll Cost
                </span>
                <span className="text-lg font-black font-mono text-white mt-1 block">
                  {formatEuroCurrency(metrics.rollCost)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {metrics.actualLength}m fabric
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
                  Production Value
                </span>
                <span className="text-lg font-black font-mono text-indigo-400 mt-1 block">
                  {formatEuroCurrency(metrics.productionValue)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {metrics.producedPieces} total pcs
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Gross Profit
                </span>
                <span className={`text-lg font-black font-mono mt-1 block ${
                  isProfitable ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {formatEuroCurrency(metrics.grossProfit)}
                </span>
                <span className="text-[10px] text-slate-400">Value − Cost</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Profit Margin
                </span>
                <span className={`text-lg font-black font-mono mt-1 block ${
                  isProfitable ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {formatProfitPercent(metrics.profitPercent)}
                </span>
                <span className="text-[10px] text-slate-400">(Profit / Cost)</span>
              </div>

            </div>
          </div>

          {/* Quick Action if roll is still In Production */}
          {isInProduction && onOpenCloseRoll && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-amber-900 block">
                  Roll is currently IN PRODUCTION
                </span>
                <span className="text-[11px] text-amber-700 block">
                  When cutting is complete, close the roll to reconcile remaining unpackaged pieces and finalize the financial result.
                </span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenCloseRoll(roll);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer shrink-0"
              >
                Close Roll Now
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
