import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface NotificationProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export default function Notification({ toasts, removeToast }: NotificationProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgColor = 'bg-white border-slate-200 text-slate-800';
          let Icon = Info;
          let iconColor = 'text-blue-600';

          if (toast.type === 'success') {
            bgColor = 'bg-white/95 backdrop-blur-md border border-emerald-205 text-slate-800 shadow-lg shadow-emerald-100/20';
            Icon = CheckCircle;
            iconColor = 'text-emerald-600 animate-pulse';
          } else if (toast.type === 'error') {
            bgColor = 'bg-white/95 backdrop-blur-md border border-rose-205 text-slate-800 shadow-lg shadow-rose-100/20';
            Icon = AlertCircle;
            iconColor = 'text-rose-600';
          } else if (toast.type === 'info') {
            bgColor = 'bg-white/95 backdrop-blur-md border border-sky-205 text-slate-800 shadow-lg shadow-sky-100/20';
            Icon = Info;
            iconColor = 'text-sky-650';
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-4 rounded-xl flex items-start gap-3 pointer-events-auto border shadow-xl ${bgColor}`}
              id={`toast-${toast.id}`}
            >
              <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 text-sm font-bold pr-1">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 rounded-lg hover:bg-slate-100 shrink-0 cursor-pointer"
                aria-label="Close toast"
                id={`toast-close-${toast.id}`}
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
