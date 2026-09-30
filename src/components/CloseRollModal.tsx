import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { RollEntry } from '../types';
import { 
  normalizeRollMaterial, 
  getMaterialFamily, 
  getMaterialActiveReferences 
} from '../utils/financialCalculations';

interface CloseRollModalProps {
  isOpen: boolean;
  roll: RollEntry | null;
  onClose: () => void;
  onConfirmClose: (rollId: string, closingUnpackaged: Record<string, number>, notes?: string) => Promise<void>;
}

export default function CloseRollModal({
  isOpen,
  roll,
  onClose,
  onConfirmClose
}: CloseRollModalProps) {
  if (!isOpen || !roll) return null;

  const normMat = normalizeRollMaterial(roll.materialName);
  const family = getMaterialFamily(normMat);
  const activeRefs = getMaterialActiveReferences(roll.materialName);

  // Remaining unpackaged pieces inputs per reference
  const [unpackagedInputs, setUnpackagedInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    activeRefs.forEach((ref) => {
      initial[ref] = '0';
    });
    return initial;
  });

  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const initial: Record<string, string> = {};
    activeRefs.forEach((ref) => {
      initial[ref] = '0';
    });
    setUnpackagedInputs(initial);
    setErrorMsg('');
    setNotes('');
  }, [roll?.id]);

  const handleInputChange = (ref: string, val: string) => {
    setUnpackagedInputs((prev) => ({
      ...prev,
      [ref]: val
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedData: Record<string, number> = {};
    for (const ref of activeRefs) {
      const valStr = unpackagedInputs[ref] ?? '0';
      const num = parseInt(valStr, 10);
      if (isNaN(num) || num < 0) {
        setErrorMsg(`Please enter a valid non-negative number for ${ref}.`);
        return;
      }
      parsedData[ref] = num;
    }

    setSubmitting(true);
    try {
      await onConfirmClose(roll.id, parsedData, notes.trim());
      onClose();
    } catch (err: any) {
      console.error('Failed to close roll:', err);
      setErrorMsg(err.message || 'Failed to close roll.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div 
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        id="close-roll-modal-dialog"
      >
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-sans">
              CLOSE {family.includes('INDIA') ? 'INDIA' : family} ROLL
            </h3>
            <p className="text-xs font-mono font-bold text-slate-500 mt-0.5">
              Roll: <span className="text-indigo-600">{roll.barcode || roll.id}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          <div className="text-xs text-slate-700 font-bold uppercase tracking-wider">
            Remaining unpackaged pieces:
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Reference inputs */}
          <div className="space-y-3">
            {activeRefs.map((ref) => (
              <div 
                key={ref} 
                className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                  <div className="truncate">
                    <span className="text-xs font-black text-slate-800 uppercase block truncate">
                      {ref}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      Remaining unpackaged:
                    </span>
                  </div>
                </div>

                <div className="relative w-28 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={unpackagedInputs[ref] ?? '0'}
                    onChange={(e) => handleInputChange(ref, e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 text-sm font-mono font-black py-2 pl-3 pr-8 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-right"
                    placeholder="0"
                    disabled={submitting}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">
                    pcs
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Optional Closing Notes */}
          <div className="pt-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. End of roll, shift handover"
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              disabled={submitting}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              {submitting ? 'Closing...' : 'Confirm Close'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
