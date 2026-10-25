import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Clean up any stale Firestore multi-tab keys in localStorage and corrupted Firestore IndexedDB caches BEFORE Firestore initializes
function sanitizeLocalStorageQuota() {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith('firestore_') || k === '_epp_emergency_vault_cache_v1_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => {
        try {
          window.localStorage.removeItem(k);
        } catch (_) {}
      });

      // Test write capacity; if localStorage is still near quota, trim old snapshots
      const testKey = '__epp_quota_probe__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
    }
  } catch (_) {
    try {
      window.localStorage?.removeItem('epp_security_vault_snapshots_v1');
      window.localStorage?.removeItem('_epp_emergency_vault_cache_v1_');
    } catch (_) {}
  }

  // Purge corrupted local browser Firestore IndexedDB databases (e.g. orphaned batchId: 145 causing ID: b7de / b815)
  try {
    if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
      window.indexedDB.databases().then((dbs) => {
        dbs.forEach((dbInfo) => {
          if (dbInfo.name && dbInfo.name.startsWith('firestore/')) {
            try {
              window.indexedDB.deleteDatabase(dbInfo.name);
            } catch (_) {}
          }
        });
      }).catch(() => {});
    }
  } catch (_) {}
}

sanitizeLocalStorageQuota();

// Initialize Firebase SDK
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with in-memory cache and auto-detect long polling
// Avoids corrupted browser IndexedDB mutation queues (ID: b7de / b815) and proxy WebChannel timeouts
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = dbInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

let quotaExceededState = false;
const quotaListeners = new Set<(exceeded: boolean) => void>();

export function setQuotaExceeded(exceeded: boolean) {
  if (quotaExceededState !== exceeded) {
    quotaExceededState = exceeded;
    quotaListeners.forEach(listener => listener(exceeded));
  }
}

export function getQuotaExceeded() {
  return quotaExceededState;
}

export function onQuotaExceededChange(listener: (exceeded: boolean) => void): () => void {
  quotaListeners.add(listener);
  listener(quotaExceededState);
  return () => {
    quotaListeners.delete(listener);
  };
}

export function isQuotaExceededError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : (error instanceof Error ? error.message : String(error));
  const code = error?.code || '';
  // Note: Local browser storage QuotaExceededError (b815 / b7de) is NOT a cloud resource-exhausted error
  if (msg.includes('setItem') || msg.includes('Storage') || msg.includes('b815') || msg.includes('b7de') || msg.includes('INTERNAL ASSERTION FAILED')) {
    sanitizeLocalStorageQuota();
    return false;
  }
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);

  // Recover silently from browser localStorage/IndexedDB assertion or transient network errors without crashing the UI
  if (
    errStr.includes('setItem') ||
    errStr.includes('QuotaExceededError') ||
    errStr.includes('b815') ||
    errStr.includes('b7de') ||
    errStr.includes('INTERNAL ASSERTION FAILED') ||
    errStr.includes('Could not reach Cloud Firestore backend') ||
    errStr.includes('client is offline')
  ) {
    sanitizeLocalStorageQuota();
    console.warn(`[Storage/Network Guard] Handled transient error during ${operationType} on ${path}:`, errStr);
    return;
  }

  if (isQuotaExceededError(error)) {
    setQuotaExceeded(true);
    console.warn(`Firestore Quota Exceeded during ${operationType} on ${path}. App switched to cached/safe mode.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
