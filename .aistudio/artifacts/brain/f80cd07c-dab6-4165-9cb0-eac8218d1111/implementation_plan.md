# Half-Day Shift Rounding for Roll Working Days & Net Profit

## Overview & Goal
Replace raw floating-point day values (such as `1.33`, `1.53`, `2.75`) with clean industrial shift increments (**half-day precision**: `.0` or `.5`), matching real workshop scheduling (full-day and half-day operator assignments).

---

## Proposed Shift-Rounding Business Rule

Based on your exact examples:
- **1.33 days** $\rightarrow$ **1.5 days**
- **1.53 days** $\rightarrow$ **1.5 days**
- **1.99 days** $\rightarrow$ **2.0 days**
- **1.88 days** $\rightarrow$ **2.0 days**
- **2.45 days** $\rightarrow$ **2.5 days**
- **2.75 days** $\rightarrow$ **2.5 days**
- **3.07 days** $\rightarrow$ **3.0 days**
- **4.00 days** $\rightarrow$ **4.0 days**

### Shift Partitioning Logic (per roll total):
Let $W$ be the raw working days calculated from production records, with whole days $N$ and decimal fraction $F = W - N$:

| Fraction Range ($F$) | Industrial Meaning | Rounded Value | Examples |
|---|---|---|---|
| **$0.00 \le F \le 0.15$** | Incidental / startup overlap ($\le$ 1 hour) | **$N + 0.0$** (Full Day) | `3.07` $\rightarrow$ `3.0`, `4.00` $\rightarrow$ `4.0` |
| **$0.15 < F \le 0.75$** | Half-day shift allocation (~2 to 6 hours) | **$N + 0.5$** (Half Day) | `1.33` $\rightarrow$ `1.5`, `1.53` $\rightarrow$ `1.5`, `2.45` $\rightarrow$ `2.5`, `2.75` $\rightarrow$ `2.5` |
| **$0.75 < F < 1.00$** | Almost entire shift (> 6 hours) | **$N + 1.0$** (Next Full Day) | `1.88` $\rightarrow$ `2.0`, `1.99` $\rightarrow$ `2.0` |

---

## Impact on Financials & Net Profit

1. **Working Days Column**:
   - Clean display values in the table: `1.5 days`, `2 days`, `2.5 days`, `3 days`.

2. **Allocated Operators Cost**:
   - Uses the rounded working days multiplied by the 3-operator daily rate (€56.49 / 610.08 DH):
     - `1.0 day` $\rightarrow$ €56.49 (610.08 DH)
     - `1.5 days` $\rightarrow$ €84.74 (915.12 DH)
     - `2.0 days` $\rightarrow$ €112.98 (1,220.16 DH)
     - `2.5 days` $\rightarrow$ €141.22 (1,525.20 DH)
     - `3.0 days` $\rightarrow$ €169.47 (1,830.24 DH)

3. **Net Profit**:
   - `Net Profit = Gross Profit - Allocated Operators Cost`
   - Clean, predictable, and directly matching workshop shifts.

---

## Technical Implementation Plan

1. In `src/utils/profitCalculations.ts`:
   - Add a pure helper function:
     ```ts
     export function roundToShiftDays(days: number): number {
       if (days <= 0) return 0;
       const whole = Math.floor(days);
       const frac = days - whole;
       if (frac <= 0.15) return whole;
       if (frac <= 0.75) return whole + 0.5;
       return whole + 1.0;
     }
     ```
   - Apply `roundToShiftDays` to each roll's calculated working days.
   - Calculate `workersCostEur = roundedDays * dailyLaborCostEur`.
   - Calculate `netProfitEur = grossProfitEur - workersCostEur`.

2. In `src/components/ProfitDashboard.tsx`:
   - Display the clean rounded days in both the table and the expanded card.
