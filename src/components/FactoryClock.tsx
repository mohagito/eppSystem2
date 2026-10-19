import React, { useState, useRef, useEffect } from 'react';
import { Clock, Check, ChevronDown, RefreshCw, Sun, Moon, Sliders } from 'lucide-react';
import { 
  useMoroccoClock, 
  setActiveTimezoneMode, 
  TimezoneMode, 
  getActiveTimezoneMode,
  getCustomHourOffset
} from '../utils/timeZone';

interface FactoryClockProps {
  variant?: 'desktop' | 'mobile' | 'badge';
  className?: string;
}

export default function FactoryClock({ variant = 'desktop', className = '' }: FactoryClockProps) {
  const { 
    timeWithSeconds, 
    timeShort, 
    dateFormatted, 
    tzLabel, 
    tzShortLabel, 
    activeMode, 
    customOffset 
  } = useMoroccoClock();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    if (popoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popoverOpen]);

  const handleSelectMode = (mode: TimezoneMode) => {
    setActiveTimezoneMode(mode, 0);
  };

  const handleAdjustHour = (delta: number) => {
    const currentMode = getActiveTimezoneMode();
    const currentCustom = getCustomHourOffset();
    setActiveTimezoneMode(currentMode, currentCustom + delta);
  };

  const handleReset = () => {
    setActiveTimezoneMode('morocco_gmt0', 0);
  };

  if (variant === 'mobile') {
    return (
      <div 
        className={`flex items-center gap-1.5 px-2.5 py-1 bg-slate-850/90 border border-slate-750/80 rounded-xl text-slate-200 shadow-xs select-none ${className}`}
        title={`Horloge Opérationnelle Maroc: ${timeWithSeconds} (${tzLabel})`}
        id="factory-clock-mobile"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <Clock size={12} className="text-emerald-400 shrink-0" />
        <span className="font-mono font-black text-xs text-white tracking-wider">
          {timeShort}
        </span>
        <span className="text-[9px] font-mono font-bold text-emerald-400/90 px-1 py-0.2 bg-emerald-500/10 rounded">
          {tzShortLabel}
        </span>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <span 
        className={`inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-800 ${className}`}
        title={`Horloge Usine Maroc (${tzLabel})`}
      >
        <Clock size={11} className="text-emerald-400" />
        <span className="text-emerald-300 font-extrabold">{timeShort}</span>
        <span className="text-[9px] text-slate-400 font-sans">{tzShortLabel}</span>
      </span>
    );
  }

  // Desktop variant (targeted by CSS selector 2: div#factory-clock-desktop)
  // Inner container is targeted by CSS selector 1: div#factory-clock-desktop > div:nth-of-type(1)
  return (
    <div 
      className={`relative inline-block select-none ${className}`}
      ref={popoverRef}
    >
      <div 
        id="factory-clock-desktop"
        className="flex items-center gap-3 px-3.5 py-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs select-none transition-all hover:border-emerald-500/50 hover:shadow-md cursor-pointer group"
        onClick={() => setPopoverOpen(prev => !prev)}
        title="Horloge Centrale Usine • Synchronisée Maroc (GMT+1 / 24h) - Cliquez pour ajuster ou calibrer"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center group-hover:bg-emerald-100/80 transition-colors">
            <Clock size={15} className="text-emerald-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                {timeWithSeconds}
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[9.5px] font-extrabold tracking-tight flex items-center gap-0.5">
                {tzShortLabel}
                <ChevronDown size={9} className="opacity-60 group-hover:opacity-100 transition-opacity" />
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
              <span>{dateFormatted}</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-600 font-semibold">Maroc Hub</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calibration & Timezone Popover */}
      {popoverOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-emerald-50 text-emerald-600 rounded-lg">
                <Sliders size={14} />
              </div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Synchronisation Horloge Usine
              </h4>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              24h Direct
            </span>
          </div>

          {/* Large Live Time Display */}
          <div className="bg-slate-950 text-white rounded-xl p-3 text-center mb-3.5 shadow-inner">
            <div className="font-mono text-2xl font-black tracking-widest text-emerald-400">
              {timeWithSeconds}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium flex items-center justify-center gap-1.5">
              <span>{dateFormatted}</span>
              <span>•</span>
              <span className="text-emerald-300 font-semibold">{tzLabel}</span>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="space-y-1.5 mb-3">
            <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Régime Horaire Officiel
            </div>

            <button
              type="button"
              onClick={() => handleSelectMode('morocco_gmt0')}
              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs font-semibold transition-all ${
                activeMode === 'morocco_gmt0' && customOffset === 0
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300/80 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border border-transparent hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sun size={14} className="text-amber-500" />
                <div>
                  <div className="font-bold">Maroc Standard (GMT+0)</div>
                  <div className="text-[10px] text-slate-500 font-normal">Heure en vigueur au Maroc (GMT+0)</div>
                </div>
              </div>
              {activeMode === 'morocco_gmt0' && customOffset === 0 && (
                <Check size={14} className="text-emerald-600 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectMode('morocco_gmt1')}
              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs font-semibold transition-all ${
                activeMode === 'morocco_gmt1' && customOffset === 0
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300/80 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border border-transparent hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Moon size={14} className="text-indigo-500" />
                <div>
                  <div className="font-bold">Maroc (GMT+1)</div>
                  <div className="text-[10px] text-slate-500 font-normal">Décalage +1 heure</div>
                </div>
              </div>
              {activeMode === 'morocco_gmt1' && customOffset === 0 && (
                <Check size={14} className="text-emerald-600 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectMode('device')}
              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs font-semibold transition-all ${
                activeMode === 'device' && customOffset === 0
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300/80 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border border-transparent hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-sky-500" />
                <div>
                  <div className="font-bold">Heure Système Appareil</div>
                  <div className="text-[10px] text-slate-500 font-normal">Calque exact de l'horloge de votre ordinateur / téléphone</div>
                </div>
              </div>
              {activeMode === 'device' && customOffset === 0 && (
                <Check size={14} className="text-emerald-600 shrink-0" />
              )}
            </button>
          </div>

          {/* Fine Tuning / Manual Offset */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium text-slate-600">
              <span>Ajustement fin manuel:</span>
              <span className="font-mono font-bold text-slate-900">
                {customOffset > 0 ? `+${customOffset}h` : customOffset < 0 ? `${customOffset}h` : '0h (Normal)'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleAdjustHour(-1)}
                className="py-1 px-2 text-[11px] font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 shadow-2xs"
              >
                -1 Heure
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="py-1 px-2 text-[11px] font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 shadow-2xs flex items-center justify-center gap-1"
              >
                <RefreshCw size={10} /> Reset
              </button>
              <button
                type="button"
                onClick={() => handleAdjustHour(1)}
                className="py-1 px-2 text-[11px] font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 shadow-2xs"
              >
                +1 Heure
              </button>
            </div>
          </div>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setPopoverOpen(false)}
              className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Fermer le panneau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
