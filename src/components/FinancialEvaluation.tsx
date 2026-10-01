import React, { useState, useMemo } from 'react';
import { 
  CircleDollarSign, 
  SlidersHorizontal, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  RotateCcw,
  Eye,
  CheckCircle2,
  Clock,
  Settings2,
  Save,
  X
} from 'lucide-react';
import { 
  UserProfile, 
  RollEntry, 
  FinishedPiecePrice, 
  RollFinancialRecord, 
  ExpectedYieldConfig,
  RollMaterial,
  MachineType,
  StockEntry,
  DeliveryEntry
} from '../types';
import { 
  DEFAULT_PIECE_PRICES,
  DEFAULT_EXPECTED_YIELDS,
  MATERIAL_FAMILY_RELATIONSHIPS,
  calculateRealRollCost, 
  calculateRollProductionMetrics,
  formatEuroCurrency, 
  formatEuroPrice, 
  formatProfitPercent,
  normalizeRollMaterial,
  getMaterialFamily,
  normalizeRollStatus,
  getMaterialRelatedReferences
} from '../utils/financialCalculations';
import RollDetailsModal from './RollDetailsModal';
import RollReconciliationModal from './RollReconciliationModal';
import CloseRollModal from './CloseRollModal';
import Swal from 'sweetalert2';

interface FinancialEvaluationProps {
  currentUser: UserProfile;
  rolls: RollEntry[];
  financialRecords?: RollFinancialRecord[];
  piecePrices: FinishedPiecePrice[];
  expectedYields?: ExpectedYieldConfig[];
  stockEntries?: StockEntry[];
  deliveries?: DeliveryEntry[];
  onSaveFinancialRecord?: (record: RollFinancialRecord) => Promise<void>;
  onDeleteFinancialRecord?: (recordId: string) => Promise<void>;
  onUpdatePiecePrices: (prices: FinishedPiecePrice[]) => Promise<void>;
  onUpdateExpectedYields?: (yields: ExpectedYieldConfig[]) => Promise<void>;
  onRecordProduction?: (
    rollId: string, 
    quantity: number, 
    machine?: MachineType | string, 
    notes?: string
  ) => Promise<void>;
  onMarkFinished?: (rollId: string, wasteMeters?: number, notes?: string) => Promise<void>;
  onCloseRoll?: (rollId: string, closingUnpackaged: Record<string, number>, notes?: string) => Promise<void>;
}

export default function FinancialEvaluation({
  currentUser,
  rolls,
  piecePrices,
  expectedYields = DEFAULT_EXPECTED_YIELDS,
  stockEntries = [],
  deliveries = [],
  onUpdatePiecePrices,
  onUpdateExpectedYields,
  onRecordProduction,
  onMarkFinished,
  onCloseRoll
}: FinancialEvaluationProps) {
  // Inspecting specific roll modal for detailed reconciliation
  const [selectedRollForReconciliation, setSelectedRollForReconciliation] = useState<RollEntry | null>(null);
  const [closingRoll, setClosingRoll] = useState<RollEntry | null>(null);

  // Configuration Modals
  const [priceConfigModalOpen, setPriceConfigModalOpen] = useState<boolean>(false);
  const [yieldConfigModalOpen, setYieldConfigModalOpen] = useState<boolean>(false);

  // Filters State
  const [searchRoll, setSearchRoll] = useState<string>('');
  const [filterMaterial, setFilterMaterial] = useState<string>('all');
  const [filterReference, setFilterReference] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Editable maps for Configuration Modals
  const [editablePrices, setEditablePrices] = useState<Record<string, number>>({});
  const [editableYields, setEditableYields] = useState<Record<string, number>>({});

  // Active prices list helper (fallback to defaults if empty)
  const activePricesList = useMemo(() => {
    if (piecePrices && piecePrices.length > 0) {
      return piecePrices;
    }
    return DEFAULT_PIECE_PRICES;
  }, [piecePrices]);

  // Active yields list helper (fallback to defaults if empty)
  const activeYieldsList = useMemo(() => {
    if (expectedYields && expectedYields.length > 0) {
      return expectedYields;
    }
    return DEFAULT_EXPECTED_YIELDS;
  }, [expectedYields]);

  // Compute calculated metrics for each physical roll automatically
  // ROLL → EXPECTED PIECES → PRODUCTION → PIECE STOCK → ROLL COMPLETION → FINANCIAL RESULT
  const rollRowsWithMetrics = useMemo(() => {
    return rolls.map((roll) => {
      const metrics = calculateRollProductionMetrics(roll, activeYieldsList, activePricesList, stockEntries);
      return {
        roll,
        ...metrics
      };
    });
  }, [rolls, activeYieldsList, activePricesList, stockEntries]);

  // Filtered rows for the list/table
  const filteredRollRows = useMemo(() => {
    return rollRowsWithMetrics.filter((item) => {
      // 1. Roll filter (search by barcode or ID)
      if (searchRoll.trim()) {
        const q = searchRoll.trim().toLowerCase();
        const barcodeMatch = (item.roll.barcode || '').toLowerCase().includes(q);
        const idMatch = (item.roll.id || '').toLowerCase().includes(q);
        if (!barcodeMatch && !idMatch) return false;
      }

      // 2. Material filter
      if (filterMaterial !== 'all') {
        const fam = getMaterialFamily(item.material);
        if (item.material !== filterMaterial && fam !== filterMaterial) {
          return false;
        }
      }

      // 3. Reference filter
      if (filterReference !== 'all') {
        if (item.referenceId !== filterReference) return false;
      }

      // 4. Status filter
      if (filterStatus !== 'all') {
        if (item.status !== filterStatus) return false;
      }

      return true;
    });
  }, [rollRowsWithMetrics, searchRoll, filterMaterial, filterReference, filterStatus]);

  // 3 Primary KPI Summaries as requested: Total Roll Cost, Production Value, Gross Profit
  const summaryKPIs = useMemo(() => {
    let totalRollCost = 0;
    let totalProductionValue = 0;

    // Only aggregate over rolls that have actually been opened / started (IN PRODUCTION or CLOSED)
    const activeOrFinishedRolls = rollRowsWithMetrics.filter(
      (r) => r.status === 'IN PRODUCTION' || r.status === 'CLOSED'
    );

    activeOrFinishedRolls.forEach((r) => {
      totalRollCost += r.rollCost;
      totalProductionValue += r.productionValue;
    });

    const grossProfit = Math.round((totalProductionValue - totalRollCost) * 100) / 100;
    const profitPercentage = totalRollCost > 0
      ? Math.round((grossProfit / totalRollCost) * 10000) / 100
      : 0;

    return {
      activeRollsCount: activeOrFinishedRolls.length,
      totalRollCost,
      totalProductionValue,
      grossProfit,
      profitPercentage
    };
  }, [rollRowsWithMetrics]);

  // Open Price Configuration Modal
  const openPriceConfig = () => {
    const map: Record<string, number> = {};
    activePricesList.forEach((p) => {
      map[p.id] = p.pricePerPiece;
    });
    setEditablePrices(map);
    setPriceConfigModalOpen(true);
  };

  // Open Expected Yields Configuration Modal
  const openYieldConfig = () => {
    const map: Record<string, number> = {};
    activeYieldsList.forEach((y) => {
      map[y.id] = y.expectedPieces;
    });
    setEditableYields(map);
    setYieldConfigModalOpen(true);
  };

  // Save Price Configuration
  const handleSavePrices = async () => {
    const updated: FinishedPiecePrice[] = activePricesList.map((p) => {
      const val = editablePrices[p.id];
      return {
        ...p,
        pricePerPiece: val !== undefined ? Math.max(0, Number(val)) : p.pricePerPiece,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name
      };
    });

    try {
      await onUpdatePiecePrices(updated);
      setPriceConfigModalOpen(false);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Piece prices updated successfully',
        showConfirmButton: false,
        timer: 3000,
        background: '#0f172a',
        color: '#f8fafc'
      });
    } catch (err) {
      console.error('Failed to update prices:', err);
      Swal.fire('Error', 'Failed to update prices.', 'error');
    }
  };

  // Save Expected Yields Configuration
  const handleSaveYields = async () => {
    if (!onUpdateExpectedYields) return;
    const updated: ExpectedYieldConfig[] = activeYieldsList.map((y) => {
      const val = editableYields[y.id];
      return {
        ...y,
        expectedPieces: val !== undefined ? Math.max(0, parseInt(String(val), 10) || 0) : y.expectedPieces,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name
      };
    });

    try {
      await onUpdateExpectedYields(updated);
      setYieldConfigModalOpen(false);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Expected yields updated successfully',
        showConfirmButton: false,
        timer: 3000,
        background: '#0f172a',
        color: '#f8fafc'
      });
    } catch (err) {
      console.error('Failed to update expected yields:', err);
      Swal.fire('Error', 'Failed to update yields.', 'error');
    }
  };

  return (
    <div className="space-y-6" id="financial-evaluation-view">
      
      {/* Top Header & Fast Manager Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <CircleDollarSign size={20} />
            </div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Financial Evaluation</h1>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full border border-amber-200">
              Manager Only
            </span>
          </div>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Automatic linkage: Roll → Expected Pieces → Production → Piece Stock → Financial Result.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Configure Expected Pieces per Roll */}
          <button
            onClick={openYieldConfig}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
            title="Configure expected yield pieces per roll reference"
          >
            <Settings2 size={14} className="text-slate-600" />
            <span>Expected Yields</span>
          </button>

          {/* Configure Finished Piece Prices */}
          <button
            onClick={openPriceConfig}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
            title="Configure finished piece prices"
          >
            <SlidersHorizontal size={14} className="text-slate-600" />
            <span>Piece Prices</span>
          </button>
        </div>
      </div>

      {/* 3 Clean KPI Cards: Total Roll Cost, Production Value, Gross Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="financial-kpi-summary">
        
        {/* Total Roll Cost */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Roll Cost</p>
          <p className="text-2xl font-black font-mono text-slate-900 mt-1">
            {formatEuroCurrency(summaryKPIs.totalRollCost)}
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            {summaryKPIs.activeRollsCount > 0 
              ? `Real cost of ${summaryKPIs.activeRollsCount} active/finished rolls`
              : '€0.00 (Starts calculating when rolls are opened)'}
          </p>
        </div>

        {/* Production Value */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Production Value</p>
          <p className="text-2xl font-black font-mono text-indigo-700 mt-1">
            {formatEuroCurrency(summaryKPIs.totalProductionValue)}
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            {summaryKPIs.activeRollsCount > 0
              ? 'Produced Pieces × Piece Price'
              : '€0.00 (Starts calculating when pieces are produced)'}
          </p>
        </div>

        {/* Gross Profit */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit</p>
            <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-black px-2 py-0.5 rounded-full ${
              summaryKPIs.grossProfit >= 0 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {summaryKPIs.grossProfit >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {formatProfitPercent(summaryKPIs.profitPercentage)}
            </span>
          </div>
          <p className={`text-2xl font-black font-mono mt-1 ${
            summaryKPIs.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
          }`}>
            {formatEuroCurrency(summaryKPIs.grossProfit)}
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            {summaryKPIs.activeRollsCount > 0
              ? 'Production Value − Total Roll Cost'
              : '€0.00 (Final profit calculated when roll finishes)'}
          </p>
        </div>

      </div>

      {/* Clean Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center flex-1">
          {/* Roll Search */}
          <div className="relative min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchRoll}
              onChange={(e) => setSearchRoll(e.target.value)}
              placeholder="Search Roll..."
              className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Material Filter */}
          <select
            value={filterMaterial}
            onChange={(e) => setFilterMaterial(e.target.value)}
            className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">All Materials</option>
            <option value="HUESKER 22">HUESKER 22</option>
            <option value="HUESKER 82">HUESKER 82</option>
            <option value="INDIA / DELCOTEX">INDIA / DELCOTEX</option>
            <option value="KUGA">KUGA</option>
          </select>

          {/* Reference Filter */}
          <select
            value={filterReference}
            onChange={(e) => setFilterReference(e.target.value)}
            className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">All References</option>
            <option value="BCB-FRA">BCB-FRA</option>
            <option value="TETOUAN / XJX-MARR">TETOUAN / XJX-MARR</option>
            <option value="CRAFTER">CRAFTER</option>
            <option value="SK216">SK216</option>
            <option value="VW217">VW217</option>
            <option value="KUGA LHD">KUGA LHD</option>
            <option value="KUGA RHD">KUGA RHD</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="IN PRODUCTION">IN PRODUCTION</option>
            <option value="CLOSED">CLOSED</option>
            <option value="NEW">NEW</option>
          </select>
        </div>

        {/* Clear Filters (if active) */}
        {(searchRoll || filterMaterial !== 'all' || filterReference !== 'all' || filterStatus !== 'all') && (
          <button
            onClick={() => {
              setSearchRoll('');
              setFilterMaterial('all');
              setFilterReference('all');
              setFilterStatus('all');
            }}
            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-500 hover:text-slate-800 transition-colors self-start md:self-center cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {/* Clean Table: Roll | Material | References | Pieces | Roll Cost | Production Value | Profit | Status */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden" id="financial-evaluation-table">
        <div className="overflow-x-auto">
          {filteredRollRows.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CircleDollarSign size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No rolls found matching your criteria.</p>
              <p className="text-xs text-slate-400">
                Open a roll or adjust your filters to view financial performance.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Roll</th>
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-4">References</th>
                  <th className="py-3 px-4 text-center">Pieces</th>
                  <th className="py-3 px-4 text-right">Roll Cost</th>
                  <th className="py-3 px-4 text-right">Production Value</th>
                  <th className="py-3 px-4 text-right">Profit</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Reconciliation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRollRows.map((item) => {
                  const isPositive = item.grossProfit >= 0;
                  const family = getMaterialFamily(item.material);
                  const relatedRefs = getMaterialRelatedReferences(item.material);

                  return (
                    <tr 
                      key={item.roll.id} 
                      onClick={() => setSelectedRollForReconciliation(item.roll)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      {/* Roll */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-xs">
                        {item.roll.barcode || item.roll.id}
                      </td>

                      {/* Material */}
                      <td className="py-3.5 px-4 font-bold text-slate-700">
                        {family}
                      </td>

                      {/* References */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {relatedRefs.map((ref) => (
                            <span 
                              key={ref} 
                              className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60"
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Pieces */}
                      <td className="py-3.5 px-4 text-center font-mono font-black text-indigo-800">
                        {item.producedPieces.toLocaleString()} pcs
                      </td>

                      {/* Roll Cost */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                        {formatEuroCurrency(item.rollCost)}
                      </td>

                      {/* Production Value */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-indigo-700">
                        {formatEuroCurrency(item.productionValue)}
                      </td>

                      {/* Profit */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`font-mono font-black text-xs ${
                            isPositive ? 'text-emerald-700' : 'text-rose-600'
                          }`}>
                            {formatEuroCurrency(item.grossProfit)}
                          </span>
                          <span className={`text-[10px] font-mono font-black ${
                            isPositive ? 'text-emerald-600' : 'text-rose-500'
                          }`}>
                            {formatProfitPercent(item.profitPercent)}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          item.status === 'IN PRODUCTION' ? 'bg-amber-100 text-amber-900 border-amber-200' :
                          item.status === 'CLOSED' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                          'bg-emerald-100 text-emerald-900 border-emerald-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* View Reconciliation Action */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedRollForReconciliation(item.roll)}
                          className="px-2.5 py-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Open detailed reconciliation"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50/90 border-t border-slate-200 text-xs font-black text-slate-700">
                  <td colSpan={4} className="py-3 px-4 uppercase tracking-wider text-[10px] text-slate-500">
                    Total Active Production ({summaryKPIs.activeRollsCount} rolls started)
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                    {formatEuroCurrency(summaryKPIs.totalRollCost)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-indigo-700">
                    {formatEuroCurrency(summaryKPIs.totalProductionValue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-700">
                    {formatEuroCurrency(summaryKPIs.grossProfit)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Expected Yields Configuration Modal */}
      {yieldConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Settings2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Expected Pieces Per Roll</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Configure expected yields for Material → Reference pairs
                  </p>
                </div>
              </div>
              <button
                onClick={() => setYieldConfigModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-3">
                {activeYieldsList.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        {item.materialFamily}
                      </span>
                      <span className="text-xs font-black text-slate-800">
                        {item.reference}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={editableYields[item.id] ?? item.expectedPieces}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setEditableYields((prev) => ({ ...prev, [item.id]: val }));
                        }}
                        className="w-24 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-right text-slate-800 focus:outline-hidden focus:border-indigo-500"
                      />
                      <span className="text-xs text-slate-400 font-bold">pcs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setYieldConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveYields}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                <span>Save Yields</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finished Piece Prices Modal */}
      {priceConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Finished Piece Prices</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Configure official pricing schedule per piece (€ / piece)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPriceConfigModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-3">
                {activePricesList.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {item.materialFamily}
                        </span>
                        {!item.isActive && (
                          <span className="text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200 rounded-md px-1.5 py-0.2">
                            STOPPED
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-black text-slate-800">
                        {item.reference}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-bold">€</span>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={editablePrices[item.id] ?? item.pricePerPiece}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEditablePrices((prev) => ({ ...prev, [item.id]: val }));
                        }}
                        className="w-24 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-right text-slate-800 focus:outline-hidden focus:border-emerald-500"
                      />
                      <span className="text-xs text-slate-400 font-bold">/pc</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPriceConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePrices}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                <span>Save Prices</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Roll Reconciliation Modal */}
      {selectedRollForReconciliation && (
        <RollReconciliationModal
          roll={selectedRollForReconciliation}
          isOpen={Boolean(selectedRollForReconciliation)}
          piecePrices={activePricesList}
          expectedYields={activeYieldsList}
          stockEntries={stockEntries}
          deliveries={deliveries}
          onClose={() => setSelectedRollForReconciliation(null)}
          onOpenCloseRoll={(r) => {
            setSelectedRollForReconciliation(null);
            setClosingRoll(r);
          }}
        />
      )}

      {/* Operator & Manager Simple Close Roll Dialog (Asks for Remaining Unpackaged Pieces) */}
      {closingRoll && (
        <CloseRollModal
          isOpen={Boolean(closingRoll)}
          roll={closingRoll}
          onClose={() => setClosingRoll(null)}
          onConfirmClose={async (rollId, unpackaged, notes) => {
            if (onCloseRoll) {
              await onCloseRoll(rollId, unpackaged, notes);
            }
            setClosingRoll(null);
          }}
        />
      )}

    </div>
  );
}
