import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Database,
  CalendarRange,
  LogOut,
  User,
  ShieldAlert,
  Sliders,
  Menu,
  X,
  Factory,
  Compass,
  KeyRound,
  Users2,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  MonitorCheck,
  AlertCircle,
  Truck,
  Download,
  Printer,
  Scroll
} from 'lucide-react';
import { UserProfile, StockEntry, ProductionPlan, ToastMessage, DeliveryEntry, RollEntry } from './types';
import { MOCK_PROFILES, INITIAL_STOCK_ENTRIES, INITIAL_PLANS } from './data';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import WorkerDashboard from './components/WorkerDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import StockManagement from './components/StockManagement';
import PlanningModule from './components/PlanningModule';
import DeliveryModule from './components/DeliveryModule';
import LabelGenerator from './components/LabelGenerator';
import RollsModule from './components/RollsModule';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import NotificationCenter, { playNotificationSound } from './components/NotificationCenter';
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt';
import { onForegroundMessage } from './fcm';

export default function App() {
  // --- DATABASE AND LOCAL STORAGE PERSISTENCE ---
  const [dbLoading, setDbLoading] = useState<boolean>(true);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryEntry[]>([]);
  const [rolls, setRolls] = useState<RollEntry[]>([]);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('epp_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [dailyTargets, setDailyTargets] = useState<Record<string, number>>({
    '2026-06-01': 250,
    '2026-06-02': 300,
    '2026-06-03': 300,
    '2026-06-04': 250,
    '2026-06-05': 300,
    '2026-06-06': 350,
    '2026-06-07': 300,
  });

  // Navigation State
  const [activeTab, setActiveTab ] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    return tab || 'dashboard';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [quickNavOpen, setQuickNavOpen] = useState<boolean>(false);

  // --- PWA MOBILE INSTALL ENGINE ---
  const checkIfStandalone = () => {
    if (typeof window === 'undefined') return false;
    const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
    const isStandaloneLegacy = (navigator as any).standalone === true;
    return isStandaloneMedia || isStandaloneLegacy;
  };

  const [isInstalled, setIsInstalled] = useState<boolean>(checkIfStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Explicitly register service worker for mobile PWA install capability
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => {
          console.debug('Service Worker Registration:', err);
        });
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Dynamic display mode listener
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      (mediaQuery as any).addListener(handleMediaChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else {
        (mediaQuery as any).removeListener(handleMediaChange);
      }
    };
  }, []);

  const handleInstallApp = async () => {
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    
    if (isInIframe) {
      Swal.fire({
        title: 'Open App in Full Screen',
        html: `
          <div class="text-left space-y-3 font-sans text-xs">
            <div class="flex items-center gap-2 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 mb-3">
              <span class="text-amber-400 font-bold">⚠️ Chat Preview Limitation</span>
              <span class="text-[10px] text-slate-400">Mobile phones block PWA app stores and notifications inside chat previews.</span>
            </div>
            <p class="text-slate-300">To download and install the EPP system on your phone:</p>
            <ol class="list-decimal pl-4 space-y-2 text-slate-400 font-medium">
              <li>Tap the <span class="text-amber-400 font-black">"Open in new tab" ⎋</span> icon or click the button below.</li>
              <li>Once open in full Safari/Chrome, tap the <span class="text-emerald-400 font-bold">Install App</span> icon again!</li>
            </ol>
            <div class="pt-3">
              <a href="${window.location.href}" target="_blank" rel="noopener noreferrer" class="block w-full text-center py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95">
                🚀 Open in Full Screen Tab
              </a>
            </div>
          </div>
        `,
        icon: 'warning',
        showConfirmButton: false,
        showCloseButton: true,
        background: '#090d16',
        color: '#f8fafc',
        customClass: {
          popup: 'rounded-2xl border border-slate-800 shadow-2xl p-6 font-sans',
          title: 'text-sm font-extrabold uppercase tracking-wider text-slate-100 font-sans'
        },
        buttonsStyling: false
      });
      return;
    }

    if (!deferredPrompt) {
      // If deferredPrompt is null, we check if it's an iOS device or guide manual setup
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        Swal.fire({
          title: 'EPP Natur App Installation',
          html: `
            <div class="text-left space-y-3 font-sans text-xs">
              <div class="flex items-center gap-2 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 mb-3">
                <span class="text-emerald-400 font-bold">✨ Instant Phone Access</span>
                <span class="text-[10px] text-slate-400">Perfectly optimized for your mobile device layout</span>
              </div>
              <p class="text-slate-300">To install this manufacturing system on your Apple iOS device:</p>
              <ol class="list-decimal pl-5 space-y-2 text-slate-300 font-medium">
                <li>Tap the <strong class="text-amber-500">Share ⎋</strong> button at the bottom of the Safari browser navigation bar.</li>
                <li>Scroll down and select <strong class="text-amber-500">Add to Home Screen ＋</strong> from the options.</li>
                <li>Tap <strong class="text-emerald-400 font-extrabold">Add</strong> in the top-right corner to complete.</li>
              </ol>
              <p class="text-[10px] text-slate-500 mt-2">After adding, launch the app directly from your phone home screen to run standalone!</p>
            </div>
          `,
          icon: 'info',
          confirmButtonText: 'Entendido / Got it!',
          confirmButtonColor: '#10b981',
          background: '#090d16',
          color: '#f8fafc',
          customClass: {
            popup: 'rounded-2xl border border-slate-800 shadow-2xl p-6 font-sans',
            title: 'text-sm font-extrabold uppercase tracking-wider text-slate-100 font-sans',
            confirmButton: 'px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md'
          },
          buttonsStyling: false
        });
      } else {
        Swal.fire({
          title: 'Install EPP App',
          html: `
            <div class="text-left space-y-3 font-sans text-xs">
              <div class="flex items-center gap-1.5 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 mb-2">
                <span class="text-emerald-400 font-bold">🛠️ Portable App Mode</span>
              </div>
              <p class="text-slate-300">If your Android phone does not show the automatic prompt, you can install manually:</p>
              <ol class="list-decimal pl-5 space-y-2 text-slate-300 font-medium">
                <li>Open your mobile chrome settings overlay (tap the <strong class="text-amber-500">3 dots menu</strong> in the top-right or bottom-right).</li>
                <li>Select <strong class="text-emerald-400">"Add to Home screen"</strong> or <strong class="text-emerald-400">"Install app" / "Instalar aplicación"</strong>.</li>
              </ol>
            </div>
          `,
          icon: 'info',
          confirmButtonText: 'Entendido / Understood',
          confirmButtonColor: '#10b981',
          background: '#090d16',
          color: '#f8fafc',
          customClass: {
            popup: 'rounded-2xl border border-slate-800 shadow-2xl p-6 font-sans',
            title: 'text-sm font-extrabold uppercase tracking-wider text-slate-100 font-sans',
            confirmButton: 'px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md'
          },
          buttonsStyling: false
        });
      }
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
    } catch (err) {
      console.error('Error invoking native installation prompt:', err);
    }
  };

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const triggerCustomConfirm = (title: string, message: string, onConfirmAction: () => void) => {
    Swal.fire({
      title: title,
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Proceed',
      cancelButtonText: 'Cancel',
      background: '#0f172a', // slate-900
      color: '#cbd5e1', // slate-300
      iconColor: '#f59e0b', // amber-500
      customClass: {
        popup: 'rounded-2xl border border-slate-800 shadow-2xl p-6 font-sans',
        title: 'text-sm font-extrabold uppercase tracking-wider text-slate-100 font-sans mt-2',
        htmlContainer: 'text-xs text-slate-400 font-semibold leading-relaxed my-3',
        confirmButton: 'px-5 py-2.5 bg-emerald-500 hover:bg-emerald-650 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md mx-1.5',
        cancelButton: 'px-5 py-2.5 bg-slate-805 hover:bg-slate-700 text-slate-300 border border-slate-750 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm mx-1.5'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        onConfirmAction();
      }
    });
  };

  // Authentication Interface States
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [signUpMode, setSignUpMode] = useState<boolean>(false);
  const [signUpName, setSignUpName] = useState<string>('');
  const [signUpUsername, setSignUpUsername] = useState<string>('');
  const [signUpPassword, setSignUpPassword] = useState<string>('');
  const [signUpRole, setSignUpRole] = useState<'manager' | 'worker'>('worker');
  const [signUpStation, setSignUpStation] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // --- FCM FOREGROUND LISTENER ---
  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = onForegroundMessage((payload) => {
      // Trigger alarm chime
      playNotificationSound();

      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4500,
        timerProgressBar: true,
        background: '#0f172a',
        color: '#e2e8f0',
        icon: 'info',
        title: payload.notification?.title || payload.data?.title || 'System Alert',
        text: payload.notification?.body || payload.data?.body || 'New manufacturing event register',
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer);
          toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUser]);

  // --- REAL-TIME CLOUD FIRESTORE SYNCHRONIZATION ---
  useEffect(() => {
    let active = true;
    let unsubProfiles: (() => void) | null = null;
    let unsubStock: (() => void) | null = null;
    let unsubPlans: (() => void) | null = null;
    let unsubTargets: (() => void) | null = null;
    let unsubDeliveries: (() => void) | null = null;
    let unsubRolls: (() => void) | null = null;

    const setupSubscriptions = () => {
      if (!active) return;

      // 1. Sync Profiles
      unsubProfiles = onSnapshot(collection(db, 'profiles'), (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as UserProfile);
        });
        setProfiles(list);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'profiles');
      });

      // 2. Sync Stock Entries
      unsubStock = onSnapshot(collection(db, 'stock_entries'), (snapshot) => {
        const list: StockEntry[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as StockEntry);
        });
        // Sort desc by createdAt
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setStockEntries(list);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'stock_entries');
      });

      // 3. Sync Production Plans
      unsubPlans = onSnapshot(collection(db, 'production_plans'), (snapshot) => {
        const list: ProductionPlan[] = [];
        snapshot.forEach((doc) => {
          const plan = doc.data() as ProductionPlan;
          if (plan.machine) {
            if (plan.machine.startsWith('Big Machine')) {
              plan.machine = 'Big Machine';
            } else if (plan.machine.startsWith('Small Machine')) {
              plan.machine = 'Small Machine';
            }
          }
          list.push(plan);
        });
        // Sort desc by planDate / createdAt
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPlans(list);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'production_plans');
      });

      // 4. Sync Daily Targets
      unsubTargets = onSnapshot(doc(db, 'settings', 'daily_targets'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.targets) {
            setDailyTargets(data.targets);
          }
        }
        setDbLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'settings/daily_targets');
      });

      // 5. Sync Deliveries
      unsubDeliveries = onSnapshot(collection(db, 'deliveries'), (snapshot) => {
        const list: DeliveryEntry[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          let createdAtStr = '';
          if (data.createdAt) {
            if (typeof data.createdAt === 'string') {
              createdAtStr = data.createdAt;
            } else if (typeof data.createdAt.toDate === 'function') {
              createdAtStr = data.createdAt.toDate().toISOString();
            } else if (data.createdAt.seconds !== undefined) {
              createdAtStr = new Date(data.createdAt.seconds * 1000).toISOString();
            }
          }
          list.push({
            ...data,
            createdAt: createdAtStr || new Date().toISOString()
          } as DeliveryEntry);
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setDeliveries(list);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'deliveries');
      });

      // 6. Sync Material Rolls
      unsubRolls = onSnapshot(collection(db, 'rolls'), (snapshot) => {
        const list: RollEntry[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as RollEntry);
        });
        // Sort descending by registration ID (timestamp)
        list.sort((a, b) => b.id.localeCompare(a.id));
        setRolls(list);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'rolls');
      });
    };

    const initializeAndSubscribe = async () => {
      try {
        console.log("Starting DB initialization...");
        const initDocRef = doc(db, 'settings', 'init_status');
        let initDocSnap;
        try {
          initDocSnap = await getDoc(initDocRef);
          console.log("initDocSnap read successful:", initDocSnap.exists());
        } catch (e: any) {
          console.error("Error reading settings/init_status:", e);
          throw new Error("Failed at settings/init_status read: " + e.message);
        }

        if (!initDocSnap.exists()) {
          console.log("Seeding initial profiles and targets...");
          try {
            const batch = writeBatch(db);

            MOCK_PROFILES.forEach((profile) => {
              batch.set(doc(db, 'profiles', profile.id), profile);
            });

            const defaultTargets = {
              '2026-06-01': 250,
              '2026-06-02': 300,
              '2026-06-03': 300,
              '2026-06-04': 250,
              '2026-06-05': 300,
              '2026-06-06': 350,
              '2026-06-07': 300,
            };
            batch.set(doc(db, 'settings', 'daily_targets'), { targets: defaultTargets });
            batch.set(initDocRef, { seeded: true });

            await batch.commit();
            console.log("Seeding initial profiles and targets completed!");
          } catch (e: any) {
            console.error("Error seeding initial profiles/targets:", e);
            throw new Error("Failed at seeding initial profiles/targets batch: " + e.message);
          }
        }

        // ONE-TIME PURGE OF DEMO DATA FOR COMPANY PRODUCTION READINESS
        const cleanDocRef = doc(db, 'settings', 'production_cleaned_v1');
        let cleanDocSnap;
        try {
          cleanDocSnap = await getDoc(cleanDocRef);
          console.log("cleanDocSnap read successful:", cleanDocSnap.exists());
        } catch (e: any) {
          console.error("Error reading production_cleaned_v1:", e);
          throw new Error("Failed at production_cleaned_v1 read: " + e.message);
        }

        if (!cleanDocSnap.exists()) {
          console.log("Purging demo data...");
          try {
            const batch = writeBatch(db);

            const stockSnap = await getDocs(collection(db, 'stock_entries'));
            stockSnap.forEach((docSnap) => {
              batch.delete(docSnap.ref);
            });

            const plansSnap = await getDocs(collection(db, 'production_plans'));
            plansSnap.forEach((docSnap) => {
              batch.delete(docSnap.ref);
            });

            batch.set(cleanDocRef, { cleaned: true });
            await batch.commit();
            console.log("Purging demo data completed!");
            addToast("Database cleared and optimized for real production operations!", "success");
          } catch (e: any) {
            console.error("Error purging demo data:", e);
            throw new Error("Failed at purging demo data: " + e.message);
          }
        }

        // ONE-TIME CLEANUP OF SPECIFIC WORKERS: DELETING "SALAH" AND KEEPING ONLY MOUAD AND MOHAMED
        const cleanWorkersRef = doc(db, 'settings', 'workers_cleanup_v1');
        let cleanWorkersSnap;
        try {
          cleanWorkersSnap = await getDoc(cleanWorkersRef);
          console.log("cleanWorkersSnap read successful:", cleanWorkersSnap.exists());
        } catch (e: any) {
          console.error("Error reading workers_cleanup_v1:", e);
          throw new Error("Failed at workers_cleanup_v1 read: " + e.message);
        }

        if (!cleanWorkersSnap.exists()) {
          console.log("Cleaning up worker profiles...");
          try {
            const batch = writeBatch(db);
            const profilesSnap = await getDocs(collection(db, 'profiles'));
            let countDeleted = 0;
            profilesSnap.forEach((docSnap) => {
              const data = docSnap.data();
              if (data.role === 'worker') {
                const nameLower = (data.name || '').toLowerCase().trim();
                const userNameLower = (data.username || '').toLowerCase().trim();
                const isMohamed = nameLower === 'mohamed' || userNameLower === 'mohamed';
                const isMouad = nameLower === 'mouad' || userNameLower === 'mouad';
                if (!isMohamed && !isMouad) {
                  batch.delete(docSnap.ref);
                  countDeleted++;
                }
              }
            });
            batch.set(cleanWorkersRef, { cleaned: true, countDeleted });
            await batch.commit();
            console.log("Cleaning up worker profiles completed, deleted count:", countDeleted);
            if (countDeleted > 0) {
              addToast(`Database cleaned: Removed ${countDeleted} unrecognized worker profiles. Keeping only Mohamed and Mouad.`, "info");
            }
          } catch (e: any) {
            console.error("Error cleaning up worker profiles:", e);
            throw new Error("Failed at cleaning up worker profiles: " + e.message);
          }
        }

        // ONE-TIME SEEDING OF EXACT ROLLS DATA FROM SPREADSHEET
        const rollsSeedRef = doc(db, 'settings', 'rolls_stock_seed_v5');
        let rollsSeedSnap;
        try {
          rollsSeedSnap = await getDoc(rollsSeedRef);
          console.log("rollsSeedSnap read successful:", rollsSeedSnap.exists());
        } catch (e: any) {
          console.error("Error reading rolls_stock_seed_v5:", e);
          throw new Error("Failed at rolls_stock_seed_v5 read: " + e.message);
        }

        if (!rollsSeedSnap.exists()) {
          console.log("Seeding rolls stock from spreadsheet...");
          try {
            const batch = writeBatch(db);
            
            // Clear all existing rolls to ensure count matches exactly
            const rollsSnap = await getDocs(collection(db, 'rolls'));
            rollsSnap.forEach((docSnap) => {
              batch.delete(docSnap.ref);
            });
            
            const todayDate = new Date().toISOString().split('T')[0];

            // 1. Yellow Huesker (9 unopened rolls)
            for (let i = 1; i <= 9; i++) {
              const id = `roll-seed-yellow-${i}`;
              batch.set(doc(db, 'rolls', id), {
                id,
                materialName: 'Yellow Huesker',
                date: todayDate,
                status: 'Unopened',
                operator: 'Mohamed',
                createdBy: 'system',
                notes: `Initial stock seed - Roll #${i}`
              });
            }

            // 2. Kuga (7 unopened rolls)
            for (let i = 1; i <= 7; i++) {
              const id = `roll-seed-kuga-${i}`;
              batch.set(doc(db, 'rolls', id), {
                id,
                materialName: 'Kuga',
                date: todayDate,
                status: 'Unopened',
                operator: 'Mohamed',
                createdBy: 'system',
                notes: `Initial stock seed - Roll #${i}`
              });
            }

            // 3. White Huesker (4 unopened rolls)
            for (let i = 1; i <= 4; i++) {
              const id = `roll-seed-white-${i}`;
              batch.set(doc(db, 'rolls', id), {
                id,
                materialName: 'White Huesker',
                date: todayDate,
                status: 'Unopened',
                operator: 'Mohamed',
                createdBy: 'system',
                notes: `Initial stock seed - Roll #${i}`
              });
            }

            batch.set(rollsSeedRef, { seeded: true });
            await batch.commit();
            console.log("Seeding rolls stock completed!");
            addToast("Factory reserve rolls stock (9 Yellow Huesker, 7 Kuga, 4 White Huesker) successfully loaded into system!", "success");
          } catch (e: any) {
            console.error("Error seeding rolls stock:", e);
            throw new Error("Failed at seeding rolls stock: " + e.message);
          }
        }
      } catch (err: any) {
        console.error("Database initialization failed, subscribing anyway: ", err);
      } finally {
        setupSubscriptions();
      }
    };

    initializeAndSubscribe();

    return () => {
      active = false;
      if (unsubProfiles) unsubProfiles();
      if (unsubStock) unsubStock();
      if (unsubPlans) unsubPlans();
      if (unsubTargets) unsubTargets();
      if (unsubDeliveries) unsubDeliveries();
      if (unsubRolls) unsubRolls();
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('epp_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('epp_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // --- TOAST DISPATCHERS ---
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3500,
      timerProgressBar: true,
      background: '#0f172a', // slate-900
      color: '#e2e8f0', // slate-200
      iconColor: type === 'success' ? '#10b981' : type === 'error' ? '#f43f5e' : '#38bdf8',
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      },
      customClass: {
        popup: 'rounded-xl border border-slate-800 shadow-xl p-3 font-sans text-xs font-extrabold select-none'
      }
    });

    Toast.fire({
      icon: type,
      title: message
    });
  };

  const triggerNotification = async (
    title: string,
    body: string,
    category: 'delivery' | 'stock' | 'target' | 'plan' | 'system',
    targetRole: 'manager' | 'worker' | 'all' = 'all',
    targetUserId: string = ''
  ) => {
    try {
      const notifId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        title,
        body,
        createdAt: new Date().toISOString(),
        category,
        readBy: [],
        targetRole,
        targetUserId,
        createdBy: currentUser?.id || 'system'
      });
    } catch (err) {
      console.error('Failed to create notification document in Firestore:', err);
    }
  };

  // --- ACTIONS ---
  const handlePresetSelect = (profile: UserProfile) => {
    setCurrentUser(profile);
    setAuthError('');
    setActiveTab('dashboard');
    addToast(`Authenticated as ${profile.name} (${profile.role.toUpperCase()})`, 'success');
  };

  const handleEmailPasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!loginUsername || !loginPassword) {
      setAuthError('Please fill in both fields.');
      return;
    }

    // Direct mock correspondence
    let found = profiles.find((p) => p.username?.toLowerCase() === loginUsername.trim().toLowerCase() && p.password === loginPassword);
    
    // Fail-safe fallback to raw MOCK_PROFILES 
    if (!found) {
      const backupFound = MOCK_PROFILES.find((p) => p.username?.toLowerCase() === loginUsername.trim().toLowerCase() && p.password === loginPassword);
      if (backupFound) {
        found = backupFound;
        setProfiles((prev) => {
          const exists = prev.some((p) => p.id === backupFound.id);
          return exists ? prev : [...prev, backupFound];
        });
      }
    }

    if (found) {
      setCurrentUser(found);
      setActiveTab('dashboard');
      addToast(`Welcome back, ${found.name}!`, 'success');
    } else {
      setAuthError('Authentication failed. Incorrect username or password.');
    }
  };

  const handleRegisterProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!signUpName || !signUpUsername || !signUpPassword) {
      setAuthError('Operator Name, Username and Password are required.');
      return;
    }

    if (profiles.some((p) => p.username?.toLowerCase() === signUpUsername.trim().toLowerCase())) {
      setAuthError('Username is already taken.');
      return;
    }

    const newProfile: UserProfile = {
      id: `usr-${Date.now()}`,
      username: signUpUsername.trim().toLowerCase(),
      password: signUpPassword,
      name: signUpName.trim(),
      role: signUpRole,
      station: signUpStation ? signUpStation.trim() : (signUpRole === 'worker' ? 'Line Station X' : 'Main Center')
    };

    setDoc(doc(db, 'profiles', newProfile.id), newProfile)
      .then(() => {
        setCurrentUser(newProfile);
        setSignUpMode(false);
        setSignUpName('');
        setSignUpUsername('');
        setSignUpPassword('');
        setSignUpStation('');
        setActiveTab('dashboard');
        addToast(`Successfully registered and authenticated. Welcome, ${newProfile.name}!`, 'success');
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `profiles/${newProfile.id}`);
        setAuthError('Failed to register operator profile inside Cloud Database context.');
      });
  };

  const handleLogout = () => {
    addToast(`Session safely terminated. Goodbye, ${currentUser?.name}!`, 'info');
    setCurrentUser(null);
    setLoginUsername('');
    setLoginPassword('');
    setActiveTab('dashboard');
  };

  // --- CORE DATA MUTATORS ---
  const handleAddDelivery = (delivery: Omit<DeliveryEntry, 'id' | 'createdAt'>) => {
    const newDelivery: DeliveryEntry = {
      ...delivery,
      id: `del-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    setDoc(doc(db, 'deliveries', newDelivery.id), newDelivery)
      .then(() => {
        addToast(`Registered dispatch: Invoice ${delivery.invoiceNumber} shipped successfully!`, 'success');
        triggerNotification(
          '🚚 New Dispatch Shipment Shipped',
          `Invoice ${delivery.invoiceNumber}: Shipped ${delivery.quantity} units of airbag ${delivery.modelId} to client. Assigned carrier: ${delivery.loadedBy || 'Logistics'}.`,
          'delivery',
          'all'
        );
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `deliveries/${newDelivery.id}`);
        addToast('Failed to save delivery shipment log to Cloud Database.', 'error');
      });
  };

  const handleDeleteDelivery = (id: string) => {
    if (!currentUser || currentUser.role !== 'manager') {
      addToast('Security Block: Only managers are authorized to delete delivery entries.', 'error');
      return;
    }
    const delivery = deliveries.find((d) => d.id === id);
    if (!delivery) return;
    triggerCustomConfirm(
      'Confirm Delivery Removal',
      `Are you sure you want to permanently delete the delivery entry recording ${delivery.quantity} units of ${delivery.modelId}? This will restore those units to available stock levels.`,
      () => {
        deleteDoc(doc(db, 'deliveries', id))
          .then(() => {
            addToast(`Removed delivery of ${delivery.quantity} units of ${delivery.modelId} from records.`, 'success');
            triggerNotification(
              'Delivery Voided',
              `The dispatch record of ${delivery.quantity} units of ${delivery.modelId} (Invoice ${delivery.invoiceNumber}) was voided by ${currentUser?.name}.`,
              'delivery',
              'manager'
            );
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, `deliveries/${id}`);
            addToast('Failed to delete delivery entry from Cloud Database.', 'error');
          });
      }
    );
  };

  // --- LABEL GENERATOR HANDLERS ---

  const handleAddStockEntry = (entry: Omit<StockEntry, 'id' | 'createdAt'>) => {
    // Strip undefined keys to prevent Firestore crashes and parse numeric attributes robustly
    const cleanedEntry = Object.fromEntries(
      Object.entries(entry)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => {
          if (['quantity', 'originalQuantity', 'correctedQuantity', 'difference'].includes(k)) {
            return [k, typeof v === 'number' ? v : parseInt(String(v), 10) || 0];
          }
          return [k, v];
        })
    ) as any;

    const newEntry: StockEntry = {
      ...cleanedEntry,
      id: `se-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      createdAt: new Date().toISOString()
    };

    setDoc(doc(db, 'stock_entries', newEntry.id), newEntry)
      .then(() => {
        const isCorrection = newEntry.edited === true || newEntry.quantity < 0;
        const formattedQty = newEntry.quantity >= 0 ? `+${newEntry.quantity}` : `${newEntry.quantity}`;
        
        if (isCorrection) {
          addToast(`Stored stock adjustments: ${formattedQty} units of ${newEntry.modelId} corrected successfully!`, 'success');
          triggerNotification(
            '🔧 General Stock Corrected',
            `Manager ${newEntry.workerName} successfully adjusted available stockpile for ${newEntry.modelId} by ${formattedQty} pcs: "${newEntry.editReason || 'manual adjustment'}".`,
            'stock',
            'all'
          );
        } else {
          addToast(`Registered output level: +${newEntry.quantity} units of ${newEntry.modelId} saved!`, 'success');
          triggerNotification(
            '📦 Stock Logged in Inventory',
            `Worker ${newEntry.workerName} successfully submitted output log: +${newEntry.quantity} units of airbag ${newEntry.modelId} at ${newEntry.machine || 'Assembly Line'}.`,
            'stock',
            'all'
          );
        }
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `stock_entries/${newEntry.id}`);
        addToast('Failed to save stock entry to Cloud Database.', 'error');
      });
  };

  const handleUndoStockEntry = (id: string) => {
    const entry = stockEntries.find((e) => e.id === id);
    if (!entry) return;

    if (!currentUser) return;
    
    // Safety check: a worker can only undo their own entry
    if (currentUser.role === 'worker' && entry.workerName.toLowerCase().trim() !== currentUser.name.toLowerCase().trim()) {
      addToast('Security Block: You are not authorized to undo this entry.', 'error');
      return;
    }

    triggerCustomConfirm(
      'Confirm Undo Action',
      `Are you sure you want to undo your last entry of ${entry.quantity} units of ${entry.modelId}? This will remove the entry and subtract the progress from the plan.`,
      () => {
        deleteDoc(doc(db, 'stock_entries', id))
          .then(() => {
            addToast(`Successfully undone and removed ${entry.quantity} units of ${entry.modelId}.`, 'success');

            // Subtraction logic for the plan progress
            if (entry.planId) {
              const plan = plans.find((p) => p.id === entry.planId);
              if (plan) {
                const currentCompleted = plan.quantityCompleted || 0;
                const newCompleted = Math.max(0, currentCompleted - entry.quantity);
                const isNowCompleted = newCompleted >= plan.quantityPlanned;
                const newStatus = isNowCompleted ? 'Completed' : 'Pending';

                updateDoc(doc(db, 'production_plans', entry.planId), {
                  quantityCompleted: newCompleted,
                  status: newStatus
                }).catch((err) => {
                  console.error('Failed to subtract progress from production plan:', err);
                });
              }
            }

            triggerNotification(
              'Stock Entry Undone',
              `Worker ${entry.workerName} undid their last stock entry of ${entry.quantity} units for model ${entry.modelId}.`,
              'stock',
              'all'
            );
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, `stock_entries/${id}`);
            addToast('Failed to undo stock entry from Cloud Database.', 'error');
          });
      }
    );
  };

  const handleDeleteStockEntry = (id: string) => {
    if (!currentUser || currentUser.role !== 'manager') {
      addToast('Security Block: Only managers are authorized to delete stock entries.', 'error');
      return;
    }
    const entry = stockEntries.find((e) => e.id === id);
    if (!entry) return;
    triggerCustomConfirm(
      'Confirm Entry Removal',
      `Are you sure you want to permanently delete the stock entry recording ${entry.quantity} units of ${entry.modelId}?`,
      () => {
        deleteDoc(doc(db, 'stock_entries', id))
          .then(() => {
            addToast(`Removed ${entry.quantity} units of ${entry.modelId} from stockpile records.`, 'success');
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, `stock_entries/${id}`);
            addToast('Failed to remove stock entry from Cloud Database.', 'error');
          });
      }
    );
  };

  const handleEditStockEntry = (id: string, updatedEntry: Partial<StockEntry>) => {
    if (!currentUser || currentUser.role !== 'manager') {
      addToast('Security Block: Only managers are authorized to update stock specifications or quantities.', 'error');
      return;
    }
    const finalUpdate = {
      ...updatedEntry,
      editedAt: serverTimestamp()
    };
    updateDoc(doc(db, 'stock_entries', id), finalUpdate)
      .then(() => {
        addToast('Successfully registered and stored stock correction!', 'success');
        const entry = stockEntries.find(e => e.id === id);
        if (entry) {
          triggerNotification(
            'Stock Entry Corrected',
            `Manager ${currentUser?.name} updated Stockholm log for ${entry.modelId} (from ${finalUpdate.originalQuantity} to ${finalUpdate.quantity} pcs).`,
            'stock',
            'manager'
          );
        }
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `stock_entries/${id}`);
        addToast('Failed to update stock entry inside Cloud Database.', 'error');
      });
  };

  const handleAddProductionPlan = (plan: Omit<ProductionPlan, 'id' | 'createdAt' | 'status'>) => {
    // Construct the production plan explicitly, leaving out optional keys if undefined
    const newPlan: any = {
      id: `pl-${Date.now()}`,
      planDate: plan.planDate,
      machine: plan.machine,
      shift: plan.shift,
      model: plan.model,
      quantityPlanned: plan.quantityPlanned,
      quantityCompleted: 0,
      assignedWorker: plan.assignedWorker,
      createdBy: plan.createdBy,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    if (plan.notes !== undefined && plan.notes.trim() !== '') {
      newPlan.notes = plan.notes.trim();
    }

    setDoc(doc(db, 'production_plans', newPlan.id), newPlan as ProductionPlan)
      .then(() => {
        addToast(`Successfully authorized production target of ${plan.quantityPlanned} units of ${plan.model}!`, 'success');
        triggerNotification(
          '📅 New Production Plan Assigned',
          `Plan created for ${plan.quantityPlanned} units of ${plan.model} on Machine ${plan.machine || 'Assembly'}. Worker assigned: ${plan.assignedWorker || 'Unassigned'}.`,
          'plan',
          'all'
        );
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `production_plans/${newPlan.id}`);
        addToast('Failed to save production plan to Cloud Database.', 'error');
      });
  };

  const handleUpdatePlanStatus = (id: string, status: 'Pending' | 'Completed' | 'Delayed') => {
    updateDoc(doc(db, 'production_plans', id), { status })
      .then(() => {
        addToast(`Marked plan target status as ${status.toUpperCase()}!`, 'success');
        const plan = plans.find(p => p.id === id);
        if (plan) {
          triggerNotification(
            `Plan Status Update: ${status}`,
            `The production plan for ${plan.model} (${plan.quantityPlanned} units) has been marked as ${status}.`,
            'plan',
            'all'
          );
        }
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `production_plans/${id}`);
        addToast('Failed to update plan status in Cloud Database.', 'error');
      });
  };

  const handleUpdatePlanProgress = (id: string, additionalQuantity: number) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;

    const currentCompleted = plan.quantityCompleted || 0;
    const newCompleted = currentCompleted + additionalQuantity;
    const isNowCompleted = newCompleted >= plan.quantityPlanned;
    const newStatus = isNowCompleted ? 'Completed' : plan.status;

    updateDoc(doc(db, 'production_plans', id), {
      quantityCompleted: newCompleted,
      status: newStatus
    })
      .then(() => {
        addToast(`Successfully logged +${additionalQuantity} units of ${plan.model}! Progress: ${newCompleted}/${plan.quantityPlanned}`, 'success');
        const isNowCompleted = newCompleted >= plan.quantityPlanned;
        if (isNowCompleted) {
          triggerNotification(
            '🎯 Plan Target Achieved!',
            `Excellent! Worker completed the assigned plan of ${plan.quantityPlanned} units of ${plan.model}!`,
            'target',
            'all'
          );
        } else {
          triggerNotification(
            '📈 Production Progress Tracked',
            `Progress logged for ${plan.model} on Machine ${plan.machine || 'Assembly Line'}: ${newCompleted}/${plan.quantityPlanned} units compiled.`,
            'plan',
            'all'
          );
        }
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `production_plans/${id}`);
        addToast('Failed to update progress in Cloud Database.', 'error');
      });
  };

  const handleEditProductionPlan = (id: string, updatedPlan: Partial<Omit<ProductionPlan, 'id' | 'createdAt'>>) => {
    const updatePayload: any = { ...updatedPlan };
    if (updatePayload.notes !== undefined) {
      updatePayload.notes = updatePayload.notes.trim() === '' ? '' : updatePayload.notes.trim();
    }
    updateDoc(doc(db, 'production_plans', id), updatePayload)
      .then(() => {
        addToast('Successfully updated the production plan specifications!', 'success');
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `production_plans/${id}`);
        addToast('Failed to update plan details in Cloud Database.', 'error');
      });
  };

  const handleDeleteProductionPlan = (id: string) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    triggerCustomConfirm(
      'Delete Shift Schedule',
      `Remove the scheduled shift target for ${plan.model} (${plan.quantityPlanned} planned units) from planning whiteboard?`,
      () => {
        deleteDoc(doc(db, 'production_plans', id))
          .then(() => {
            addToast(`Successfully removed scheduled target of ${plan.quantityPlanned} units from planning whiteboard.`, 'success');
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, `production_plans/${id}`);
            addToast('Failed to remove production plan from Cloud Database.', 'error');
          });
      }
    );
  };

  const handleBulkAddProductionPlans = (newPlans: Omit<ProductionPlan, 'id' | 'createdAt'>[]) => {
    if (newPlans.length === 0) return;
    const batch = writeBatch(db);
    newPlans.forEach((plan) => {
      const id = `pl-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const item: ProductionPlan = {
        ...plan,
        id,
        status: plan.status || 'Pending',
        quantityCompleted: plan.quantityCompleted || 0,
        createdAt: new Date().toISOString()
      };
      batch.set(doc(db, 'production_plans', id), item);
    });

    batch.commit()
      .then(() => {
        addToast(`Successfully duplicated and initialized ${newPlans.length} production plans!`, 'success');
        triggerNotification(
          '📅 Bulk Production Plans Created',
          `Manager created/duplicated ${newPlans.length} plans on the planning whiteboard.`,
          'plan',
          'all'
        );
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, 'production_plans/bulk');
        addToast('Failed to batch save production plans to Cloud Database.', 'error');
      });
  };

  const handleBulkDeleteProductionPlans = (ids: string[]) => {
    if (ids.length === 0) return;
    triggerCustomConfirm(
      'Confirm Bulk Deletion',
      `Are you sure you want to permanently delete ${ids.length} selected production plans? This action cannot be undone.`,
      () => {
        const batch = writeBatch(db);
        ids.forEach((id) => {
          batch.delete(doc(db, 'production_plans', id));
        });

        batch.commit()
          .then(() => {
            addToast(`Successfully removed ${ids.length} production plans from whiteboard.`, 'success');
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, 'production_plans/bulk');
            addToast('Failed to bulk delete production plans from Cloud Database.', 'error');
          });
      }
    );
  };

  // --- FASTER ROLLS MATERIAL TRACEABILITY ENGINE HANDLERS ---
  const handleAddRoll = (roll: Omit<RollEntry, 'id'>) => {
    const newRoll: RollEntry = {
      ...roll,
      id: `roll-${Date.now()}`,
      openedAt: roll.status === 'Active' ? new Date().toISOString() : undefined
    };

    setDoc(doc(db, 'rolls', newRoll.id), newRoll)
      .then(() => {
        const statusMsg = roll.status === 'Active' ? 'opened and registered' : 'added to unopened stock';
        addToast(`Successfully ${statusMsg} material roll: ${roll.materialName}!`, 'success');
        triggerNotification(
          roll.status === 'Active' ? '🧵 Fabric Roll Opened' : '📦 New Roll in Stock',
          roll.status === 'Active' 
            ? `Operator ${roll.operator} has opened a new roll of ${roll.materialName} (Barcode: ${roll.barcode}).`
            : `Operator ${roll.operator} has registered an unopened roll of ${roll.materialName} (Barcode: ${roll.barcode}) into factory reserve.`,
          'system',
          'all'
        );
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `rolls/${newRoll.id}`);
        addToast('Failed to register material roll.', 'error');
      });
  };

  const handleOpenRoll = (id: string, barcode: string) => {
    const roll = rolls.find((r) => r.id === id);
    if (!roll) return;

    const updates: Partial<RollEntry> = {
      status: 'Active',
      openedAt: new Date().toISOString(),
      operator: currentUser?.name || roll.operator,
      barcode: barcode.trim()
    };

    updateDoc(doc(db, 'rolls', id), updates)
      .then(() => {
        addToast(`Roll ${roll.materialName} (${barcode}) has been opened for production!`, 'success');
        triggerNotification(
          '🧵 Fabric Roll Opened',
          `Roll ${roll.materialName} (Barcode: ${barcode}) is now ACTIVE and being consumed.`,
          'system',
          'all'
        );
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `rolls/${id}`);
        addToast('Failed to open material roll.', 'error');
      });
  };

  const handleConsumeRoll = (id: string, consumedMeters: number, notes?: string) => {
    const roll = rolls.find((r) => r.id === id);
    if (!roll) return;

    const updates: Partial<RollEntry> = {
      status: 'Consumed',
      closedAt: new Date().toISOString(),
      closedBy: currentUser?.name || 'Unknown',
      consumedMeters: consumedMeters,
      notes: notes || roll.notes || ''
    };

    updateDoc(doc(db, 'rolls', id), updates)
      .then(() => {
        addToast(`Roll ${roll.materialName} marked as fully consumed!`, 'success');
        triggerNotification(
          '🧵 Fabric Roll Consumed',
          `Roll ${roll.materialName} (Serial/Barcode: ${roll.barcode}) was set to fully spent. Consumed length: ${consumedMeters}m.`,
          'system',
          'all'
        );
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `rolls/${id}`);
        addToast('Failed to update roll consumption status.', 'error');
      });
  };

  const handleDeleteRoll = (id: string) => {
    if (!currentUser) return;
    const roll = rolls.find((r) => r.id === id);
    if (!roll) return;

    triggerCustomConfirm(
      'Confirm Roll Record Removal',
      `Are you sure you want to permanently delete the traceability record for ${roll.materialName} (${roll.barcode || 'Pending Barcode'})? This action cannot be undone.`,
      () => {
        deleteDoc(doc(db, 'rolls', id))
          .then(() => {
            addToast(`Traceability log for roll ${roll.barcode || roll.materialName} has been deleted.`, 'success');
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, `rolls/${id}`);
            addToast('Failed to delete roll record from Cloud Database.', 'error');
          });
      }
    );
  };

  const handleUpdateRoll = (id: string, updates: Partial<RollEntry>) => {
    const roll = rolls.find((r) => r.id === id);
    if (!roll) return;

    // Build the final update map
    const finalUpdates: Partial<RollEntry> = {
      ...updates
    };

    // If status changed to Active and there's no openedAt, set it
    if (updates.status === 'Active' && !roll.openedAt) {
      finalUpdates.openedAt = new Date().toISOString();
    }
    // If status changed to Consumed and there's no closedAt, set it
    if (updates.status === 'Consumed' && !roll.closedAt) {
      finalUpdates.closedAt = new Date().toISOString();
      finalUpdates.closedBy = currentUser?.name || 'Unknown';
    }

    updateDoc(doc(db, 'rolls', id), finalUpdates)
      .then(() => {
        addToast(`Successfully updated roll ${roll.materialName} record!`, 'success');
        triggerNotification(
          '🧵 Fabric Roll Updated',
          `Roll ${roll.materialName} record was updated in the database by ${currentUser?.name}.`,
          'system',
          'all'
        );
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `rolls/${id}`);
        addToast('Failed to update roll record.', 'error');
      });
  };

  const handleUpdateDailyTarget = (dateStr: string, targetValue: number) => {
    const newTargets = {
      ...dailyTargets,
      [dateStr]: targetValue
    };
    setDoc(doc(db, 'settings', 'daily_targets'), { targets: newTargets })
      .catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, 'settings/daily_targets');
        addToast('Failed to update daily targets in Cloud Database.', 'error');
      });
  };

  const handleClearStockEntries = () => {
    triggerCustomConfirm(
      'Purge Stock stockpile Ledger',
      'Are you absolutely sure you want to permanently clear all stock entries in the ledger? This action cannot be undone.',
      () => {
        const batch = writeBatch(db);
        stockEntries.forEach((e) => {
          batch.delete(doc(db, 'stock_entries', e.id));
        });
        batch.commit()
          .then(() => {
            addToast('Manufactured stock stockpile ledger cleared successfully.', 'success');
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, 'stock_entries');
            addToast('Failed to clear stock entries from Cloud Database.', 'error');
          });
      }
    );
  };

  const handleClearProductionPlans = () => {
    triggerCustomConfirm(
      'Wipe Shift Schedules',
      'Are you sure you want to permanently clear all production plans? This action cannot be undone.',
      () => {
        const batch = writeBatch(db);
        plans.forEach((p) => {
          batch.delete(doc(db, 'production_plans', p.id));
        });
        batch.commit()
          .then(() => {
            addToast('Production schedule plans cleared successfully. All scheduled week matrix entries have been cleaned.', 'success');
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, 'production_plans');
            addToast('Failed to clear production plans from Cloud Database.', 'error');
          });
      }
    );
  };

  const handleResetDatabaseDefaults = () => {
    triggerCustomConfirm(
      'Restore Factory Defaults',
      'Are you sure you want to restore the stock ledger, targets, and schedules to original presets?',
      () => {
        const batch = writeBatch(db);
        stockEntries.forEach((e) => batch.delete(doc(db, 'stock_entries', e.id)));
        plans.forEach((p) => batch.delete(doc(db, 'production_plans', p.id)));

        INITIAL_STOCK_ENTRIES.forEach((e) => batch.set(doc(db, 'stock_entries', e.id), e));
        INITIAL_PLANS.forEach((p) => batch.set(doc(db, 'production_plans', p.id), p));
        batch.set(doc(db, 'settings', 'daily_targets'), {
          targets: {
            '2026-06-01': 250,
            '2026-06-02': 300,
            '2026-06-03': 300,
            '2026-06-04': 250,
            '2026-06-05': 300,
            '2026-06-06': 350,
            '2026-06-07': 300,
          }
        });

        batch.commit()
          .then(() => {
            addToast('System database restored to demo presets.', 'success');
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, 'batch_reset');
            addToast('Failed to restore factory defaults.', 'error');
          });
      }
    );
  };

  // Switch views cleanly
  const renderTabContent = () => {
    if (!currentUser) return null;

    switch (activeTab) {
      case 'dashboard':
        return currentUser.role === 'manager' ? (
          <ManagerDashboard
            currentUser={currentUser}
            entries={stockEntries}
            deliveries={deliveries}
            plans={plans}
            dailyTargets={dailyTargets}
            onNavigate={(tab) => setActiveTab(tab)}
            onUpdatePlanStatus={handleUpdatePlanStatus}
            onDeletePlan={handleDeleteProductionPlan}
            onDeleteStockEntry={handleDeleteStockEntry}
            onClearStock={handleClearStockEntries}
            onClearPlans={handleClearProductionPlans}
            onResetDefaults={handleResetDatabaseDefaults}
          />
        ) : (
          <WorkerDashboard
            currentUser={currentUser}
            entries={stockEntries}
            plans={plans}
            dailyTargets={dailyTargets}
            onNavigate={(tab) => setActiveTab(tab)}
            onUpdatePlanStatus={handleUpdatePlanStatus}
            onUpdatePlanProgress={handleUpdatePlanProgress}
            onAddStockEntry={handleAddStockEntry}
            onUndoStockEntry={handleUndoStockEntry}
          />
        );

      case 'stock':
        return (
          <StockManagement
            currentUser={currentUser}
            entries={stockEntries}
            deliveries={deliveries}
            plans={plans}
            profiles={profiles}
            onAddEntry={handleAddStockEntry}
            onDeleteEntry={handleDeleteStockEntry}
            onEditEntry={handleEditStockEntry}
            onUndoEntry={handleUndoStockEntry}
          />
        );

      case 'plans':
        return (
          <PlanningModule
            currentUser={currentUser}
            plans={plans}
            entries={stockEntries}
            dailyTargets={dailyTargets}
            profiles={profiles}
            onUpdateDailyTarget={handleUpdateDailyTarget}
            onAddPlan={handleAddProductionPlan}
            onUpdatePlanStatus={handleUpdatePlanStatus}
            onDeletePlan={handleDeleteProductionPlan}
            onEditPlan={handleEditProductionPlan}
            onBulkAddPlans={handleBulkAddProductionPlans}
            onBulkDeletePlans={handleBulkDeleteProductionPlans}
          />
        );

      case 'delivery':
        return (
          <DeliveryModule
            currentUser={currentUser}
            entries={stockEntries}
            deliveries={deliveries}
            profiles={profiles}
            onAddDelivery={handleAddDelivery}
            onDeleteDelivery={handleDeleteDelivery}
          />
        );

      case 'label_printer':
        return (
          <LabelGenerator
            currentUser={currentUser}
          />
        );

      case 'rolls':
        return (
          <RollsModule
            currentUser={currentUser}
            rolls={rolls}
            onAddRoll={handleAddRoll}
            onOpenRoll={handleOpenRoll}
            onConsumeRoll={handleConsumeRoll}
            onDeleteRoll={handleDeleteRoll}
            onUpdateRoll={handleUpdateRoll}
          />
        );

      default:
        return (
          <div className="p-8 text-center text-slate-400">
            Resource route not configured.
          </div>
        );
    }
  };

  // Side Navigation Menu definitions
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stock', label: 'Stock', icon: Database },
    { id: 'plans', label: 'Production Plan', icon: CalendarRange },
    { id: 'rolls', label: 'Material Rolls', icon: Scroll },
    { id: 'delivery', label: 'Deliveries', icon: Truck },
    { id: 'label_printer', label: 'Label Printer', icon: Printer }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased font-sans transition-colors duration-300">
      
      {/* RENDER AUTHENTICATION WALL IF USER IS LOGGED OUT */}
      {dbLoading ? (
        <div className="flex-1 flex flex-col justify-center items-center bg-slate-900 min-h-screen">
          <div className="space-y-4 text-center">
            <div className="relative inline-block w-16 h-16">
              <div className="w-16 h-16 border-4 border-emerald-500/25 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-sm font-bold tracking-widest text-slate-100 uppercase font-mono">
              Connecting Cloud Database...
            </h2>
            <p className="text-xs text-slate-400 font-medium font-sans">
              Initializing EPP Airbag manufacturing whiteboard environment.
            </p>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {!currentUser ? (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col md:flex-row min-h-screen bg-slate-50 select-none overflow-hidden"
            id="auth-wall"
          >
            {/* LEFT BOARD - HERO DECORATOR */}
            <div className="flex-1 bg-slate-900 p-8 md:p-16 flex flex-col justify-between relative border-r border-slate-850" id="hero-auth-decorator">
              {/* Abs mesh circles decoration */}
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex justify-center items-center relative">
                <img 
                  src="https://www.eppnatur.es/media/yootheme/cache/1c/logo_eppnatur_3-1ce587ca.webp" 
                  alt="EPP Logo"
                  className="h-16 md:h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-transform duration-300 hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="space-y-6 max-w-xl mx-auto text-center relative my-auto">
                <h1 className="text-4xl md:text-[3.25rem] font-black font-display text-white tracking-tight leading-none text-center">
                  Line Efficiency. <br />
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent drop-shadow-xs">
                    Integrated.
                  </span>
                </h1>
                <p className="text-sm md:text-base text-slate-300/95 leading-relaxed text-center font-normal max-w-md mx-auto">
                  The central digital workspace for airbag production management. Coherent stock records, optimal machine layout, and effortless live monitoring.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live Dashboard Active
                  </span>
                </div>
              </div>


            </div>

            {/* RIGHT BOARD - CREDENTIALS WALL */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12" id="credentials-wall">
              <div className="w-full max-w-md space-y-8">
                
                {/* EMAIL / OR SIGN UP INTERFACES */}
                <div className="bg-white border border-slate-200 shadow-xs p-6 rounded-2xl space-y-4" id="credential-form-shell">
                  <div className="text-center pb-2 border-b border-slate-200">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-slate-900 font-sans">
                      Authenticate User
                    </span>
                  </div>

                  {authError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs flex items-center gap-2" id="auth-error-output">
                      <AlertCircle size={15} className="shrink-0" />
                      <span className="font-semibold leading-normal">{authError}</span>
                    </div>
                  )}

                  {!signUpMode ? (
                    /* SIGN IN MODE */
                    <form onSubmit={handleEmailPasswordLogin} className="space-y-4" id="signin-credentials-form">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1">
                          <User size={12} /> Username
                        </label>
                        <input
                          type="text"
                          placeholder=""
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:outline-hidden text-xs py-2.5 px-3.5 rounded-xl text-slate-800 font-medium shadow-3xs"
                          required
                          id="signin-username"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1">
                          <KeyRound size={12} /> Password
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:outline-hidden text-xs py-2.5 px-3.5 rounded-xl text-slate-800 font-medium shadow-3xs"
                          required
                          id="signin-password"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                        id="signin-submit"
                      >
                        Sign In
                      </button>
                    </form>
                  ) : (
                    /* CONJOIN ROSTER SIGN-UP MODE */
                    <form onSubmit={handleRegisterProfile} className="space-y-3" id="signup-credentials-form">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Full Name</label>
                        <input
                          type="text"
                          placeholder=""
                          value={signUpName}
                          onChange={(e) => setSignUpName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:outline-hidden text-xs py-2.5 px-3.5 rounded-xl text-slate-800 font-medium shadow-3xs"
                          required
                          id="signup-name"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Username</label>
                          <input
                            type="text"
                            placeholder=""
                            value={signUpUsername}
                            onChange={(e) => setSignUpUsername(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:outline-hidden text-xs py-2.5 px-3.5 rounded-xl text-slate-800 font-mono shadow-3xs"
                            required
                            id="signup-username"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Password</label>
                          <input
                            type="password"
                            placeholder="password@epp"
                            value={signUpPassword}
                            onChange={(e) => setSignUpPassword(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:outline-hidden text-xs py-2.5 px-3.5 rounded-xl text-slate-800 shadow-3xs"
                            required
                            id="signup-password"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Portal Role</label>
                          <select
                            value={signUpRole}
                            onChange={(e) => setSignUpRole(e.target.value as any)}
                            className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:outline-hidden text-xs py-2.5 px-3 rounded-lg text-slate-700 cursor-pointer shadow-3xs"
                            id="signup-role"
                          >
                            <option value="worker">Worker / Operator</option>
                            <option value="manager">Manager / Admin</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Line Workstation</label>
                          <input
                            type="text"
                            placeholder="e.g. Line A (Big)"
                            value={signUpStation}
                            onChange={(e) => setSignUpStation(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:outline-hidden text-xs py-2.5 px-3.5 rounded-xl text-slate-800 shadow-3xs"
                            id="signup-station"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                        id="signup-submit"
                      >
                        Complete Registration & Log In
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* INTERNAL LAYOUT DRAWER FRAME IF USER IS AUTHENTICATED */
          <motion.div
            key="app-main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col md:flex-row min-h-screen bg-slate-50 text-slate-900"
            id="app-interior"
          >
            {/* SIDE PANEL NAVIGATION FOR DESKTOP */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-850 px-4 py-8 justify-between shrink-0" id="desktop-sidebar">
              <div className="space-y-8">
                {/* Logo lock - Brand webp logo */}
                <div className="flex justify-center px-2">
                  <img 
                    src="https://www.eppnatur.es/media/yootheme/cache/1c/logo_eppnatur_3-1ce587ca.webp" 
                    alt="EPP Logo"
                    className="h-14 md:h-16 w-auto object-contain animate-fadeIn drop-shadow-md transition-transform duration-300 hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* User avatar bar summary */}
                <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs border ${
                      currentUser.role === 'manager' 
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                        : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    }`}>
                      {currentUser.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-white truncate pr-1 text-[11.5px]">
                        {currentUser.name}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize flex items-center gap-1 mt-0.5 font-semibold font-mono">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          currentUser.role === 'manager' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        {currentUser.role}
                      </div>
                    </div>
                  </div>

                  {/* Top quick-access logout button */}
                  <button
                    onClick={handleLogout}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-350 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                    title="Log Out Immediately"
                    id="top-sidebar-logout-btn"
                  >
                    <LogOut size={13} />
                  </button>
                </div>

                {/* Navigation Options list */}
                <nav className="space-y-1.5">
                  {navigationItems.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full text-left py-3 px-3 rounded-lg text-xs font-semibold flex items-center gap-3 transition-all duration-200 cursor-pointer border ${
                          isActive
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                        id={`nav-tab-${item.id}`}
                      >
                        <IconComponent size={15.5} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Foot logout lever */}
              <div>
                <button
                  onClick={handleLogout}
                  className="w-full py-3 px-3.5 bg-slate-950/60 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-rose-450 rounded-lg text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer"
                  id="nav-logout-btn"
                >
                  <LogOut size={15.5} className="text-slate-400 group-hover:text-rose-400 transition-colors" />
                  Log Out
                </button>
              </div>
            </aside>

            {/* HEADER ACCENTS FOR RESPONSIVE MOBILE VIEW */}
            <header className="md:hidden bg-slate-900 border-b border-slate-800 px-3 py-3 shrink-0 flex items-center justify-between" id="mobile-header">
              <div className="flex items-center gap-1.5">
                <img 
                  src="https://www.eppnatur.es/media/yootheme/cache/1c/logo_eppnatur_3-1ce587ca.webp" 
                  alt="EPP Logo"
                  className="h-7 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Quick Section Switcher Dropdown */}
              <div className="flex items-center gap-1.5">
                {!isInstalled && (
                  <button
                    onClick={handleInstallApp}
                    className="flex items-center gap-1 py-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-[10.5px] font-black transition cursor-pointer shadow-sm active:scale-95 shrink-0"
                    title="Install EPP App"
                    id="mobile-header-install-btn"
                  >
                    <Download size={11.5} className="animate-bounce" />
                    <span>Install</span>
                  </button>
                )}
                <NotificationCenter currentUser={currentUser} setActiveTab={setActiveTab} />
                <div className="relative" id="mobile-section-quicknav-container">
                  <button
                    onClick={() => setQuickNavOpen(!quickNavOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-750 text-emerald-400 text-2xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                    id="mobile-nav-selector-dropdown-btn"
                  >
                    <span>{navigationItems.find(n => n.id === activeTab)?.label}</span>
                    <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${quickNavOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {quickNavOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-45 bg-transparent" 
                          onClick={() => setQuickNavOpen(false)} 
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -8 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden"
                          id="mobile-quick-nav-dropdown"
                        >
                          <div className="px-3 py-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono border-b border-slate-850">
                            Switch Section
                          </div>
                          {navigationItems.map((item) => {
                            const IconComponent = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setActiveTab(item.id);
                                  setQuickNavOpen(false);
                                }}
                                className={`w-full text-left py-2.5 px-3.5 text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                                  isActive
                                    ? 'bg-emerald-500/10 text-emerald-400 font-bold border-l-2 border-emerald-500'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                              >
                                <IconComponent size={13.5} className={isActive ? 'text-emerald-400' : 'text-slate-450'} />
                                <span>{item.label}</span>
                              </button>
                            );
                          })}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 hover:text-rose-400 rounded-xl transition cursor-pointer flex items-center justify-center shadow-sm"
                  title="Log Out"
                  id="mobile-header-logout-btn"
                >
                  <LogOut size={15} />
                </button>

                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-755 text-slate-350 hover:text-white rounded-xl transition cursor-pointer"
                  aria-label="Toggle navigation drawers"
                  id="mobile-drawer-toggle"
                >
                  {mobileMenuOpen ? <X size={15} /> : <Menu size={15} />}
                </button>
              </div>
            </header>

            {/* MOBILE NAV DRAWER OVERLAY & SIDEBAR WITH ANIMATION */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setMobileMenuOpen(false)}
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden"
                    id="mobile-drawer-backdrop"
                  />

                  {/* Left Slide-in Drawer */}
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                    className="fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 md:hidden flex flex-col justify-between px-5 py-6 shadow-2xl"
                    id="mobile-navigation-drawer"
                  >
                    <div className="space-y-6">
                      {/* Brand Logo Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-2.5">
                          <img 
                            src="https://www.eppnatur.es/media/yootheme/cache/1c/logo_eppnatur_3-1ce587ca.webp" 
                            alt="EPP Logo"
                            className="h-10 w-auto object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="font-display font-black text-xs tracking-wider text-slate-200 block">EPP SYSTEM</span>
                            <span className="text-[9px] uppercase font-bold text-slate-450 leading-none">MES HUB</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-1.5 bg-slate-800/65 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                          aria-label="Close menu"
                        >
                          <X size={15} strokeWidth={2.5} />
                        </button>
                      </div>

                      {/* Active profile section */}
                      <div className="bg-slate-950/75 p-3 rounded-2xl border border-slate-800 flex items-center gap-3">
                        <div className={`w-8.5 h-8.5 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs border ${
                          currentUser.role === 'manager' 
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        }`}>
                          {currentUser.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-xs font-bold text-white truncate text-[11.5px]">
                            {currentUser.name}
                          </div>
                          <div className="text-[10px] text-slate-450 capitalize flex items-center gap-1 mt-0.5 font-bold font-mono">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              currentUser.role === 'manager' ? 'bg-amber-400' : 'bg-emerald-400'
                            }`} />
                            {currentUser.role}
                          </div>
                        </div>
                      </div>

                      {/* EPP App Install Booster CTA */}
                      {!isInstalled && (
                        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-3.5 rounded-2xl border border-amber-500/20 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="p-1.5 bg-amber-500/15 text-amber-500 rounded-lg shrink-0">
                              <Download size={12} className="animate-pulse" />
                            </div>
                            <div>
                              <h4 className="text-[10.5px] font-black text-slate-200 uppercase tracking-wider">Install EPP System</h4>
                              <p className="text-[9px] text-slate-400 font-medium leading-tight mt-0.5">
                                Add to home screen for fullscreen layout, native alerts & distraction-free view.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              handleInstallApp();
                            }}
                            className="w-full py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            id="mobile-drawer-install-btn"
                          >
                            <Download size={10.5} />
                            Get Mobile App
                          </button>
                        </div>
                      )}

                      {/* Menu navigation options */}
                      <nav className="space-y-1.5">
                        {navigationItems.map((item) => {
                          const IconComponent = item.icon;
                          const isActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id);
                                setMobileMenuOpen(false);
                              }}
                              className={`w-full text-left py-3 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-3 border transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold'
                                  : 'bg-transparent border-transparent text-slate-405 hover:text-slate-205 hover:bg-slate-800/40'
                              }`}
                              id={`mobile-nav-tab-${item.id}`}
                            >
                              <IconComponent size={15} className={isActive ? 'text-emerald-400' : 'text-slate-450'} />
                              {item.label}
                            </button>
                          );
                        })}
                      </nav>
                    </div>

                    {/* Exit Signoff controls */}
                    <div className="border-t border-slate-800 pt-4">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-900/25 rounded-xl text-xs font-black flex items-center justify-between transition-colors cursor-pointer"
                        id="mobile-drawer-logout"
                      >
                        <span className="flex items-center gap-2">
                          <LogOut size={15} className="text-white" />
                          Log Out of MES
                        </span>
                        <ChevronRight size={14} className="text-rose-100" />
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* PRIMARY VIEWBOARD PANEL */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8" id="primary-viewboard">
              {/* Elegant Desktop Header with Section Information & Alerts Center */}
              <header className="hidden md:flex items-center justify-between border-b border-slate-200 pb-5" id="desktop-viewboard-header">
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest font-sans">
                    {navigationItems.find(n => n.id === activeTab)?.label}
                  </h2>
                  <p className="text-xs text-slate-500 font-bold font-sans mt-1">
                    Logged in as <span className="text-emerald-600 font-extrabold">{currentUser.name}</span> in the <span className="capitalize text-slate-800 font-extrabold">{currentUser.role}</span> view workspace.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <NotificationCenter currentUser={currentUser} setActiveTab={setActiveTab} />
                </div>
              </header>

              {renderTabContent()}

              {/* Foreground / Background push subscription prompt card overlay */}
              <NotificationPermissionPrompt currentUser={currentUser} />
            </main>

          </motion.div>
        )}
      </AnimatePresence>
      )}
    </div>
  );
}
