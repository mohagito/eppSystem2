import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Truck, 
  Package, 
  Trophy, 
  Calendar, 
  Settings, 
  Clock, 
  X,
  VolumeX,
  AlertTriangle
} from 'lucide-react';
import { 
  collection, 
  doc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';

// Define Notification Category type
export type NotificationCategory = 'delivery' | 'stock' | 'target' | 'plan' | 'system';

export interface DatabaseNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string; // ISO String
  category: NotificationCategory;
  readBy: string[]; // List of user profile IDs who marked it as read
  targetRole: 'manager' | 'worker' | 'all';
  targetUserId?: string;
  createdBy?: string;
}

interface NotificationCenterProps {
  currentUser: UserProfile;
  setActiveTab: (tabId: string) => void;
}

export default function NotificationCenter({ currentUser, setActiveTab }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<DatabaseNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [allNotifications, setAllNotifications] = useState<DatabaseNotification[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 1. Live synchronization of the last 15 notifications from Firestore filtered by Role
  useEffect(() => {
    if (!currentUser) return;

    const notifsRef = collection(db, 'notifications');
    // We fetch and filter in-memory or using simple queries to respect Phase 7 Role-Based requirements
    const q = query(notifsRef, orderBy('createdAt', 'desc'), limit(30));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DatabaseNotification[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
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
        
        const item: DatabaseNotification = {
          id: docSnap.id,
          title: data.title || '',
          body: data.body || '',
          createdAt: createdAtStr || new Date().toISOString(),
          category: (data.category as NotificationCategory) || 'system',
          readBy: Array.isArray(data.readBy) ? data.readBy : [],
          targetRole: data.targetRole || 'all',
          targetUserId: data.targetUserId || '',
          createdBy: data.createdBy || ''
        };

        // PHASE 7 Role-Based notifications check
        // Managers: receive production, delivery, stock, planning, system alerts (targetRole is manager or all)
        // Workers: receive personal production, shift, achievement notifications (targetRole is worker or targetUserId is current user or all)
        let isEligible = false;
        if (currentUser.role === 'manager') {
          if (item.targetRole === 'manager' || item.targetRole === 'all') {
            isEligible = true;
          }
        } else {
          // It's a worker
          if (
            item.targetRole === 'worker' || 
            item.targetRole === 'all' || 
            item.targetUserId === currentUser.id ||
            item.body.toLowerCase().includes(currentUser.name.toLowerCase())
          ) {
            isEligible = true;
          }
        }

        if (isEligible) {
          list.push(item);
        }
      });

      // Sort by newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(list.slice(0, 15));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Derive unread count
  const unreadNotifications = notifications.filter(n => !n.readBy.includes(currentUser.id));
  const unreadCount = unreadNotifications.length;

  // 2. Mark specific notification as read
  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering navigation
    const notif = notifications.find(n => n.id === id) || allNotifications.find(n => n.id === id);
    if (!notif) return;

    if (notif.readBy.includes(currentUser.id)) return;

    try {
      const updatedReadBy = [...notif.readBy, currentUser.id];
      await updateDoc(doc(db, 'notifications', id), {
        readBy: updatedReadBy
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  // 3. Mark all visible as read
  const handleMarkAllAsRead = async () => {
    const unreadList = (showHistoryModal ? allNotifications : notifications)
      .filter(n => !n.readBy.includes(currentUser.id));

    if (unreadList.length === 0) return;

    try {
      for (const notif of unreadList) {
        await updateDoc(doc(db, 'notifications', notif.id), {
          readBy: [...notif.readBy, currentUser.id]
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications (batch mark as read)');
    }
  };

  // 4. Notification categories formatting helpers
  const getCategoryInfo = (category: NotificationCategory) => {
    switch (category) {
      case 'delivery':
        return {
          icon: <Truck size={14} className="text-sky-400" />,
          bg: 'bg-sky-500/10 border-sky-500/25',
          label: 'Delivery Shipped',
          tab: 'deliveries'
        };
      case 'stock':
        return {
          icon: <Package size={14} className="text-amber-400" />,
          bg: 'bg-amber-500/10 border-amber-500/25',
          label: 'Inventory Change',
          tab: 'inventory'
        };
      case 'target':
        return {
          icon: <Trophy size={14} className="text-emerald-400" />,
          bg: 'bg-emerald-500/10 border-emerald-500/25',
          label: 'Daily KPI Target',
          tab: 'dashboard'
        };
      case 'plan':
        return {
          icon: <Calendar size={14} className="text-indigo-400" />,
          bg: 'bg-indigo-500/10 border-indigo-500/25',
          label: 'Production Plan',
          tab: 'planning'
        };
      default:
        return {
          icon: <Settings size={14} className="text-slate-400" />,
          bg: 'bg-slate-500/10 border-slate-500/25',
          label: 'Operations System',
          tab: 'dashboard'
        };
    }
  };

  const formatFriendlyTime = (isoString: string) => {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    
    if (diffMs < 60000) return 'Just now';
    
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}m ago`;
    
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    
    // Otherwise show short date and time
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const handleNotificationClick = async (notif: DatabaseNotification) => {
    // 1. Mark as read
    if (!notif.readBy.includes(currentUser.id)) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), {
          readBy: [...notif.readBy, currentUser.id]
        });
      } catch (err) {
        console.error('Error auto-marking read', err);
      }
    }
    
    // 2. Navigate based on notification click behavior
    const info = getCategoryInfo(notif.category);
    setActiveTab(info.tab);
    setIsOpen(false);
    setShowHistoryModal(false);
  };

  // Fetch full notification history
  const loadFullHistory = async () => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    setIsOpen(false);
    try {
      const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(100));
      const querySnap = await getDocs(q);
      const list: DatabaseNotification[] = [];
      querySnap.forEach((docSnap) => {
        const data = docSnap.data();
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
        
        const item: DatabaseNotification = {
          id: docSnap.id,
          title: data.title || '',
          body: data.body || '',
          createdAt: createdAtStr || new Date().toISOString(),
          category: (data.category as NotificationCategory) || 'system',
          readBy: Array.isArray(data.readBy) ? data.readBy : [],
          targetRole: data.targetRole || 'all',
          targetUserId: data.targetUserId || '',
          createdBy: data.createdBy || ''
        };

        let isEligible = false;
        if (currentUser.role === 'manager') {
          if (item.targetRole === 'manager' || item.targetRole === 'all') {
            isEligible = true;
          }
        } else {
          if (
            item.targetRole === 'worker' || 
            item.targetRole === 'all' || 
            item.targetUserId === currentUser.id ||
            item.body.toLowerCase().includes(currentUser.name.toLowerCase())
          ) {
            isEligible = true;
          }
        }

        if (isEligible) {
          list.push(item);
        }
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllNotifications(list);
    } catch (err) {
      console.error('Error fetching full history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="relative inline-block" id="notification-center-hub">
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center outline-hidden"
        aria-label="EPP MES Notifications System"
        id="notification-bell-trigger"
      >
        <Bell size={18} className={unreadCount > 0 ? "animate-swing" : ""} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-rose-650 border-2 border-slate-900 text-[9px] font-black font-mono text-white flex items-center justify-center px-0.5 shadow-sm animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-away backdrop */}
            <div 
              className="fixed inset-0 z-40 bg-transparent" 
              onClick={() => setIsOpen(false)} 
            />
            
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.18, type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute right-0 mt-3.5 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden"
              id="notification-dropdown-body"
            >
              {/* Header */}
              <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-850 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wider text-slate-200 uppercase font-sans">
                    Live System Alerts
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-rose-500/15 border border-rose-500/25 text-rose-400 font-mono text-[9px] font-bold rounded-full">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck size={12} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* List scrollarea */}
              <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-850/60" id="notification-scroll-viewport">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-500">
                      <VolumeX size={18} />
                    </div>
                    <p className="text-[11px] text-slate-500 font-semibold">No notifications registered matching your profile role.</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const info = getCategoryInfo(notif.category);
                    const isUnread = !notif.readBy.includes(currentUser.id);
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3.5 flex gap-3.5 transition-all text-left hover:bg-slate-850/50 cursor-pointer relative ${
                          isUnread ? 'bg-emerald-500/[0.015]' : 'opacity-85'
                        }`}
                      >
                        {/* Status notification marker indicator */}
                        {isUnread && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        )}

                        {/* Visual Categorical Icon */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${info.bg}`}>
                          {info.icon}
                        </div>

                        {/* Summary details */}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[11.5px] font-extrabold text-slate-150 truncate leading-tight tracking-tight">
                              {notif.title}
                            </span>
                            <span className="text-[9px] text-slate-450 font-medium font-mono shrink-0 flex items-center gap-1">
                              <Clock size={9} />
                              {formatFriendlyTime(notif.createdAt)}
                            </span>
                          </div>
                          
                          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                            {notif.body}
                          </p>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                              {info.label}
                            </span>
                            {isUnread && (
                              <button
                                onClick={(e) => handleMarkAsRead(notif.id, e)}
                                className="px-2 py-0.5 bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800 text-[9px] font-bold rounded-lg border border-slate-800 transition shadow-3xs flex items-center gap-0.5 cursor-pointer"
                              >
                                <Check size={10} />
                                Dismiss
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer navigation */}
              <div className="px-4 py-2.5 bg-slate-950/40 border-t border-slate-850 flex justify-center">
                <button
                  onClick={loadFullHistory}
                  className="text-xs font-black text-slate-300 hover:text-white transition-colors tracking-tight cursor-pointer py-1"
                >
                  View Historical Logs ({notifications.length}+ logs)
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* History modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs" id="history-logs-portal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              id="history-modal-body"
            >
              {/* Modal header */}
              <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white tracking-widest uppercase font-sans">
                    EPP Manufacturing Notification Center
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold font-sans mt-0.5">
                    Chronological activity log trace and historic push events
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleMarkAllAsRead}
                    className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-2xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCheck size={13} className="text-emerald-400" />
                    Dismiss All Unread
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* History list content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3.5 divide-y divide-slate-800/20">
                {historyLoading ? (
                  <div className="py-20 text-center space-y-3">
                    <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-slate-500">Querying historical database records...</p>
                  </div>
                ) : allNotifications.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 bg-slate-850 rounded-full flex items-center justify-center text-slate-600 border border-slate-800">
                      <AlertTriangle size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-300 uppercase">Audit Records Clean</p>
                      <p className="text-[11px] text-slate-500 mt-1 font-semibold leading-relaxed">
                        No previous push alerts or tracking events are registered in Firestore collections.
                      </p>
                    </div>
                  </div>
                ) : (
                  allNotifications.map((notif) => {
                    const info = getCategoryInfo(notif.category);
                    const isUnread = !notif.readBy.includes(currentUser.id);
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-4 rounded-2xl flex gap-4 transition bg-slate-950/20 border hover:bg-slate-950/40 cursor-pointer ${
                          isUnread ? 'bg-emerald-500/[0.01] border-emerald-500/10' : 'border-slate-850'
                        }`}
                      >
                        {/* Category badge */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${info.bg}`}>
                          {info.icon}
                        </div>

                        {/* Content text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                              <h4 className="text-[12px] font-black text-slate-100 uppercase tracking-tight">
                                {notif.title}
                              </h4>
                              {isUnread && (
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-450 font-bold font-mono">
                              {new Date(notif.createdAt).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + new Date(notif.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <p className="text-[11.5.px] text-slate-400 font-semibold leading-relaxed mt-1">
                            {notif.body}
                          </p>

                          <div className="flex items-center justify-between mt-3 grid-cols-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-wider font-mono">
                              {info.label}
                            </span>
                            {isUnread && (
                              <button
                                onClick={(e) => handleMarkAsRead(notif.id, e)}
                                className="px-3 py-1 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 text-2xs font-extrabold rounded-lg border border-slate-800 transition cursor-pointer"
                              >
                                Mark Read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
