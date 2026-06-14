import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck, X, AlertCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { setupFcmToken, isFcmSupported } from '../fcm';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

interface NotificationPermissionPromptProps {
  currentUser: UserProfile;
}

export default function NotificationPermissionPrompt({ currentUser }: NotificationPermissionPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    // Check if the user has already made a choice by loading their profile state from database
    const checkUserPreference = async () => {
      try {
        const profileRef = doc(db, 'profiles', currentUser.id);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          // Ask if notificationEnabled is undefined or null (i.e. has not made a decision yet)
          if (data.notificationEnabled === undefined || data.notificationEnabled === null) {
            // Wait 2.5 seconds after mounting (after login completes) to present a polite prompt
            const timer = setTimeout(() => {
              setShowPrompt(true);
            }, 2500);
            return () => clearTimeout(timer);
          }
        }
      } catch (err) {
        console.error('Permission check failure', err);
      }
    };

    checkUserPreference();
  }, [currentUser]);

  const handleEnableNotifications = async () => {
    setIsProcessing(true);
    if (!isFcmSupported()) {
      Swal.fire({
        icon: 'error',
        title: 'Device Unsupported',
        text: 'This browser or operating system does not support native HTML5 Web Push notifications.',
        background: '#0f172a',
        color: '#f8fafc',
        confirmButtonColor: '#10b981'
      });
      setShowPrompt(false);
      setIsProcessing(false);
      return;
    }

    const result = await setupFcmToken(currentUser.id);
    setIsProcessing(false);
    setShowPrompt(false);

    if (result.success) {
      Swal.fire({
        icon: 'success',
        title: 'Push Alerts Enabled!',
        text: 'You will now receive live push notification alerts for key manufacturing events even when closed!',
        background: '#0f172a',
        color: '#f8fafc',
        confirmButtonColor: '#10b981',
        timer: 3500,
        timerProgressBar: true
      });
    } else {
      console.warn('Encapsulated registration state:', result.error);
    }
  };

  const handleDeclineNotifications = async () => {
    // If user clicks "Not Now" / declining, we set notificationEnabled which blocks showing this card again.
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'profiles', currentUser.id), {
        notificationEnabled: false,
        lastTokenUpdate: new Date().toISOString()
      });
      
      Swal.fire({
        icon: 'info',
        title: 'Alerts Muted',
        text: 'Notifications are disabled on this machine. You can always view alerts in the in-app bell center.',
        background: '#0f172a',
        color: '#f8fafc',
        confirmButtonColor: '#64748b',
        timer: 3000
      });
    } catch (err) {
      console.error('Decline persisting error', err);
    }
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 overflow-hidden font-sans border-t-4 border-t-emerald-500"
          id="fcm-permission-prompt-container"
        >
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 animate-pulse">
              <Bell size={18} />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-200 tracking-wider font-sans">
                  Enable PWA Notifications
                </span>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="p-1 text-slate-500 hover:text-white rounded-lg transition"
                >
                  <X size={14} />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 font-semibold leading-normal">
                Receive instant production target, inventory critical levels, and delivery dispatches directly on your screen.
              </p>

              <div className="flex items-center gap-2 pt-3">
                <button
                  onClick={handleDeclineNotifications}
                  className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-[10px] font-bold rounded-xl transition cursor-pointer flex-1"
                >
                  Ask Me Later
                </button>
                <button
                  disabled={isProcessing}
                  onClick={handleEnableNotifications}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-xl transition cursor-pointer flex-1 flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/15"
                >
                  {isProcessing ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck size={13} />
                      Set Alerts Live
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
