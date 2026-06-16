import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { UserProfile, ProductionPlan, AirbagModel, MachineType, ShiftType, StockEntry } from '../types';
import { AIRBAG_MODELS, MOCK_PROFILES } from '../data';
import {
  CalendarRange,
  Cpu,
  Clock,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  ListFilter,
  Plus,
  UserCheck,
  ClipboardList,
  Flame,
  Wrench,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Pencil,
  Copy,
  Trash2,
  Check
} from 'lucide-react';
import {
  getPlanActualProduced,
  getAchievementPercent,
  getAchievementStatus,
  getAchievementColors
} from '../utils/achievement';

interface PlanningProps {
  currentUser: UserProfile;
  plans: ProductionPlan[];
  entries: StockEntry[];
  dailyTargets: Record<string, number>;
  profiles?: UserProfile[];
  onUpdateDailyTarget: (dateStr: string, targetValue: number) => void;
  onAddPlan: (plan: Omit<ProductionPlan, 'id' | 'createdAt' | 'status'>) => void;
  onUpdatePlanStatus?: (id: string, status: 'Pending' | 'Completed' | 'Delayed') => void;
  onDeletePlan?: (id: string) => void;
  onEditPlan?: (id: string, updatedPlan: Partial<Omit<ProductionPlan, 'id' | 'createdAt'>>) => void;
  onBulkAddPlans?: (plans: Omit<ProductionPlan, 'id' | 'createdAt'>[]) => void;
  onBulkDeletePlans?: (ids: string[]) => void;
}

export default function PlanningModule({
  currentUser,
  plans,
  entries,
  dailyTargets,
  profiles = [],
  onUpdateDailyTarget,
  onAddPlan,
  onUpdatePlanStatus,
  onDeletePlan,
  onEditPlan,
  onBulkAddPlans,
  onBulkDeletePlans
}: PlanningProps) {
  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Plan Creator Form State
  const [selectedModel, setSelectedModel] = useState<AirbagModel>('BCB');
  const [planDate, setPlanDate] = useState<string>(formatLocalDate(new Date()));
  const [machine, setMachine] = useState<MachineType>('Big Machine');
  const [shift, setShift] = useState<ShiftType>('Morning');
  const [qtyPlanned, setQtyPlanned] = useState<string>('');
  const [assignedWorker, setAssignedWorker] = useState<string>(() => {
    const defaultWorkers = (profiles && profiles.length > 0 ? profiles : MOCK_PROFILES).filter((p) => p.role === 'worker');
    return defaultWorkers.length > 0 ? defaultWorkers[0].name : 'Khalid';
  });
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Edit Plan Modal state
  const [editingPlan, setEditingPlan] = useState<ProductionPlan | null>(null);
  const [editPlanDate, setEditPlanDate] = useState<string>('');
  const [editModel, setEditModel] = useState<AirbagModel>('BCB');
  const [editMachine, setEditMachine] = useState<MachineType>('Big Machine');
  const [editShift, setEditShift] = useState<ShiftType>('Morning');
  const [editQtyPlanned, setEditQtyPlanned] = useState<string>('');
  const [editAssignedWorker, setEditAssignedWorker] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'Pending' | 'Completed' | 'Delayed'>('Pending');
  const [editFormError, setEditFormError] = useState<string>('');

  // Selection and Advanced Slide-up / Modal States
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [copyMode, setCopyMode] = useState<'week' | 'day' | 'shift' | 'selected'>('selected');
  const [targetWeekStart, setTargetWeekStart] = useState<string>('');
  const [sourceDay, setSourceDay] = useState<string>('');
  const [targetDay, setTargetDay] = useState<string>('');
  const [sourceShift, setSourceShift] = useState<ShiftType>('Morning');
  const [sourceMachine, setSourceMachine] = useState<MachineType>('Big Machine');
  const [targetShift, setTargetShift] = useState<'Morning' | 'Evening' | 'Keep'>('Keep');
  const [targetMachine, setTargetMachine] = useState<MachineType | 'Keep'>('Keep');
  const [resetProgress, setResetProgress] = useState<boolean>(true);

  const handleStartEdit = (plan: ProductionPlan) => {
    setEditingPlan(plan);
    setEditPlanDate(plan.planDate);
    setEditModel(plan.model);
    setEditMachine(plan.machine);
    setEditShift(plan.shift);
    setEditQtyPlanned(plan.quantityPlanned.toString());
    setEditAssignedWorker(plan.assignedWorker);
    setEditNotes(plan.notes || '');
    setEditStatus(plan.status);
    setEditFormError('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');

    const parsedQty = parseInt(editQtyPlanned, 10);
    if (!parsedQty || parsedQty <= 0) {
      setEditFormError('Please input a valid planned quantity greater than zero.');
      return;
    }

    if (!editPlanDate) {
      setEditFormError('Planning date is required.');
      return;
    }

    if (editingPlan && onEditPlan) {
      onEditPlan(editingPlan.id, {
        planDate: editPlanDate,
        machine: editMachine,
        shift: editShift,
        model: editModel,
        quantityPlanned: parsedQty,
        assignedWorker: editAssignedWorker,
        notes: editNotes.trim(),
        status: editStatus
      });
      setEditingPlan(null);
    }
  };

  // Weekly Matrix Schedule Navigation
  const [weekBaseDate, setWeekBaseDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }); // Default to actual today's local date

  const weekDays = useMemo(() => {
    const baseDate = new Date(weekBaseDate);
    const day = baseDate.getDay();
    // Monday is index 1. Sunday is index 0.
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(baseDate.setDate(diff));
    
    const days = [];
    const dayNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      const formattedDate = `${yyyy}-${mm}-${dd}`;
      const displayDate = `${dd}/${mm}/${yyyy}`;
      
      days.push({
        dateStr: formattedDate,
        displayDate,
        spanishName: dayNames[i],
        englishName: dayLabels[i]
      });
    }
    return days;
  }, [weekBaseDate]);

  const companyWeekInfo = useMemo(() => {
    const baseDate = new Date(weekBaseDate + 'T12:00:00');
    
    // ISO-8601 week number calculation
    const date = new Date(baseDate.getTime());
    const dayNum = date.getDay() || 7;
    date.setDate(date.getDate() + 4 - dayNum);
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    
    // Find Monday and Sunday of this week
    const currentDay = baseDate.getDay();
    const diffToMonday = baseDate.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(baseDate.getFullYear(), baseDate.getMonth(), diffToMonday);
    
    const sunday = new Date(monday.getTime());
    sunday.setDate(monday.getDate() + 6);
    
    const pad = (num: number) => String(num).padStart(2, '0');
    
    const formattedMonday = `${pad(monday.getDate())}-${pad(monday.getMonth() + 1)}-${String(monday.getFullYear()).slice(-2)}`;
    const formattedSunday = `${pad(sunday.getDate())}-${pad(sunday.getMonth() + 1)}-${String(sunday.getFullYear()).slice(-2)}`;
    
    return {
      weekNo,
      formattedMonday,
      formattedSunday,
    };
  }, [weekBaseDate]);

  const handlePrevWeek = () => {
    const date = new Date(weekBaseDate);
    date.setDate(date.getDate() - 7);
    setWeekBaseDate(formatLocalDate(date));
  };

  const handleNextWeek = () => {
    const date = new Date(weekBaseDate);
    date.setDate(date.getDate() + 7);
    setWeekBaseDate(formatLocalDate(date));
  };

  const handleCurrentWeek = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setWeekBaseDate(`${yyyy}-${mm}-${dd}`);
  };

  // Filtering State
  const [filterDateGroup, setFilterDateGroup] = useState<'all' | 'today' | 'upcoming'>('all');
  const [filterWorker, setFilterWorker] = useState<string>('ALL');

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  // Filter implementation
  const filteredPlans = useMemo(() => {
    return [...plans]
      .sort((a, b) => a.planDate.localeCompare(b.planDate))
      .filter((plan) => {
        const isToday = plan.planDate === todayStr;
        const isUpcoming = plan.planDate > todayStr;

        const dateMatch =
          filterDateGroup === 'all' ||
          (filterDateGroup === 'today' && isToday) ||
          (filterDateGroup === 'upcoming' && isUpcoming);

        const workerMatch = filterWorker === 'ALL' || plan.assignedWorker === filterWorker;

        return dateMatch && workerMatch;
      });
  }, [plans, filterDateGroup, filterWorker, todayStr]);

  const workers = useMemo(() => {
    const list = profiles && profiles.length > 0 ? profiles : MOCK_PROFILES;
    return list.filter((p) => p.role === 'worker');
  }, [profiles]);

  const assignedWorkerPlans = useMemo(() => {
    return plans.filter((p) => p.assignedWorker === currentUser.name);
  }, [plans, currentUser.name]);

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsedQty = parseInt(qtyPlanned, 10);
    if (!parsedQty || parsedQty <= 0) {
      setFormError('Please input a valid planned quantity greater than zero.');
      return;
    }

    if (!planDate) {
      setFormError('Planning date is required.');
      return;
    }

    onAddPlan({
      planDate,
      machine,
      shift,
      model: selectedModel,
      quantityPlanned: parsedQty,
      assignedWorker,
      notes: notes.trim() || undefined,
      createdBy: currentUser.id
    });

    // Reset inputs
    setQtyPlanned('');
    setNotes('');
  };

  const getCellPlans = (machine: MachineType, shift: ShiftType, dateStr: string) => {
    return plans.filter(
      (p) => p.planDate === dateStr && p.machine === machine && p.shift === shift
    );
  };

  // ADVANCED SELECTION & COPY IMPLEMENTATION METHODS
  const currentVisiblePlans = useMemo(() => {
    const dayDates = weekDays.map((d) => d.dateStr);
    return plans.filter((p) => dayDates.includes(p.planDate));
  }, [plans, weekDays]);

  const isAllSelected = useMemo(() => {
    if (currentVisiblePlans.length === 0) return false;
    return currentVisiblePlans.every((p) => selectedPlanIds.includes(p.id));
  }, [currentVisiblePlans, selectedPlanIds]);

  const handleToggleSelectPlan = (id: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const idsToRemove = currentVisiblePlans.map((p) => p.id);
      setSelectedPlanIds((prev) => prev.filter((id) => !idsToRemove.includes(id)));
    } else {
      const idsToAdd = currentVisiblePlans.map((p) => p.id);
      setSelectedPlanIds((prev) => {
        const newSelection = [...prev];
        idsToAdd.forEach((id) => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleBulkDeleteSubmit = () => {
    if (selectedPlanIds.length === 0) return;
    if (onBulkDeletePlans) {
      onBulkDeletePlans(selectedPlanIds);
      setSelectedPlanIds([]);
    }
  };

  const shiftDateStrByDays = (dateStr: string, daysOffset: number) => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + daysOffset);
    return formatLocalDate(d);
  };

  const nextWeekMondayStr = useMemo(() => {
    const base = new Date(weekBaseDate + 'T12:00:00');
    base.setDate(base.getDate() + 7);
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(base.setDate(diff));
    return formatLocalDate(monday);
  }, [weekBaseDate]);

  const handleStartCellCopy = (machineType: MachineType, shiftType: ShiftType, dateStr: string) => {
    setSourceMachine(machineType);
    setSourceShift(shiftType);
    setSourceDay(dateStr);

    const srcDate = new Date(dateStr + 'T12:00:00');
    srcDate.setDate(srcDate.getDate() + 1);
    setTargetDay(formatLocalDate(srcDate));

    setTargetShift('Keep');
    setTargetMachine('Keep');
    setCopyMode('shift');
    setShowCopyModal(true);
  };

  const handleStartDayCopy = () => {
    const defaultSource = weekDays[0]?.dateStr || formatLocalDate(new Date());
    setSourceDay(defaultSource);

    const srcDate = new Date(defaultSource + 'T12:00:00');
    srcDate.setDate(srcDate.getDate() + 1);
    setTargetDay(formatLocalDate(srcDate));

    setCopyMode('day');
    setShowCopyModal(true);
  };

  const handleStartWeekCopy = () => {
    setTargetWeekStart(nextWeekMondayStr);
    setCopyMode('week');
    setShowCopyModal(true);
  };

  const handleCopySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onBulkAddPlans) return;

    let plansToCopy: Omit<ProductionPlan, 'id' | 'createdAt'>[] = [];

    if (copyMode === 'selected') {
      const selectedPlans = plans.filter((p) => selectedPlanIds.includes(p.id));
      if (selectedPlans.length === 0) return;

      plansToCopy = selectedPlans.map((p) => {
        const destDate = targetDay || p.planDate;
        const destShift = targetShift === 'Keep' ? p.shift : targetShift;
        const destMachine = targetMachine === 'Keep' ? p.machine : targetMachine;
        return {
          planDate: destDate,
          machine: destMachine as MachineType,
          shift: destShift as ShiftType,
          model: p.model,
          quantityPlanned: p.quantityPlanned,
          quantityCompleted: resetProgress ? 0 : (p.quantityCompleted || 0),
          assignedWorker: p.assignedWorker,
          notes: p.notes,
          status: resetProgress ? 'Pending' : p.status,
          createdBy: currentUser.id,
          copiedFrom: p.id
        };
      });

    } else if (copyMode === 'shift') {
      const sourcePlans = plans.filter(
        (p) => p.planDate === sourceDay && p.shift === sourceShift && p.machine === sourceMachine
      );
      if (sourcePlans.length === 0) {
        Swal.fire({
          title: "Empty Source Slot",
          text: "No operational schedules exist in the selected shift to duplicate.",
          icon: "error",
          background: '#0f172a',
          color: '#cbd5e1',
          confirmButtonText: 'Understood'
        });
        return;
      }

      if (!targetDay) {
        Swal.fire({
          title: "Format Error",
          text: "Destination date configuration is invalid.",
          icon: "error",
          background: '#0f172a',
          color: '#cbd5e1',
          confirmButtonText: 'Understood'
        });
        return;
      }

      plansToCopy = sourcePlans.map((p) => {
        const destShift = targetShift === 'Keep' ? p.shift : targetShift;
        const destMachine = targetMachine === 'Keep' ? p.machine : targetMachine;
        return {
          planDate: targetDay,
          machine: destMachine as MachineType,
          shift: destShift as ShiftType,
          model: p.model,
          quantityPlanned: p.quantityPlanned,
          quantityCompleted: resetProgress ? 0 : (p.quantityCompleted || 0),
          assignedWorker: p.assignedWorker,
          notes: p.notes,
          status: resetProgress ? 'Pending' : p.status,
          createdBy: currentUser.id,
          copiedFrom: p.id
        };
      });

    } else if (copyMode === 'day') {
      const sourcePlans = plans.filter((p) => p.planDate === sourceDay);
      if (sourcePlans.length === 0) {
        Swal.fire({
          title: "Empty Source Day",
          text: `No operational schedules exist on ${sourceDay} to duplicate.`,
          icon: "error",
          background: '#0f172a',
          color: '#cbd5e1',
          confirmButtonText: 'Understood'
        });
        return;
      }

      if (!targetDay) {
        Swal.fire({
          title: "Format Error",
          text: "Destination date is required.",
          icon: "error",
          background: '#0f172a',
          color: '#cbd5e1',
          confirmButtonText: 'Understood'
        });
        return;
      }

      plansToCopy = sourcePlans.map((p) => {
        return {
          planDate: targetDay,
          machine: p.machine,
          shift: p.shift,
          model: p.model,
          quantityPlanned: p.quantityPlanned,
          quantityCompleted: resetProgress ? 0 : (p.quantityCompleted || 0),
          assignedWorker: p.assignedWorker,
          notes: p.notes,
          status: resetProgress ? 'Pending' : p.status,
          createdBy: currentUser.id,
          copiedFrom: p.id
        };
      });

    } else if (copyMode === 'week') {
      const currentWeekDates = weekDays.map((d) => d.dateStr);
      const sourcePlans = plans.filter((p) => currentWeekDates.includes(p.planDate));
      if (sourcePlans.length === 0) {
        Swal.fire({
          title: "Empty Source Week",
          text: "The current visible week contains no plans to copy.",
          icon: "error",
          background: '#0f172a',
          color: '#cbd5e1',
          confirmButtonText: 'Understood'
        });
        return;
      }

      if (!targetWeekStart) {
        Swal.fire({
          title: "Format Error",
          text: "Target week starting date is required.",
          icon: "error",
          background: '#0f172a',
          color: '#cbd5e1',
          confirmButtonText: 'Understood'
        });
        return;
      }

      const sourceMondayDate = new Date(currentWeekDates[0] + 'T12:00:00');
      const targetMondayDate = new Date(targetWeekStart + 'T12:00:00');
      const diffTime = targetMondayDate.getTime() - sourceMondayDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      plansToCopy = sourcePlans.map((p) => {
        const destDate = shiftDateStrByDays(p.planDate, diffDays);
        return {
          planDate: destDate,
          machine: p.machine,
          shift: p.shift,
          model: p.model,
          quantityPlanned: p.quantityPlanned,
          quantityCompleted: resetProgress ? 0 : (p.quantityCompleted || 0),
          assignedWorker: p.assignedWorker,
          notes: p.notes,
          status: resetProgress ? 'Pending' : p.status,
          createdBy: currentUser.id,
          copiedFrom: p.id
        };
      });
    }

    if (plansToCopy.length === 0) return;

    // Check pre-existing plans in database to warning about accidental duplications
    const duplicateThreats = plansToCopy.filter((newP) =>
      plans.some(
        (existingP) =>
          existingP.planDate === newP.planDate &&
          existingP.shift === newP.shift &&
          existingP.machine === newP.machine &&
          existingP.model === newP.model &&
          existingP.assignedWorker === newP.assignedWorker
      )
    );

    if (duplicateThreats.length > 0) {
      Swal.fire({
        title: "Duplicate Run Prevention",
        text: `Identical matching runs (model, operator, slot) already exist in your target cells. Do you wish to proceed and insert parallel runs in these slots anyway?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, Duplicate",
        cancelButtonText: "Cancel Copying",
        background: '#0f172a',
        color: '#cbd5e1',
        iconColor: '#f59e0b',
        customClass: {
          popup: 'rounded-2xl border border-slate-800 shadow-2xl p-6 font-sans',
          title: 'text-sm font-extrabold uppercase tracking-wider text-slate-100 font-sans mt-2',
          confirmButton: 'px-5 py-2.5 bg-emerald-500 hover:bg-emerald-650 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md mx-1.5',
          cancelButton: 'px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md mx-1.5'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          executeBulkAdd(plansToCopy);
        }
      });
    } else {
      executeBulkAdd(plansToCopy);
    }
  };

  const executeBulkAdd = (plansToCopy: Omit<ProductionPlan, 'id' | 'createdAt'>[]) => {
    if (onBulkAddPlans) {
      onBulkAddPlans(plansToCopy);
      setShowCopyModal(false);
      setSelectedPlanIds([]);
    }
  };

  const getModelPillStyles = (model: AirbagModel) => {
    switch (model) {
      case 'TETOUAN':
        return 'bg-emerald-50 border-emerald-250 text-emerald-800 font-mono font-bold';
      case 'KUGA LHD':
      case 'KUGA RHD':
        return 'bg-sky-50 border-sky-205 text-sky-800 font-mono font-bold';
      case 'CRAFTER':
        return 'bg-amber-50 border-amber-205 text-amber-800 font-mono font-bold';
      case 'CADDY':
        return 'bg-indigo-50 border-indigo-205 text-indigo-800 font-mono font-bold';
      case 'BCB':
        return 'bg-purple-50 border-purple-205 text-purple-800 font-mono font-bold';
      case 'SK216':
        return 'bg-rose-50 border-rose-205 text-rose-800 font-mono font-bold';
      case 'VW217':
        return 'bg-teal-50 border-teal-205 text-teal-850 font-mono font-bold';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800 font-mono font-bold';
    }
  };

  const handleCellClick = (machineType: MachineType, shiftType: ShiftType, dateStr: string) => {
    if (currentUser.role !== 'manager') return;
    setMachine(machineType);
    setShift(shiftType);
    setPlanDate(dateStr);

    // Scroll to the "Create Production Plan" form container smoothly
    const formContainer = document.getElementById('plan-creator-container');
    if (formContainer) {
      formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      formContainer.classList.add('ring-4', 'ring-emerald-400');
      setTimeout(() => {
        formContainer.classList.remove('ring-4', 'ring-emerald-400');
      }, 1000);
    }
  };

  const renderCellContent = (
    cellPlans: ProductionPlan[],
    machineType: MachineType,
    shiftType: ShiftType,
    dateStr: string
  ) => {
    if (cellPlans.length === 0) {
      const isManager = currentUser.role === 'manager';
      if (isManager) {
        return (
          <div
            onClick={() => handleCellClick(machineType, shiftType, dateStr)}
            className="flex items-center justify-center p-1.5 min-h-[80px] h-full transition-all group border border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 rounded-lg cursor-pointer active:scale-[0.98]"
          >
            <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700 bg-slate-50 border border-slate-200/60 group-hover:border-emerald-200 group-hover:bg-white shadow-3xs group-hover:shadow-xs py-1 px-2.5 rounded-lg transition-all flex items-center gap-1 font-sans">
              <Plus size={11} className="text-slate-400 group-hover:text-emerald-500" />
              Create a run
            </span>
          </div>
        );
      } else {
        return (
          <div className="flex items-center justify-center p-1.5 min-h-[80px] h-full border border-dashed border-slate-100/70 rounded-lg">
            <span className="text-[10px] font-mono text-slate-300 select-none">—</span>
          </div>
        );
      }
    }

    return (
      <div className="space-y-1.5">
        {/* Cell Toolbar for Manager */}
        {currentUser.role === 'manager' && (
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1 text-[9px] text-slate-400 font-sans tracking-wide">
            <span className="font-bold font-mono">BINS: {cellPlans.length}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCellClick(machineType, shiftType, dateStr);
                }}
                className="text-slate-400 hover:text-emerald-600 p-0.5 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                title="Add another parallel plan to this shift cell"
              >
                <Plus size={10} strokeWidth={3} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartCellCopy(machineType, shiftType, dateStr);
                }}
                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                title="Copy all shift plans in this cell"
              >
                <Copy size={9} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        {cellPlans.map((plan) => {
          const isYourJob = plan.assignedWorker === currentUser.name;
          const isSelected = selectedPlanIds.includes(plan.id);
          const actualQty = getPlanActualProduced(plan, entries, plans);
          const isComp = actualQty >= plan.quantityPlanned;
          const resolvedStatus = isComp 
            ? 'Completed' 
            : (plan.status === 'Completed' ? (actualQty > 0 ? 'In Progress' : 'Pending') : plan.status || 'Pending');

          return (
            <div
              key={plan.id}
              className={`p-1.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-300 shadow-inner'
                  : isYourJob
                  ? 'bg-teal-50/90 border-teal-300 ring-2 ring-teal-400/10 shadow-2xs'
                  : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
              }`}
              title={`Operator: ${plan.assignedWorker}\nNotes: ${plan.notes || 'None'}`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  {currentUser.role === 'manager' && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectPlan(plan.id)}
                      className="h-3 w-3 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <span className={`text-[9px] font-extrabold px-1 py-0.2 rounded border uppercase truncate ${getModelPillStyles(plan.model)}`}>
                    {plan.model.toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[9px] font-extrabold ${
                    resolvedStatus === 'Completed'
                      ? 'text-emerald-700'
                      : resolvedStatus === 'Delayed'
                      ? 'text-amber-700'
                      : 'text-sky-700'
                  }`}>
                    {resolvedStatus === 'Completed' ? '✓' : resolvedStatus === 'Delayed' ? '⚠️' : '🕒'}
                  </span>
                  {currentUser.role === 'manager' && onEditPlan && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(plan);
                      }}
                      className="text-slate-400 hover:text-emerald-650 hover:bg-emerald-50 p-0.5 rounded-md transition-all shrink-0 cursor-pointer"
                      title="Edit this schedule target"
                    >
                      <Pencil size={10} strokeWidth={2.5} />
                    </button>
                  )}
                  {currentUser.role === 'manager' && onDeletePlan && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePlan(plan.id);
                      }}
                      className="text-slate-400 hover:text-rose-650 hover:bg-rose-50 p-0.5 rounded-md transition-all shrink-0 cursor-pointer"
                      title="Delete this schedule target"
                    >
                      <Plus size={10} className="rotate-45" strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>
              
              {(() => {
                const pctStr = getAchievementPercent(plan.quantityPlanned, actualQty);
                const pctVal = typeof pctStr === 'number' ? Math.round(pctStr) : 0;
                const colors = getAchievementColors(plan.quantityPlanned, actualQty);
                const statusText = getAchievementStatus(plan.quantityPlanned, actualQty);
                return (
                  <div className="mt-1.5 space-y-1">
                    <div className="text-[10px] font-mono text-slate-800 leading-tight flex items-center justify-between">
                      <span className="font-semibold text-slate-500">Prod: <span className="text-[11.5px] font-mono font-black text-emerald-700">{actualQty}</span><span className="text-[9px] text-slate-400 font-normal">/{plan.quantityPlanned}</span></span>
                      <span className={`text-[10px] font-black ${colors.text}`}>{typeof pctStr === 'number' ? `${pctVal}%` : 'No Target'}</span>
                    </div>
                    
                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className={`${colors.bar} h-full rounded-full transition-all duration-305`}
                        style={{ width: `${Math.min(pctVal, 100)}%` }}
                      />
                    </div>

                    <div className="text-[8px] font-semibold uppercase tracking-wider flex items-center justify-between">
                      <span className="text-slate-400">Progression</span>
                      <span className={`px-1 rounded border uppercase font-mono text-[7px] ${colors.bg}`}>{statusText}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="text-[9px] text-slate-500 font-sans font-semibold mt-1.5 flex items-center justify-between gap-1 border-t border-slate-100 pt-1">
                <span className="truncate max-w-[65px]" title={plan.assignedWorker}>
                  👤 {plan.assignedWorker.split(' ')[0]}
                </span>
                {isYourJob && (
                  <span className="text-[8px] text-teal-800 font-extrabold uppercase bg-teal-100 px-1 rounded animate-pulse shrink-0">
                    You
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8" id="planning-module-view">
      {/* MASTER SCHEDULE SPREADSHEET MATRIX (EXCEL STYLE) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-3xs overflow-hidden" id="weekly-schedule-excel-card">
        {/* EXCEL TITLE BAR & WEEK CONTROLS */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold select-none shadow-3xs">
              MTRX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 font-sans tracking-tight">
                  Production Plan
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-mono font-bold uppercase tracking-wider">
                  Live View
                </span>
                <span className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-150 text-sky-700 text-[9px] font-mono font-bold uppercase tracking-wider">
                  Week {companyWeekInfo.weekNo}
                </span>
              </div>
            </div>
          </div>

          {/* WEEK CONTROLLER */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="p-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-205 text-slate-700 rounded-lg text-xs transition-all cursor-pointer font-bold flex items-center gap-1 shadow-3xs"
              title="Previous Week"
              id="excel-prev-week-btn"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <button
              onClick={handleCurrentWeek}
              className="p-1 px-3 bg-white hover:bg-slate-100 border border-slate-150 text-slate-800 rounded-lg text-xs transition-all cursor-pointer font-extrabold shadow-3xs"
              id="excel-current-week-btn"
            >
              Today
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-205 text-slate-700 rounded-lg text-xs transition-all cursor-pointer font-bold flex items-center gap-1 shadow-3xs"
              title="Next Week"
              id="excel-next-week-btn"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* ACTIVE FORMULA INPUT FIELD EXCEL STYLING */}
        <div className="bg-white border-b border-slate-151 px-4 py-1.5 flex items-center gap-2 text-xs font-mono text-slate-600 select-none bg-slate-50/10">
          <span className="font-bold text-slate-400 italic">fx</span>
          <div className="w-[1px] h-3.5 bg-slate-200"></div>
          <span className="text-emerald-700 font-semibold">
            {`=WORK_WEEK(${companyWeekInfo.weekNo}; "from ${companyWeekInfo.formattedMonday} to ${companyWeekInfo.formattedSunday}")`}
          </span>
        </div>

        {/* ADVANCED Whiteboard Action Toolbar */}
        {currentUser.role === 'manager' && (
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-400" />
              <span className="text-xs font-extrabold tracking-tight">Schedule Matrix Utilities:</span>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleStartWeekCopy}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-150 border border-slate-705 hover:border-slate-600 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95"
                title="Copy entire week layout target to another week"
              >
                <CalendarRange size={12} className="text-emerald-400" />
                Copy Full Week
              </button>
              
              <button
                onClick={handleStartDayCopy}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-150 border border-slate-705 hover:border-slate-600 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95"
                title="Copy single day planning grid"
              >
                <Clock size={12} className="text-sky-400" />
                Copy Single Day
              </button>
              
              {currentVisiblePlans.length > 0 && (
                <button
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-slate-705 hover:border-emerald-900 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95"
                >
                  <Check size={12} />
                  {isAllSelected ? "Deselect Week" : "Select All (This Week)"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* EXCEL TABLE ENGINE */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="w-12 bg-slate-150/40 text-[10px] text-slate-400 font-mono font-bold text-center border-r border-slate-200 py-1.5 select-none">
                  #
                </th>
                <th className="w-40 bg-slate-150/40 text-[10px] text-slate-600 font-mono font-bold text-center border-r border-slate-200 px-3 uppercase tracking-wider">
                  MÁQUINA
                </th>
                <th className="w-40 bg-slate-150/40 text-[10px] text-slate-600 font-mono font-bold text-center border-r border-slate-200 px-3 uppercase tracking-wider">
                  SHIFT
                </th>
                {weekDays.map((day, idx) => {
                  const isToday = day.dateStr === todayStr;
                  return (
                    <th
                      key={day.dateStr}
                      className={`text-center border-r border-slate-200 py-2.5 px-2 select-none transition-all ${
                        isToday
                          ? 'bg-emerald-50/70 border-b-2 border-b-emerald-500 font-extrabold shadow-3xs'
                          : 'bg-slate-50'
                      }`}
                    >
                      <div className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold flex items-center justify-center gap-1">
                        <span>{idx === 0 ? 'A' : String.fromCharCode(65 + idx)}</span>
                        {isToday && (
                          <span className="bg-emerald-600 text-white text-[8px] font-sans font-extrabold px-1 py-0.2 rounded transform scale-90 leading-none">
                            HOY
                          </span>
                        )}
                      </div>
                      <div className={`text-xs font-extrabold capitalize font-sans leading-tight ${isToday ? 'text-emerald-950 font-black' : 'text-slate-800'}`}>
                        {day.spanishName}
                      </div>
                      <div className={`text-[9px] font-mono mt-0.5 ${isToday ? 'text-emerald-700 font-bold' : 'text-slate-400 font-semibold'}`}>
                        {day.displayDate}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {/* Row 1: Pequeña (Small) - Morning */}
              <tr className="hover:bg-slate-50/20 bg-white">
                <td className="bg-slate-100/50 text-center font-mono font-bold text-slate-400 border-r border-slate-200 select-none py-4">
                  1
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-850 align-top shrink-0 bg-slate-50/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-teal-500 shrink-0"></span>
                    <div>
                      <div className="text-[11px] font-extrabold text-teal-850 uppercase tracking-wide">Pequeña</div>
                      <div className="text-[9px] text-slate-400 font-normal">Small Machine</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-700 align-top bg-slate-50/5">
                  <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold">
                    <span className="text-base leading-none">🌅</span>
                    <span>Morning (Mañana)</span>
                  </div>
                </td>
                {weekDays.map((day) => {
                  const cellPlans = getCellPlans('Small Machine', 'Morning', day.dateStr);
                  const isToday = day.dateStr === todayStr;
                  return (
                    <td
                      key={day.dateStr}
                      className={`p-2 border-r border-slate-205 align-top min-h-[90px] w-[11.5%] transition-all ${
                        cellPlans.some(p => p.assignedWorker === currentUser.name)
                          ? 'bg-teal-50/30'
                          : isToday
                          ? 'bg-emerald-50/15'
                          : ''
                      }`}
                    >
                      {renderCellContent(cellPlans, 'Small Machine', 'Morning', day.dateStr)}
                    </td>
                  );
                })}
              </tr>

              {/* Row 2: Pequeña (Small) - Evening */}
              <tr className="hover:bg-slate-50/20 bg-white">
                <td className="bg-slate-100/50 text-center font-mono font-bold text-slate-400 border-r border-slate-200 select-none py-4">
                  2
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-850 align-top shrink-0 bg-slate-50/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-teal-500 shrink-0"></span>
                    <div>
                      <div className="text-[11px] font-extrabold text-teal-850 uppercase tracking-wide">Pequeña</div>
                      <div className="text-[9px] text-slate-400 font-normal">Small Machine</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-700 align-top bg-slate-50/5">
                  <div className="flex items-center gap-1 text-[11px] text-indigo-750 font-semibold">
                    <span className="text-base leading-none">🌆</span>
                    <span>Evening (Tarde)</span>
                  </div>
                </td>
                {weekDays.map((day) => {
                  const cellPlans = getCellPlans('Small Machine', 'Evening', day.dateStr);
                  const isToday = day.dateStr === todayStr;
                  return (
                    <td
                      key={day.dateStr}
                      className={`p-2 border-r border-slate-205 align-top min-h-[90px] w-[11.5%] transition-all ${
                        cellPlans.some(p => p.assignedWorker === currentUser.name)
                          ? 'bg-teal-50/30'
                          : isToday
                          ? 'bg-emerald-50/15'
                          : ''
                      }`}
                    >
                      {renderCellContent(cellPlans, 'Small Machine', 'Evening', day.dateStr)}
                    </td>
                  );
                })}
              </tr>

              {/* Row 3: Grande (Big) - Morning */}
              <tr className="hover:bg-slate-50/20 bg-white">
                <td className="bg-slate-100/50 text-center font-mono font-bold text-slate-400 border-r border-slate-200 select-none py-4">
                  3
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-850 align-top shrink-0 bg-slate-50/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-65 shrink-0"></span>
                    <div>
                      <div className="text-[11px] font-extrabold text-indigo-850 uppercase tracking-wide">Grande</div>
                      <div className="text-[9px] text-slate-400 font-normal">Big Machine</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-700 align-top bg-slate-50/5">
                  <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold">
                    <span className="text-base leading-none">🌅</span>
                    <span>Morning (Mañana)</span>
                  </div>
                </td>
                {weekDays.map((day) => {
                  const cellPlans = getCellPlans('Big Machine', 'Morning', day.dateStr);
                  const isToday = day.dateStr === todayStr;
                  return (
                    <td
                      key={day.dateStr}
                      className={`p-2 border-r border-slate-205 align-top min-h-[90px] w-[11.5%] transition-all ${
                        cellPlans.some(p => p.assignedWorker === currentUser.name)
                          ? 'bg-teal-50/30'
                          : isToday
                          ? 'bg-emerald-50/15'
                          : ''
                      }`}
                    >
                      {renderCellContent(cellPlans, 'Big Machine', 'Morning', day.dateStr)}
                    </td>
                  );
                })}
              </tr>

              {/* Row 4: Grande (Big) - Evening */}
              <tr className="hover:bg-slate-50/20 bg-white">
                <td className="bg-slate-100/50 text-center font-mono font-bold text-slate-400 border-r border-slate-200 select-none py-4">
                  4
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-850 align-top shrink-0 bg-slate-50/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-65 shrink-0"></span>
                    <div>
                      <div className="text-[11px] font-extrabold text-indigo-850 uppercase tracking-wide">Grande</div>
                      <div className="text-[9px] text-slate-400 font-normal">Big Machine</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-700 align-top bg-slate-50/5">
                  <div className="flex items-center gap-1 text-[11px] text-indigo-755 font-semibold">
                    <span className="text-base leading-none">🌆</span>
                    <span>Evening (Tarde)</span>
                  </div>
                </td>
                {weekDays.map((day) => {
                  const cellPlans = getCellPlans('Big Machine', 'Evening', day.dateStr);
                  const isToday = day.dateStr === todayStr;
                  return (
                    <td
                      key={day.dateStr}
                      className={`p-2 border-r border-slate-205 align-top min-h-[90px] w-[11.5%] transition-all ${
                        cellPlans.some(p => p.assignedWorker === currentUser.name)
                          ? 'bg-teal-50/30'
                          : isToday
                          ? 'bg-emerald-50/15'
                          : ''
                      }`}
                    >
                      {renderCellContent(cellPlans, 'Big Machine', 'Evening', day.dateStr)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {currentUser.role === 'manager' && (
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-5" id="plan-creator-container">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Create Production Plan</h3>
              <p className="text-xs text-slate-500 font-semibold">Schedule factory outputs</p>
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-150 text-rose-705 rounded-xl text-xs font-semibold">
              {formError}
            </div>
          )}

          <form onSubmit={handlePlanSubmit} className="space-y-4" id="plan-creator-form">
            {/* Date select */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Target Production Date</label>
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all shadow-3xs"
                required
                id="plan-form-date"
              />
            </div>

            {/* Model dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Select Airbag Model</label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as AirbagModel)}
                  className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                  id="plan-form-model"
                >
                  {AIRBAG_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Machine and Shift Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Work Center</label>
                <div className="relative">
                  <select
                    value={machine}
                    onChange={(e) => setMachine(e.target.value as MachineType)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                    id="plan-form-machine"
                  >
                    <option value="Big Machine">Big Machine</option>
                    <option value="Small Machine">Small Machine</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Shift Code</label>
                <div className="relative">
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as ShiftType)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                    id="plan-form-shift"
                  >
                    <option value="Morning">Morning (AM)</option>
                    <option value="Evening">Evening (PM)</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Planned Quantity */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Planned Quantity (pcs)</label>
              <input
                type="number"
                placeholder="e.g. 150"
                value={qtyPlanned}
                onChange={(e) => setQtyPlanned(e.target.value)}
                className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-colors shadow-3xs"
                min="1"
                required
                id="plan-form-quantity"
              />
            </div>

            {/* Assigned worker */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Assigned Operator</label>
              <div className="relative">
                <select
                  value={assignedWorker}
                  onChange={(e) => setAssignedWorker(e.target.value)}
                  className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                  id="plan-form-worker"
                >
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.name}>
                      {worker.name} ({worker.station?.split(' ')[0] || 'Operator'})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Production Directives (Notes)</label>
              <textarea
                placeholder="Provide specific notes/tolerances/setup requests..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all shadow-3xs min-h-[70px] resize-none placeholder-slate-400"
                id="plan-form-notes"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              id="submit-plan-button"
            >
              <Plus size={15} />
              Authorize Schedule
            </button>
          </form>
        </div>
      )}

      {/* EDIT PLANNING TARGET DIALOG */}
      <AnimatePresence>
        {editingPlan && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="edit-plan-modal">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl w-full max-w-md space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
                    <Pencil size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Edit Production Plan</h3>
                    <p className="text-xs text-slate-500 font-semibold">Modify schedule specifications</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingPlan(null)}
                  className="text-slate-450 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
                >
                  <Plus size={16} className="rotate-45" strokeWidth={2.5} id="close-edit-modal-btn" />
                </button>
              </div>

              {editFormError && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-705 rounded-xl text-xs font-semibold">
                  {editFormError}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                {/* Date select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Target Production Date</label>
                  <input
                    type="date"
                    value={editPlanDate}
                    onChange={(e) => setEditPlanDate(e.target.value)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all shadow-3xs"
                    required
                  />
                </div>

                {/* Model dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Select Airbag Model</label>
                  <div className="relative">
                    <select
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value as AirbagModel)}
                      className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                    >
                      {AIRBAG_MODELS.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Machine and Shift Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Work Center</label>
                    <div className="relative">
                      <select
                        value={editMachine}
                        onChange={(e) => setEditMachine(e.target.value as MachineType)}
                        className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                      >
                        <option value="Big Machine">Big Machine</option>
                        <option value="Small Machine">Small Machine</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Shift Code</label>
                    <div className="relative">
                      <select
                        value={editShift}
                        onChange={(e) => setEditShift(e.target.value as ShiftType)}
                        className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                      >
                        <option value="Morning">Morning (AM)</option>
                        <option value="Evening">Evening (PM)</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Planned Quantity & Status Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Quantity (pcs)</label>
                    <input
                      type="number"
                      value={editQtyPlanned}
                      onChange={(e) => setEditQtyPlanned(e.target.value)}
                      className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-colors shadow-3xs"
                      min="1"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Plan Status</label>
                    <div className="relative">
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as any)}
                        className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-805 font-bold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                      >
                        <option value="Pending">🕒 Pending</option>
                        <option value="Completed">✓ Completed</option>
                        <option value="Delayed">⚠️ Delayed</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Assigned worker */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Assigned Operator</label>
                  <div className="relative">
                    <select
                      value={editAssignedWorker}
                      onChange={(e) => setEditAssignedWorker(e.target.value)}
                      className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                    >
                      {workers.map((worker) => (
                        <option key={worker.id} value={worker.name}>
                          {worker.name} ({worker.station?.split(' ')[0] || 'Operator'})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none" />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Production Directives (Notes)</label>
                  <textarea
                    placeholder="Provide specific notes/tolerances/setup requests..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all shadow-3xs min-h-[70px] resize-none placeholder-slate-400"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    id="save-edited-plan-btn"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING BULK ACTIONS TOOLBAR */}
      <AnimatePresence>
        {selectedPlanIds.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center justify-between gap-6 z-40 max-w-2xl w-[90%] md:w-auto"
          >
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs font-extrabold font-mono shadow-xs">
                {selectedPlanIds.length}
              </div>
              <div className="text-left">
                <p className="text-xs font-extrabold tracking-tight">Active Selections</p>
                <button 
                  onClick={() => setSelectedPlanIds([])}
                  type="button"
                  className="text-[10px] text-slate-400 hover:text-slate-150 font-bold underline cursor-pointer bg-transparent border-none p-0"
                >
                  Clear selection
                </button>
              </div>
            </div>

            <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setCopyMode('selected');
                  setTargetDay('');
                  setTargetShift('Keep');
                  setTargetMachine('Keep');
                  setShowCopyModal(true);
                }}
                type="button"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 border-none rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-md active:scale-95 whitespace-nowrap"
              >
                <Copy size={12} strokeWidth={2.5} />
                Copy Selected To
              </button>

              {onBulkDeletePlans && (
                <button
                  onClick={handleBulkDeleteSubmit}
                  type="button"
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white border-none rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95 whitespace-nowrap"
                >
                  <Trash2 size={12} />
                  Bulk Delete
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADVANCED COPY & DUPLICATION WIZARD MODAL */}
      <AnimatePresence>
        {showCopyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 text-slate-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-lg font-sans flex flex-col my-8"
            >
              {/* Header */}
              <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Copy size={15} className="text-emerald-400" />
                  <h3 className="text-sm font-bold tracking-tight">Advanced Schedule Duplication Wizard</h3>
                </div>
                <button
                  onClick={() => setShowCopyModal(false)}
                  type="button"
                  className="text-slate-300 hover:text-white p-1 rounded-md transition-all cursor-pointer border-none bg-transparent"
                >
                  <Plus size={16} className="rotate-45" strokeWidth={3} />
                </button>
              </div>

              <form onSubmit={handleCopySubmit} className="p-5 space-y-4 text-left flex-1">
                {/* Mode Selector Tabs */}
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                  <button
                    type="button"
                    onClick={() => setCopyMode('selected')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg text-center transition-all cursor-pointer ${
                      copyMode === 'selected'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Selected ({selectedPlanIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyMode('shift')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg text-center transition-all cursor-pointer ${
                      copyMode === 'shift'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Shift Cell
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyMode('day')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg text-center transition-all cursor-pointer ${
                      copyMode === 'day'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyMode('week')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg text-center transition-all cursor-pointer ${
                      copyMode === 'week'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Full Week
                  </button>
                </div>

                {/* Subtitle / Mode Guide */}
                <p className="text-[10px] text-slate-400 font-extrabold tracking-wide uppercase border-b border-slate-100 pb-1.5">
                  {copyMode === 'selected' && "Copy specific active list select runs"}
                  {copyMode === 'shift' && "Clone operation stack inside specific machine shift slot"}
                  {copyMode === 'day' && "Clone complete operational matrix of a day"}
                  {copyMode === 'week' && "Duplicate current active 7-day layout plan"}
                </p>

                {/* FIELDS DYNAMIC RENDERING */}
                {copyMode === 'selected' && (
                  <div className="space-y-3">
                    <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span>Duplicating {selectedPlanIds.length} designated selected planning runs concurrently.</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Target Destination Date</label>
                      <input
                        type="date"
                        value={targetDay}
                        onChange={(e) => setTargetDay(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-805 font-medium shadow-3xs hover:bg-slate-50/70"
                        placeholder="Leave blank to preserve original date"
                      />
                      <span className="text-[9.5px] text-slate-400 block mt-0.5">Leave empty to preserve each item's original calendar day.</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Override Shift</label>
                        <select
                          value={targetShift}
                          onChange={(e) => setTargetShift(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="Keep">Keep Original Shift</option>
                          <option value="Morning">Morning (AM)</option>
                          <option value="Evening">Evening (PM)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Override Machine</label>
                        <select
                          value={targetMachine}
                          onChange={(e) => setTargetMachine(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="Keep">Keep Original Machine</option>
                          <option value="Big Machine">Big Machine</option>
                          <option value="Small Machine">Small Machine</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {copyMode === 'shift' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                      <span className="text-[8.5px] text-slate-400 uppercase font-black">Designated Source Slot:</span>
                      <div className="text-[11px] font-bold text-slate-800 font-mono flex flex-wrap items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-slate-200 rounded leading-none">{sourceDay}</span>
                        <span className="text-slate-400">/</span>
                        <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded leading-none">{sourceShift}</span>
                        <span className="text-slate-400">/</span>
                        <span className="px-1.5 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 rounded leading-none">{sourceMachine}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Destination Date</label>
                      <input
                        type="date"
                        value={targetDay}
                        onChange={(e) => setTargetDay(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-805 font-medium shadow-3xs"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Shift Override</label>
                        <select
                          value={targetShift}
                          onChange={(e) => setTargetShift(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="Keep">Keep Original ({sourceShift})</option>
                          <option value="Morning">Morning (AM)</option>
                          <option value="Evening">Evening (PM)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Machine Override</label>
                        <select
                          value={targetMachine}
                          onChange={(e) => setTargetMachine(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="Keep">Keep Original ({sourceMachine.split(' ')[0]})</option>
                          <option value="Big Machine">Big Machine</option>
                          <option value="Small Machine">Small Machine</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {copyMode === 'day' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Source Day</label>
                        <select
                          value={sourceDay}
                          onChange={(e) => setSourceDay(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                        >
                          {weekDays.map(d => (
                            <option key={d.dateStr} value={d.dateStr}>{d.dayName} Mrc ({d.formattedDate})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Target Destination Day</label>
                        <input
                          type="date"
                          value={targetDay}
                          onChange={(e) => setTargetDay(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-805 font-medium shadow-3xs"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {copyMode === 'week' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-indigo-50 border border-indigo-150 text-indigo-950 rounded-xl text-xs space-y-1 font-semibold leading-relaxed">
                      <p>This action clones the whole scheduled operational block of this current week {companyWeekInfo.weekNo} and shifts days across matching offsets to your selected destination starting week.</p>
                      <p className="text-[10px] text-indigo-700">Source: {companyWeekInfo.formattedMonday} to {companyWeekInfo.formattedSunday}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Target Week Starting Monday</label>
                      <input
                        type="date"
                        value={targetWeekStart}
                        onChange={(e) => setTargetWeekStart(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-indigo-850 cursor-pointer"
                        required
                      />
                      <span className="text-[9.5px] text-slate-405 block mt-0.5">Please specify any calendar day within the target calendar week.</span>
                    </div>
                  </div>
                )}

                {/* Safe Progress Reset Option */}
                <div className="border-t border-slate-100 pt-3.5 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="copy-reset-progress"
                    checked={resetProgress}
                    onChange={(e) => setResetProgress(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-250 cursor-pointer"
                  />
                  <div className="text-left leading-tight">
                    <label htmlFor="copy-reset-progress" className="text-xs font-extrabold text-slate-800 cursor-pointer block">
                      Reset Completion Progress to 0% & set status to 'Pending'
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold block mt-1">Recommended for future scheduled targets. Uncheck this if you wish to retain completed figures and active states.</span>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCopyModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-755 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs active:scale-95"
                  >
                    <Copy size={13} strokeWidth={2.5} />
                    Copy & Create Plans
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
