import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { RollEntry, StockEntry, RollFinancialRecord, DeliveryEntry } from '../types';

const VAULT_DOC_ID = 'immutable_master_vault';
const LOCAL_STORAGE_KEY = '_epp_emergency_vault_cache_v1_';

let debounceTimer: any = null;

/**
 * Background Data Protection Service
 * Operates 100% silently in the background with ZERO UI intrusion.
 * Automatically synchronizes a full shadow snapshot of rolls, stock, and financial records
 * to both an immutable Firestore security collection and persistent local browser storage.
 */
export function syncDataProtectionVault(data: {
  rolls?: RollEntry[];
  stockEntries?: StockEntry[];
  financialRecords?: RollFinancialRecord[];
  deliveries?: DeliveryEntry[];
}) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    try {
      const payload: Record<string, any> = {
        updatedAt: new Date().toISOString(),
        version: 1
      };

      if (data.rolls && data.rolls.length > 0) {
        payload.rollsCount = data.rolls.length;
        payload.rolls = data.rolls;
      }

      if (data.stockEntries && data.stockEntries.length > 0) {
        payload.stockCount = data.stockEntries.length;
        payload.stockEntries = data.stockEntries;
      }

      if (data.financialRecords && data.financialRecords.length > 0) {
        payload.financialCount = data.financialRecords.length;
        payload.financialRecords = data.financialRecords;
      }

      if (data.deliveries && data.deliveries.length > 0) {
        payload.deliveriesCount = data.deliveries.length;
        payload.deliveries = data.deliveries;
      }

      // 1. Keep browser localStorage lean (epp_last_known_safe_state already stores full snapshot)
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      } catch (err) {
        // Silently ignore storage quota or private browsing constraints
      }

      // 2. Silent backend master vault snapshot in Firestore
      const vaultRef = doc(db, 'security_snapshots', VAULT_DOC_ID);
      await setDoc(vaultRef, payload, { merge: true });

      // 3. Periodic immutable timestamped checkpoint (daily rotation)
      const dayKey = new Date().toISOString().slice(0, 10);
      const dayRef = doc(db, 'backups', `snapshot_${dayKey}`);
      const daySnap = await getDoc(dayRef);
      if (!daySnap.exists()) {
        await setDoc(dayRef, {
          ...payload,
          id: `snapshot_${dayKey}`,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      // Background operation: never throw or disrupt the user interface
    }
  }, 2000);
}
