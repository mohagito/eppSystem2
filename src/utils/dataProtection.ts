import { RollEntry, StockEntry, DeliveryEntry, ProductionPlan, UserProfile } from '../types';
import { db } from '../firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';

export interface DataVaultSnapshot {
  id: string;
  timestamp: string;
  label: string;
  source: 'auto_snapshot' | 'safety_checkpoint' | 'manual_export';
  stats: {
    rollsCount: number;
    stockCount: number;
    deliveriesCount: number;
    plansCount: number;
    profilesCount: number;
    totalRollMeters: number;
  };
  data: {
    rolls: RollEntry[];
    stockEntries: StockEntry[];
    deliveries: DeliveryEntry[];
    plans: ProductionPlan[];
    profiles: UserProfile[];
    dailyTargets?: Record<string, number>;
  };
}

const VAULT_STORAGE_KEY = 'epp_security_vault_snapshots_v1';
const LAST_SAFE_BACKUP_KEY = 'epp_last_known_safe_state';
const MAX_SNAPSHOTS = 15;

/**
 * Saves a timestamped snapshot of all factory data into the local vault
 */
export function recordVaultSnapshot(
  data: {
    rolls: RollEntry[];
    stockEntries: StockEntry[];
    deliveries: DeliveryEntry[];
    plans: ProductionPlan[];
    profiles: UserProfile[];
    dailyTargets?: Record<string, number>;
  },
  source: 'auto_snapshot' | 'safety_checkpoint' | 'manual_export' = 'auto_snapshot',
  customLabel?: string
): DataVaultSnapshot | null {
  try {
    if (typeof window === 'undefined') return null;

    // Guard: Do not save an empty snapshot if we already have non-empty data in storage
    const totalItems = (data.rolls?.length || 0) + (data.stockEntries?.length || 0) + (data.deliveries?.length || 0);
    if (totalItems === 0) {
      const existingSafe = localStorage.getItem(LAST_SAFE_BACKUP_KEY);
      if (existingSafe) {
        // We already have safe data; avoid overwriting with empty
        return null;
      }
    }

    const totalMeters = (data.rolls || []).reduce((acc, r) => acc + (Number(r.metersTotal) || 0), 0);

    const snapshot: DataVaultSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      label: customLabel || (source === 'auto_snapshot' ? `Auto-Snapshot (${data.rolls?.length || 0} Rolls)` : 'Safety Checkpoint'),
      source,
      stats: {
        rollsCount: data.rolls?.length || 0,
        stockCount: data.stockEntries?.length || 0,
        deliveriesCount: data.deliveries?.length || 0,
        plansCount: data.plans?.length || 0,
        profilesCount: data.profiles?.length || 0,
        totalRollMeters: totalMeters
      },
      data: {
        rolls: data.rolls || [],
        stockEntries: data.stockEntries || [],
        deliveries: data.deliveries || [],
        plans: data.plans || [],
        profiles: data.profiles || [],
        dailyTargets: data.dailyTargets || {}
      }
    };

    // Save as last known safe backup if it contains meaningful data
    if ((data.rolls?.length || 0) > 0 || (data.stockEntries?.length || 0) > 0) {
      localStorage.setItem(LAST_SAFE_BACKUP_KEY, JSON.stringify(snapshot));
    }

    // Load existing history
    let existingList: DataVaultSnapshot[] = [];
    try {
      const raw = localStorage.getItem(VAULT_STORAGE_KEY);
      if (raw) {
        existingList = JSON.parse(raw);
        if (!Array.isArray(existingList)) existingList = [];
      }
    } catch {
      existingList = [];
    }

    // Prepend new snapshot, limit to MAX_SNAPSHOTS
    const updated = [snapshot, ...existingList.filter(s => s.id !== snapshot.id)].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(updated));

    return snapshot;
  } catch (err) {
    console.warn('Could not record vault snapshot:', err);
    return null;
  }
}

/**
 * Retrieve all stored snapshots
 */
export function getStoredSnapshots(): DataVaultSnapshot[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Retrieve last known safe snapshot
 */
export function getLastKnownSafeSnapshot(): DataVaultSnapshot | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(LAST_SAFE_BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Export full system data to a downloadable JSON file
 */
export function exportFullDatabaseBackupJSON(data: {
  rolls: RollEntry[];
  stockEntries: StockEntry[];
  deliveries: DeliveryEntry[];
  plans: ProductionPlan[];
  profiles: UserProfile[];
  dailyTargets?: Record<string, number>;
}) {
  const exportPayload = {
    app: 'EPP Manufacturing Management System',
    securityVersion: '2.0.0-fortified',
    exportedAt: new Date().toISOString(),
    exportTimestamp: Date.now(),
    checksum: `EPP_${Date.now()}_${data.rolls?.length || 0}R_${data.stockEntries?.length || 0}S`,
    stats: {
      rollsCount: data.rolls?.length || 0,
      stockEntriesCount: data.stockEntries?.length || 0,
      deliveriesCount: data.deliveries?.length || 0,
      plansCount: data.plans?.length || 0,
      profilesCount: data.profiles?.length || 0
    },
    database: {
      rolls: data.rolls || [],
      stock_entries: data.stockEntries || [],
      deliveries: data.deliveries || [],
      production_plans: data.plans || [],
      profiles: data.profiles || [],
      daily_targets: data.dailyTargets || {}
    }
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `EPP_FACTORY_SECURITY_BACKUP_${dateStr}_${timeStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Standard factory reserve stock baseline (20 rolls = 9 Yellow Huesker, 7 Kuga, 4 White Huesker)
 */
export const FACTORY_RESERVE_BASELINE_ROLLS: Omit<RollEntry, 'date'>[] = [
  // 9 Yellow Huesker (100m each)
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `roll-seed-yellow-${i + 1}`,
    materialName: 'Yellow Huesker' as const,
    status: 'Unopened' as const,
    metersTotal: 100,
    operator: 'Mohamed',
    createdBy: 'system',
    barcode: `EPP-ROLL-YELLOWHUESKER-${String(i + 1).padStart(3, '0')}`,
    notes: `Factory Reserve Stock - Roll #${i + 1} (100m)`
  })),
  // 7 Kuga (50m each)
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `roll-seed-kuga-${i + 1}`,
    materialName: 'Kuga' as const,
    status: 'Unopened' as const,
    metersTotal: 50,
    operator: 'Mohamed',
    createdBy: 'system',
    barcode: `EPP-ROLL-KUGA-${String(i + 1).padStart(3, '0')}`,
    notes: `Factory Reserve Stock - Roll #${i + 1} (50m)`
  })),
  // 4 White Huesker (100m each)
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `roll-seed-white-${i + 1}`,
    materialName: 'White Huesker' as const,
    status: 'Unopened' as const,
    metersTotal: 100,
    operator: 'Mohamed',
    createdBy: 'system',
    barcode: `EPP-ROLL-WHITEHUESKER-${String(i + 1).padStart(3, '0')}`,
    notes: `Factory Reserve Stock - Roll #${i + 1} (100m)`
  }))
];

/**
 * Safely restores baseline factory rolls WITHOUT deleting any custom operator rolls
 */
export async function restoreBaselineReserveRolls(preserveCustom: boolean = true): Promise<number> {
  const todayDate = new Date().toISOString().split('T')[0];
  const rollsSnap = await getDocs(collection(db, 'rolls'));
  const existingIds = new Set(rollsSnap.docs.map(d => d.id));

  const batch = writeBatch(db);
  let restoredCount = 0;

  for (const base of FACTORY_RESERVE_BASELINE_ROLLS) {
    if (!existingIds.has(base.id)) {
      const ref = doc(db, 'rolls', base.id);
      batch.set(ref, {
        ...base,
        date: todayDate
      });
      restoredCount++;
    }
  }

  // If preserveCustom is false, remove anything else (only if explicitly requested)
  if (!preserveCustom) {
    const baselineIds = new Set(FACTORY_RESERVE_BASELINE_ROLLS.map(b => b.id));
    rollsSnap.docs.forEach(d => {
      if (!baselineIds.has(d.id)) {
        batch.delete(d.ref);
      }
    });
  }

  if (restoredCount > 0) {
    await batch.commit();
  }

  return restoredCount;
}

/**
 * Restores a complete snapshot into Cloud Firestore
 */
export async function restoreSnapshotToFirestore(snapshotData: DataVaultSnapshot['data']): Promise<{
  rollsRestored: number;
  stockRestored: number;
  deliveriesRestored: number;
  plansRestored: number;
}> {
  let rollsRestored = 0;
  let stockRestored = 0;
  let deliveriesRestored = 0;
  let plansRestored = 0;

  // 1. Restore Rolls
  if (snapshotData.rolls && snapshotData.rolls.length > 0) {
    const batch = writeBatch(db);
    for (const roll of snapshotData.rolls) {
      if (roll.id) {
        batch.set(doc(db, 'rolls', roll.id), roll);
        rollsRestored++;
      }
    }
    await batch.commit();
  }

  // 2. Restore Stock Entries
  if (snapshotData.stockEntries && snapshotData.stockEntries.length > 0) {
    const batch = writeBatch(db);
    for (const entry of snapshotData.stockEntries) {
      if (entry.id) {
        batch.set(doc(db, 'stock_entries', entry.id), entry);
        stockRestored++;
      }
    }
    await batch.commit();
  }

  // 3. Restore Deliveries
  if (snapshotData.deliveries && snapshotData.deliveries.length > 0) {
    const batch = writeBatch(db);
    for (const delivery of snapshotData.deliveries) {
      if (delivery.id) {
        batch.set(doc(db, 'deliveries', delivery.id), delivery);
        deliveriesRestored++;
      }
    }
    await batch.commit();
  }

  // 4. Restore Production Plans
  if (snapshotData.plans && snapshotData.plans.length > 0) {
    const batch = writeBatch(db);
    for (const plan of snapshotData.plans) {
      if (plan.id) {
        batch.set(doc(db, 'production_plans', plan.id), plan);
        plansRestored++;
      }
    }
    await batch.commit();
  }

  // 5. Restore Targets if present
  if (snapshotData.dailyTargets && Object.keys(snapshotData.dailyTargets).length > 0) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'settings', 'daily_targets'), { targets: snapshotData.dailyTargets });
    await batch.commit();
  }

  return { rollsRestored, stockRestored, deliveriesRestored, plansRestored };
}
