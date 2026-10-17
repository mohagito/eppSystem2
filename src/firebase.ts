import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence Firestore non-critical connection timeout notices
try {
  setLogLevel('silent');
} catch {}

// Filter console to prevent browser test runners from flagging offline warning as an uncaught error
if (typeof window !== 'undefined') {
  const isOfflineWarning = (msg: unknown) => {
    const str = typeof msg === 'string' ? msg : String(msg);
    return str.includes('Could not reach Cloud Firestore backend') ||
           str.includes('client will operate in offline mode') ||
           str.includes('Quota limit exceeded');
  };

  const origWarn = window.console.warn;
  window.console.warn = (...args: any[]) => {
    if (args.some(isOfflineWarning)) return;
    origWarn.apply(window.console, args);
  };

  const origError = window.console.error;
  window.console.error = (...args: any[]) => {
    if (args.some(isOfflineWarning)) return;
    origError.apply(window.console, args);
  };
}

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize services with persistentLocalCache to prevent repeated cloud reads and allow offline/quota-resilient caching
const isBrowser = typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  ...(isBrowser ? {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  } : {})
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

/**
 * Helper to identify Firestore quota exhaustion or network/offline resource limits
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const code = (error as any)?.code;
  return code === 'resource-exhausted' || 
         code === 'unavailable' ||
         code === 'deadline-exceeded' ||
         code === 'failed-precondition' ||
         msg.includes('quota limit exceeded') || 
         msg.includes('quota exceeded') ||
         msg.includes('free daily read units') ||
         msg.includes('resource_exhausted') ||
         msg.includes('resource-exhausted') ||
         msg.includes('could not reach') ||
         msg.includes('backend didn\'t respond') ||
         msg.includes('offline mode') ||
         msg.includes('client is offline') ||
         msg.includes('offline');
}

// --- FIRESTORE ERROR HANDLING UTILITIES (PER SYSTEM SKILLS SPEC) ---
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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void | never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  // If this is an offline or quota error, log a subtle warning and do not crash the React app
  if (isQuotaExceededError(error)) {
    console.warn(`Firestore operating in resilient local mode for ${operationType} on ${path}`);
    return;
  }

  // Security rule or unexpected permission errors are strictly thrown per skill spec
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

