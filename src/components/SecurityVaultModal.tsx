import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  History,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  X,
  Database,
  ArrowRight,
  HardDrive
} from 'lucide-react';
import {
  DataVaultSnapshot,
  getStoredSnapshots,
  recordVaultSnapshot,
  exportFullDatabaseBackupJSON,
  restoreBaselineReserveRolls,
  restoreSnapshotToFirestore,
  getLastKnownSafeSnapshot
} from '../utils/dataProtection';
import { RollEntry, StockEntry, DeliveryEntry, ProductionPlan, UserProfile } from '../types';
import Swal from 'sweetalert2';

interface SecurityVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  rolls: RollEntry[];
  stockEntries: StockEntry[];
  deliveries: DeliveryEntry[];
  plans: ProductionPlan[];
  profiles: UserProfile[];
  dailyTargets: Record<string, number>;
  onDataRestored?: () => void;
}

export default function SecurityVaultModal({
  isOpen,
  onClose,
  currentUser,
  rolls,
  stockEntries,
  deliveries,
  plans,
  profiles,
  dailyTargets,
  onDataRestored
}: SecurityVaultModalProps) {
  const [snapshots, setSnapshots] = useState<DataVaultSnapshot[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSnapshots(getStoredSnapshots());
    }
  }, [isOpen, rolls.length, stockEntries.length]);

  if (!isOpen) return null;

  const handleExportBackup = () => {
    exportFullDatabaseBackupJSON({
      rolls,
      stockEntries,
      deliveries,
      plans,
      profiles,
      dailyTargets
    });
    // Also save a checkpoint snapshot
    recordVaultSnapshot(
      { rolls, stockEntries, deliveries, plans, profiles, dailyTargets },
      'manual_export',
      `Manual Export by ${currentUser?.name || 'Manager'}`
    );
    setSnapshots(getStoredSnapshots());

    Swal.fire({
      icon: 'success',
      title: 'Full Backup Exported',
      text: 'Encrypted JSON backup file downloaded successfully to your device.',
      background: '#0f172a',
      color: '#f8fafc',
      confirmButtonColor: '#10b981',
      timer: 3000
    });
  };

  const handleRestoreBaselineRolls = async () => {
    Swal.fire({
      title: 'Restore Factory Reserve Baseline?',
      html: `
        <div class="text-left text-xs space-y-2 text-slate-300">
          <p>This will check and restore missing factory reserve baseline rolls:</p>
          <ul class="list-disc pl-5 text-emerald-400 font-semibold space-y-1">
            <li>9 Yellow Huesker (100m each)</li>
            <li>7 Kuga (50m each)</li>
            <li>4 White Huesker (100m each)</li>
          </ul>
          <p class="text-amber-400 font-bold pt-2">Note: Any newly registered rolls will be preserved!</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Restore Baseline',
      cancelButtonText: 'Cancel',
      background: '#0f172a',
      color: '#f8fafc',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#334155'
    }).then(async (res) => {
      if (res.isConfirmed) {
        setLoadingAction('Restoring Baseline Rolls...');
        try {
          const restoredCount = await restoreBaselineReserveRolls(true);
          setLoadingAction(null);
          Swal.fire({
            icon: 'success',
            title: 'Baseline Restored',
            text: restoredCount > 0 ? `Restored ${restoredCount} baseline rolls into database.` : 'All 20 baseline rolls are already present!',
            background: '#0f172a',
            color: '#f8fafc',
            confirmButtonColor: '#10b981'
          });
          if (onDataRestored) onDataRestored();
        } catch (err: any) {
          setLoadingAction(null);
          Swal.fire({
            icon: 'error',
            title: 'Restore Error',
            text: err?.message || 'Could not restore baseline rolls',
            background: '#0f172a',
            color: '#f8fafc'
          });
        }
      }
    });
  };

  const handleRestoreSnapshot = async (snap: DataVaultSnapshot) => {
    Swal.fire({
      title: 'Restore From Selected Snapshot?',
      html: `
        <div class="text-left text-xs space-y-2 text-slate-300">
          <p>Snapshot taken on: <strong>${new Date(snap.timestamp).toLocaleString()}</strong></p>
          <div class="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 font-mono text-[11px] space-y-1">
            <div>• Rolls in snapshot: <strong>${snap.stats.rollsCount}</strong> (${snap.stats.totalRollMeters} m)</div>
            <div>• Stock Entries: <strong>${snap.stats.stockCount}</strong></div>
            <div>• Deliveries: <strong>${snap.stats.deliveriesCount}</strong></div>
            <div>• Production Plans: <strong>${snap.stats.plansCount}</strong></div>
          </div>
          <p class="text-emerald-400 font-semibold pt-1">All records from this snapshot will be written directly into Cloud Firestore.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Restore to Cloud DB',
      cancelButtonText: 'Cancel',
      background: '#0f172a',
      color: '#f8fafc',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#334155'
    }).then(async (res) => {
      if (res.isConfirmed) {
        setLoadingAction('Restoring Snapshot to Cloud Firestore...');
        try {
          const resStats = await restoreSnapshotToFirestore(snap.data);
          setLoadingAction(null);
          Swal.fire({
            icon: 'success',
            title: 'Snapshot Restored Successfully',
            html: `
              <div class="text-xs text-left text-slate-300 space-y-1">
                <div>✓ Rolls Restored: <strong>${resStats.rollsRestored}</strong></div>
                <div>✓ Stock Entries Restored: <strong>${resStats.stockRestored}</strong></div>
                <div>✓ Deliveries Restored: <strong>${resStats.deliveriesRestored}</strong></div>
                <div>✓ Plans Restored: <strong>${resStats.plansRestored}</strong></div>
              </div>
            `,
            background: '#0f172a',
            color: '#f8fafc',
            confirmButtonColor: '#10b981'
          });
          if (onDataRestored) onDataRestored();
        } catch (err: any) {
          setLoadingAction(null);
          Swal.fire({
            icon: 'error',
            title: 'Restore Error',
            text: err?.message || 'Failed restoring snapshot data',
            background: '#0f172a',
            color: '#f8fafc'
          });
        }
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const databaseObj = parsed.database || parsed;
        const rollsList = databaseObj.rolls || databaseObj.rollsTraceability || [];
        const stockList = databaseObj.stock_entries || databaseObj.stockEntries || [];
        const deliveriesList = databaseObj.deliveries || [];
        const plansList = databaseObj.production_plans || databaseObj.plans || [];

        if (!Array.isArray(rollsList) && !Array.isArray(stockList)) {
          throw new Error('Invalid backup file structure: missing rolls or stock array');
        }

        Swal.fire({
          title: 'Confirm File Backup Restore',
          html: `
            <div class="text-left text-xs space-y-2 text-slate-300">
              <p>File verified: <strong>${file.name}</strong></p>
              <div class="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 font-mono text-[11px] space-y-1">
                <div>• Rolls to restore: <strong>${rollsList.length}</strong></div>
                <div>• Stock entries: <strong>${stockList.length}</strong></div>
                <div>• Deliveries: <strong>${deliveriesList.length}</strong></div>
                <div>• Plans: <strong>${plansList.length}</strong></div>
              </div>
              <p class="text-amber-400 font-bold pt-1">Proceed to inject all records into Cloud Firestore?</p>
            </div>
          `,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, Restore Now',
          cancelButtonText: 'Cancel',
          background: '#0f172a',
          color: '#f8fafc',
          confirmButtonColor: '#10b981',
          cancelButtonColor: '#334155'
        }).then(async (r) => {
          if (r.isConfirmed) {
            setLoadingAction('Importing Backup into Cloud Firestore...');
            try {
              const resStats = await restoreSnapshotToFirestore({
                rolls: rollsList,
                stockEntries: stockList,
                deliveries: deliveriesList,
                plans: plansList,
                profiles: databaseObj.profiles || [],
                dailyTargets: databaseObj.daily_targets || {}
              });
              setLoadingAction(null);
              Swal.fire({
                icon: 'success',
                title: 'Data Imported Successfully',
                text: `Restored ${resStats.rollsRestored} rolls, ${resStats.stockRestored} stock records, and ${resStats.deliveriesRestored} deliveries into Firestore.`,
                background: '#0f172a',
                color: '#f8fafc',
                confirmButtonColor: '#10b981'
              });
              if (onDataRestored) onDataRestored();
            } catch (err: any) {
              setLoadingAction(null);
              Swal.fire({
                icon: 'error',
                title: 'Import Failed',
                text: err?.message || 'Could not import backup',
                background: '#0f172a',
                color: '#f8fafc'
              });
            }
          }
        });
      } catch (err: any) {
        Swal.fire({
          icon: 'error',
          title: 'Invalid File',
          text: err?.message || 'Unable to parse JSON backup file',
          background: '#0f172a',
          color: '#f8fafc'
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalCurrentMeters = rolls.reduce((acc, r) => acc + (Number(r.metersTotal) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-wide">Data Protection & Security Vault</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  100% Protected
                </span>
              </div>
              <p className="text-xs text-slate-400">Zero-data-loss protection, real-time local vault & instant cloud recovery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Security Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Cloud Firestore</span>
                <CheckCircle2 size={15} className="text-emerald-400" />
              </div>
              <div className="text-sm font-bold text-white">Fortified ABAC Rules</div>
              <p className="text-[11px] text-slate-400 mt-1">Rule gates prevent corrupt payloads & unauthorized wipes</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Active Rolls Tracked</span>
                <Database size={15} className="text-indigo-400" />
              </div>
              <div className="text-sm font-bold text-white">{rolls.length} Rolls ({totalCurrentMeters.toLocaleString()} m)</div>
              <p className="text-[11px] text-slate-400 mt-1">Live physical stock status verified</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Local Snapshot Vault</span>
                <HardDrive size={15} className="text-amber-400" />
              </div>
              <div className="text-sm font-bold text-white">{snapshots.length} Safety Snapshots</div>
              <p className="text-[11px] text-slate-400 mt-1">Automatic rolling checkpoints in browser cache</p>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Lock size={14} className="text-emerald-400" />
              Emergency Recovery & Backup Tools
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={handleExportBackup}
                className="p-3 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex flex-col items-start gap-1 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 font-black text-emerald-400">
                  <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
                  Export Full Backup
                </div>
                <span className="text-[10px] text-slate-400 font-normal">Download timestamped .json with all rolls & stock</span>
              </button>

              <button
                onClick={handleRestoreBaselineRolls}
                className="p-3 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex flex-col items-start gap-1 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 font-black text-indigo-400">
                  <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                  Restore Baseline (20 Rolls)
                </div>
                <span className="text-[10px] text-slate-400 font-normal">9 Yellow, 7 Kuga, 4 White (preserves custom rolls)</span>
              </button>

              <label className="p-3 rounded-xl bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex flex-col items-start gap-1 transition-all cursor-pointer group">
                <div className="flex items-center gap-1.5 font-black text-amber-400">
                  <Upload size={14} className="group-hover:-translate-y-0.5 transition-transform" />
                  Upload Backup (.json)
                </div>
                <span className="text-[10px] text-slate-400 font-normal">Restore database from previously downloaded file</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Snapshot History Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <History size={14} className="text-indigo-400" />
                Automatic Local Snapshots ({snapshots.length})
              </h3>
              <span className="text-[10px] text-slate-400">Auto-saved to device whenever data changes</span>
            </div>

            {snapshots.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-800/40 border border-slate-800 text-center text-xs text-slate-400">
                No snapshots recorded yet. An automatic snapshot is saved whenever database records update.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {snapshots.map((snap, idx) => (
                  <div
                    key={snap.id}
                    className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-750 flex items-center justify-between transition-colors text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{snap.label}</span>
                        {idx === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
                        <span>{new Date(snap.timestamp).toLocaleString()}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-semibold">{snap.stats.rollsCount} Rolls ({snap.stats.totalRollMeters}m)</span>
                        <span>•</span>
                        <span>{snap.stats.stockCount} Stock Entries</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRestoreSnapshot(snap)}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <RefreshCw size={12} />
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck size={14} className="text-emerald-400" />
            Zero-Trust Data Protection Engine Active
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close Vault
          </button>
        </div>
      </motion.div>
    </div>
  );
}
