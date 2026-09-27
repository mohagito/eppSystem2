/**
 * Centralized Timezone and Clock Utilities for Morocco (GMT+1 / Casablanca)
 * Ensures 100% accurate 24-hour timing across all factory modules, records, and UI headers.
 * Standard Moroccan Time is UTC+1 (GMT+1), with seasonal Ramadan shifts (GMT+0).
 */
import { useState, useEffect } from 'react';

export const MOROCCO_TIMEZONE = 'Africa/Casablanca';
export const MOROCCO_TZ_LABEL = 'GMT+1 (Maroc)';

const TZ_STORAGE_KEY = 'epp_factory_tz_mode';
const TZ_CUSTOM_OFFSET_KEY = 'epp_factory_tz_offset';

export type TimezoneMode = 'morocco_gmt1' | 'morocco_gmt0' | 'device';

/**
 * Gets currently active timezone mode.
 * Default is 'morocco_gmt1' (UTC+1, Morocco Standard Time).
 */
export function getActiveTimezoneMode(): TimezoneMode {
  try {
    const saved = localStorage.getItem(TZ_STORAGE_KEY) as TimezoneMode | null;
    if (saved === 'morocco_gmt1' || saved === 'morocco_gmt0' || saved === 'device') {
      return saved;
    }
  } catch {
    // Local storage unavailable
  }
  return 'morocco_gmt1';
}

/**
 * Gets the custom numeric hour offset applied to Morocco GMT+1.
 */
export function getCustomHourOffset(): number {
  try {
    const saved = localStorage.getItem(TZ_CUSTOM_OFFSET_KEY);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= -12 && parsed <= 14) {
        return parsed;
      }
    }
  } catch {}
  return 0;
}

/**
 * Sets timezone mode and dispatches update event.
 */
export function setActiveTimezoneMode(mode: TimezoneMode, customOffset = 0): void {
  try {
    localStorage.setItem(TZ_STORAGE_KEY, mode);
    localStorage.setItem(TZ_CUSTOM_OFFSET_KEY, String(customOffset));
    window.dispatchEvent(new Event('epp-timezone-sync'));
  } catch {}
}

/**
 * Calculates current UTC offset in hours according to active mode and custom shift.
 */
export function getEffectiveOffsetHours(): number {
  const mode = getActiveTimezoneMode();
  const custom = getCustomHourOffset();

  if (mode === 'morocco_gmt0') {
    return 0 + custom; // Ramadan period GMT+0
  }
  if (mode === 'device') {
    // Invert browser's getTimezoneOffset (which is in minutes, UTC - local)
    const deviceMinutes = -new Date().getTimezoneOffset();
    return (deviceMinutes / 60) + custom;
  }
  // Default: Standard Morocco Time GMT+1
  return 1 + custom;
}

/**
 * Returns current Date or parses input safely
 */
export function toSafeDate(input?: Date | string | number | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  if (typeof input === 'string') {
    const str = input.trim();
    // Pure YYYY-MM-DD string: parse parts to midday to prevent timezone date boundary skews
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Returns YYYY-MM-DD formatted for Morocco GMT+1 (or active mode)
 */
export function getMoroccoDateStr(input?: Date | string | number | null): string {
  const d = toSafeDate(input);
  const offsetHours = getEffectiveOffsetHours();
  const target = new Date(d.getTime() + (offsetHours * 3600000));

  const yyyy = target.getUTCFullYear();
  const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(target.getUTCDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns 24-hour time HH:mm (e.g., "16:44") or HH:mm:ss in Morocco GMT+1
 */
export function getMoroccoTimeStr(input?: Date | string | number | null, includeSeconds = false): string {
  const d = toSafeDate(input);
  const offsetHours = getEffectiveOffsetHours();
  const target = new Date(d.getTime() + (offsetHours * 3600000));

  const hh = String(target.getUTCHours()).padStart(2, '0');
  const mm = String(target.getUTCMinutes()).padStart(2, '0');
  const ss = String(target.getUTCSeconds()).padStart(2, '0');

  return includeSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

/**
 * Formats a date for presentation in Morocco (e.g. "25 Sep 2026")
 */
export function formatMoroccoDate(input?: Date | string | number | null): string {
  const d = toSafeDate(input);
  const offsetHours = getEffectiveOffsetHours();
  const target = new Date(d.getTime() + (offsetHours * 3600000));

  const dd = target.getUTCDate();
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const month = monthNames[target.getUTCMonth()];
  const yyyy = target.getUTCFullYear();

  return `${dd} ${month} ${yyyy}`;
}

/**
 * Formats a date + 24-hour time in Morocco (e.g. "25 Sep 2026, 16:44")
 */
export function formatMoroccoDateTime(input?: Date | string | number | null, includeSeconds = false): string {
  const d = toSafeDate(input);
  const datePart = formatMoroccoDate(d);
  const timePart = getMoroccoTimeStr(d, includeSeconds);
  return `${datePart}, ${timePart}`;
}

/**
 * Custom React hook for live synchronized Morocco factory clock
 * Updates once per second to provide real-time 24h hour/minute/second
 */
export function useMoroccoClock() {
  const [now, setNow] = useState(() => new Date());
  const [, setSyncTick] = useState(0);

  useEffect(() => {
    // Tick every second for live clock
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    const handleSync = () => {
      setSyncTick(t => t + 1);
      setNow(new Date());
    };

    window.addEventListener('epp-timezone-sync', handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('epp-timezone-sync', handleSync);
    };
  }, []);

  const time24WithSec = getMoroccoTimeStr(now, true);
  const time24Short = getMoroccoTimeStr(now, false);
  const dateStr = formatMoroccoDate(now);
  const isoDateStr = getMoroccoDateStr(now);
  const activeMode = getActiveTimezoneMode();
  const offsetHours = getEffectiveOffsetHours();
  const customOffset = getCustomHourOffset();

  const tzShortLabel = offsetHours >= 0 ? `GMT+${offsetHours}` : `GMT${offsetHours}`;
  const tzLabel = activeMode === 'morocco_gmt0' 
    ? 'GMT+0 (Ramadan Maroc)' 
    : activeMode === 'device'
      ? `Local (${tzShortLabel})`
      : `GMT+1 (Maroc Hub)`;

  return {
    timeWithSeconds: time24WithSec, // e.g. "16:44:35"
    timeShort: time24Short,         // e.g. "16:44"
    dateFormatted: dateStr,         // e.g. "25 Sep 2026"
    todayIso: isoDateStr,           // e.g. "2026-09-25"
    tzLabel,
    tzShortLabel,
    activeMode,
    offsetHours,
    customOffset
  };
}
