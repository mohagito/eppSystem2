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
  MonitorCheck,
  AlertCircle,
  Truck
} from 'lucide-react';
import { UserProfile, StockEntry, ProductionPlan, ToastMessage, DeliveryEntry } from './types';
import { MOCK_PROFILES, INITIAL_STOCK_ENTRIES, INITIAL_PLANS } from './data';
import Notification from './components/Notification';
import WorkerDashboard from './components/WorkerDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import StockManagement from './components/StockManagement';
import PlanningModule from './components/PlanningModule';
import DeliveryModule from './components/DeliveryModule';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, getDoc, getDocs } from 'firebase/firestore';

export default function App() {
  // --- DATABASE AND LOCAL STORAGE PERSISTENCE ---
  const [dbLoading, setDbLoading] = useState<boolean>(true);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryEntry[]>([]);

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
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

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
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirmAction();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
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

  // Toast Notification State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // --- REAL-TIME CLOUD FIRESTORE SYNCHRONIZATION ---
  useEffect(() => {
    let active = true;
    let unsubProfiles: (() => void) | null = null;
    let unsubStock: (() => void) | null = null;
    let unsubPlans: (() => void) | null = null;
    let unsubTargets: (() => void) | null = null;
    let unsubDeliveries: (() => void) | null = null;

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
          list.push(doc.data() as ProductionPlan);
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
          list.push(doc.data() as DeliveryEntry);
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setDeliveries(list);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'deliveries');
      });
    };

    const initializeAndSubscribe = async () => {
      try {
        const initDocRef = doc(db, 'settings', 'init_status');
        const initDocSnap = await getDoc(initDocRef);

        if (!initDocSnap.exists()) {
          // First setup: Seed ONLY profiles and targets in one atomic batch
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
        }

        // ONE-TIME PURGE OF DEMO DATA FOR COMPANY PRODUCTION READINESS
        const cleanDocRef = doc(db, 'settings', 'production_cleaned_v1');
        const cleanDocSnap = await getDoc(cleanDocRef);
        if (!cleanDocSnap.exists()) {
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
          addToast("Database cleared and optimized for real production operations!", "success");
        }
      } catch (err) {
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
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('epp_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('epp_current_user');
    }
  }, [currentUser]);

  // --- TOAST DISPATCHERS ---
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto remove toast
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
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
        addToast(`Registered dispatch: ${delivery.quantity} units of ${delivery.modelId} shipped!`, 'success');
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
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, `deliveries/${id}`);
            addToast('Failed to delete delivery entry from Cloud Database.', 'error');
          });
      }
    );
  };

  const handleAddStockEntry = (entry: Omit<StockEntry, 'id' | 'createdAt'>) => {
    const newEntry: StockEntry = {
      ...entry,
      id: `se-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    setDoc(doc(db, 'stock_entries', newEntry.id), newEntry)
      .then(() => {
        addToast(`Registered output level: ${entry.quantity} units of ${entry.modelId} saved!`, 'success');
      })
      .catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `stock_entries/${newEntry.id}`);
        addToast('Failed to save stock entry to Cloud Database.', 'error');
      });
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

  const handleEditStockEntry = (id: string, updatedEntry: Partial<Omit<StockEntry, 'id' | 'createdAt'>>) => {
    if (!currentUser || currentUser.role !== 'manager') {
      addToast('Security Block: Only managers are authorized to update stock specifications or quantities.', 'error');
      return;
    }
    updateDoc(doc(db, 'stock_entries', id), updatedEntry)
      .then(() => {
        addToast('Successfully updated the stock entry specifications!', 'success');
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
          />
        );

      case 'stock':
        return (
          <StockManagement
            currentUser={currentUser}
            entries={stockEntries}
            deliveries={deliveries}
            plans={plans}
            onAddEntry={handleAddStockEntry}
            onDeleteEntry={handleDeleteStockEntry}
            onEditEntry={handleEditStockEntry}
          />
        );

      case 'plans':
        return (
          <PlanningModule
            currentUser={currentUser}
            plans={plans}
            entries={stockEntries}
            dailyTargets={dailyTargets}
            onUpdateDailyTarget={handleUpdateDailyTarget}
            onAddPlan={handleAddProductionPlan}
            onUpdatePlanStatus={handleUpdatePlanStatus}
            onDeletePlan={handleDeleteProductionPlan}
            onEditPlan={handleEditProductionPlan}
          />
        );

      case 'delivery':
        return (
          <DeliveryModule
            currentUser={currentUser}
            entries={stockEntries}
            deliveries={deliveries}
            onAddDelivery={handleAddDelivery}
            onDeleteDelivery={handleDeleteDelivery}
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
    { id: 'delivery', label: 'Deliveries', icon: Truck }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased font-sans transition-colors duration-300">
      
      {/* GLOBAL TOAST BANNER */}
      <Notification toasts={toasts} removeToast={removeToast} />

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

              <div className="flex items-center gap-3 relative">
                <div className="w-8 h-8 bg-emerald-500 rounded-sm rotate-45 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                  <div className="w-4 h-4 bg-slate-900 rounded-full"></div>
                </div>
                <span className="font-display font-black text-white tracking-tighter text-lg italic uppercase">
                  EPP AIRBAG
                </span>
              </div>

              <div className="space-y-4 max-w-lg mt-12 md:mt-0 relative">
                <h1 className="text-3xl md:text-5xl font-black font-display text-slate-100 tracking-tight leading-none">
                  Line Efficiency. <br />
                  <span className="bg-linear-to-r from-teal-400 via-emerald-400 to-emerald-500 bg-clip-text text-transparent">Integrated.</span>
                </h1>
                <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                  The central data hub for airbag manufacturing. Keep stock registries coherent, schedule machines accurately, and monitor active operators effortlessly.
                </p>
              </div>


            </div>

            {/* RIGHT BOARD - CREDENTIALS WALL */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12" id="credentials-wall">
              <div className="w-full max-w-md space-y-8">
                
                {/* EMAIL / OR SIGN UP INTERFACES */}
                <div className="bg-white border border-slate-200 shadow-xs p-6 rounded-2xl space-y-4" id="credential-form-shell">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <button
                      onClick={() => { setSignUpMode(false); setAuthError(''); }}
                      className={`text-xs font-bold uppercase tracking-wider pb-1.5 border-b-2 transition-all cursor-pointer ${
                        !signUpMode 
                          ? 'border-emerald-600 text-slate-900' 
                          : 'border-transparent text-slate-450 hover:text-slate-800'
                      }`}
                      id="toggle-sign-in"
                    >
                      Authenticate User
                    </button>
                    
                    <button
                      onClick={() => { setSignUpMode(true); setAuthError(''); }}
                      className={`text-xs font-bold uppercase tracking-wider pb-1.5 border-b-2 transition-all cursor-pointer ${
                        signUpMode 
                          ? 'border-emerald-600 text-slate-900' 
                          : 'border-transparent text-slate-450 hover:text-slate-800'
                      }`}
                      id="toggle-sign-up"
                    >
                      Join Roster
                    </button>
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
                          placeholder="e.g. gonzalo"
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
                          placeholder="Gonzalo"
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
                            placeholder="gonzalo"
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
                {/* Logo lock - Geometric rotated diamond */}
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 bg-emerald-500 rounded-sm rotate-45 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                    <div className="w-4 h-4 bg-slate-900 rounded-full"></div>
                  </div>
                  <div>
                    <span className="font-bold text-white tracking-tighter text-base italic leading-none block">
                      EPP AIRBAG
                    </span>
                  </div>
                </div>

                {/* User avatar bar summary */}
                <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex items-center gap-3">
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
            <header className="md:hidden bg-slate-900 border-b border-slate-800 p-4 shrink-0 flex items-center justify-between" id="mobile-header">
              <div className="flex items-center gap-2">
                <Factory size={16} className="text-emerald-400" />
                <span className="font-display font-black text-xs tracking-wider text-slate-200">EPP SYSTEM</span>
                <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full ${
                  currentUser.role === 'manager' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {currentUser.role.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-1.5 hover:bg-slate-800 text-slate-350 hover:text-slate-200 rounded-lg"
                  aria-label="Toggle navigation drawers"
                  id="mobile-drawer-toggle"
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </header>

            {/* MOBILE NAV DRAWER DROPDOWN WITH ANIMATION */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="md:hidden bg-slate-900/95 border-b border-slate-800 overflow-hidden px-4 py-2 space-y-4"
                  id="mobile-navigation-drawer"
                >
                  <nav className="space-y-1">
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
                          className={`w-full text-left py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          id={`mobile-nav-tab-${item.id}`}
                        >
                          <IconComponent size={14.5} />
                          {item.label}
                        </button>
                      );
                    })}
                  </nav>

                  <div className="pt-2 border-t border-slate-850 flex items-center justify-between pb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center font-bold text-[10px] border ${
                        currentUser.role === 'manager' 
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      }`}>
                        {currentUser.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[11.5px] font-bold text-slate-300 truncate max-w-[120px]">{currentUser.name}</span>
                    </div>

                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="text-2xs font-bold text-rose-450 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                      id="mobile-drawer-logout"
                    >
                      <LogOut size={13} /> Log Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* PRIMARY VIEWBOARD PANEL */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8" id="primary-viewboard">
              {renderTabContent()}
            </main>

          </motion.div>
        )}
      </AnimatePresence>
      )}

      {/* GLOBAL CUSTOM CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="custom-confirm-portal">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              id="confirm-modal-backdrop"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative w-full max-w-md bg-white border border-slate-200/85 rounded-2xl shadow-xl overflow-hidden p-6 z-10 space-y-4"
              id="confirm-modal-body"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
                  <AlertCircle size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight font-sans uppercase">
                  {confirmModal.title}
                </h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                {confirmModal.message}
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                  id="cancel-confirm-action"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  id="approve-confirm-action"
                >
                  Confirm Action
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
